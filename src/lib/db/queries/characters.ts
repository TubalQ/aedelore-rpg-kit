import { eq, ne, and, isNull, sql, type SQL, type AnyColumn } from "drizzle-orm";
import { getStashMap, getStashMaps, hydrateCharacterData, resolveStashId, type StashMap } from "@/lib/db/queries/stash";
import { db } from "@/lib/db/client";
import { characters, campaigns, campaignPlayers } from "@/lib/db/schema";
import { CharacterDataSchema } from "@/lib/schemas/character";
import type { CharacterData } from "@/lib/schemas/character";
import { getKind } from "./system-data";
import { DM_COPY_SUFFIX, holdsEntry, keepHeldQuestItems, takeBackPatch, type HeldEntry, type HeldKind } from "@/lib/stash/holdings";
import { isCampaignNameConflict, isNameTakenInCampaign } from "./character-names";
import { mergeAgainstBase } from "@/lib/domain/character-patch";

/**
 * XP cost per attribute/skill point, read LIVE from the active system's
 * `attributes` kind (DB-backed, editable in /system-admin). Server-side query
 * code can't rely on the per-request SystemProvider holder, so it reads the
 * kind directly; `?? 10` guards a DB row that predates the field.
 */
async function getXpPerPoint(): Promise<number> {
  const attrs = (await getKind("attributes")) as { xpPerPoint?: number } | null;
  return attrs?.xpPerPoint ?? 10;
}


// ---------------------------------------------------------------------------
// Atomic JSONB building blocks (rule 11). Every expression reads the row being
// updated, never a snapshot taken earlier in the request.
// ---------------------------------------------------------------------------

type StatMap = "attributes" | "skills";

/** `data` with the given map keys overwritten, other keys of the map kept. */
function mergeStatMaps(base: SQL, maps: Partial<Record<StatMap, Record<string, number>>>): SQL {
  let expr = base;
  for (const map of ["attributes", "skills"] as const) {
    const values = maps[map];
    if (!values || Object.keys(values).length === 0) continue;
    expr = sql`jsonb_set(${expr}, ${`{${map}}`}::text[], coalesce(${characters.data}->${map}, '{}'::jsonb) || ${JSON.stringify(values)}::jsonb)`;
  }
  return expr;
}

/** `data` with the given map keys incremented by their deltas, never below 0. */
function incrementStatMaps(base: SQL, deltas: Partial<Record<StatMap, Record<string, number>>>): SQL {
  let expr = base;
  for (const map of ["attributes", "skills"] as const) {
    const values = deltas[map];
    if (!values || Object.keys(values).length === 0) continue;
    // Make sure the parent object exists: jsonb_set does nothing on a missing parent.
    expr = sql`jsonb_set(${expr}, ${`{${map}}`}::text[], coalesce(${characters.data}->${map}, '{}'::jsonb))`;
    for (const [name, delta] of Object.entries(values)) {
      expr = sql`jsonb_set(${expr}, ARRAY[${map}, ${name}]::text[], to_jsonb(greatest(0, coalesce((${characters.data}->${map}->>${name})::int, 0) + ${delta}::int)))`;
    }
  }
  return expr;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const dataOrEmpty = (): SQL => sql`coalesce(${characters.data}, '{}'::jsonb)`;

/**
 * Join condition for the character's campaign while it is live. A campaign in
 * the trash holds no characters (the owner 2026-11-15, fynd 4 and L1): the player
 * can leave, join another campaign and unlock steps. Restoring the campaign
 * brings back the characters that still point at it.
 */
const liveCampaign = () => and(eq(characters.campaignId, campaigns.id), isNull(campaigns.deletedAt));

/** The character row as its owner sees it: a trashed campaign reads as none. */
function withLiveCampaign<T extends { campaignId: number | null }>(row: T, liveCampaignId: number | null): T {
  return row.campaignId === liveCampaignId ? row : { ...row, campaignId: liveCampaignId };
}

/**
 * Stored data in canonical shape (tolerant parse) with the campaign stash's
 * content overlaid on held items/equipment, as every response returns it.
 */
async function withParsedData<T extends { data: unknown; campaignId: number | null }>(
  row: T,
  stashMaps?: Map<number, StashMap>,
): Promise<T & { data: CharacterData }> {
  const data = CharacterDataSchema.parse(row.data ?? {});
  if (row.campaignId == null) return { ...row, data };
  const stash = stashMaps?.get(row.campaignId) ?? (await getStashMap(row.campaignId));
  return { ...row, data: hydrateCharacterData(data, stash) };
}

export async function getCharactersByUser(userId: string) {
  // Left-join kampanjnamnet så listan kan visa var karaktären hör hemma.
  const rows = await db
    .select({ character: characters, campaignName: campaigns.name, liveCampaignId: campaigns.id })
    .from(characters)
    .leftJoin(campaigns, liveCampaign())
    .where(and(eq(characters.userId, userId), isNull(characters.deletedAt)));
  const live = rows.map((r) => ({ ...withLiveCampaign(r.character, r.liveCampaignId), campaignName: r.campaignName }));
  const maps = await getStashMaps(live.flatMap((c) => (c.campaignId ? [c.campaignId] : [])));
  return Promise.all(live.map((c) => withParsedData(c, maps)));
}

export async function getCharacterById(id: number, userId: string) {
  const rows = await db
    .select({ character: characters, liveCampaignId: campaigns.id })
    .from(characters)
    .leftJoin(campaigns, liveCampaign())
    .where(
      and(
        eq(characters.id, id),
        eq(characters.userId, userId),
        isNull(characters.deletedAt),
      ),
    );
  const row = rows[0];
  return row ? withLiveCampaign(row.character, row.liveCampaignId) : null;
}

// Läsning för en "viewer": ägaren ELLER kampanjens DM. Returnerar karaktären med
// flaggan viewerIsDm (true = DM som inte äger karaktären) för DM-läget på bladet.
export async function getCharacterForViewer(id: number, userId: string) {
  const rows = await db
    .select({ character: characters, campaignOwnerId: campaigns.userId, liveCampaignId: campaigns.id })
    .from(characters)
    // A trashed campaign no longer grants its DM access to the players' characters.
    .leftJoin(campaigns, liveCampaign())
    .where(and(eq(characters.id, id), isNull(characters.deletedAt)));
  const row = rows[0];
  if (!row) return null;
  const isOwner = row.character.userId === userId;
  const isDm = row.campaignOwnerId != null && row.campaignOwnerId === userId;
  if (!isOwner && !isDm) return null;
  return withParsedData({ ...withLiveCampaign(row.character, row.liveCampaignId), viewerIsDm: isDm && !isOwner });
}

/**
 * A character may only be attached to a campaign the user is actually part of:
 * its DM (owner) or a joined player. Guards #3 - without this, any authenticated
 * user could POST/PUT an arbitrary `campaignId` and pin their character to a
 * campaign they don't belong to. Returns true for null (no campaign = always OK).
 */
async function userCanAttachToCampaign(
  campaignId: number | null,
  userId: string,
): Promise<boolean> {
  if (campaignId === null) return true;
  const asOwner = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.id, campaignId),
        eq(campaigns.userId, userId),
        isNull(campaigns.deletedAt),
      ),
    )
    .limit(1);
  if (asOwner.length > 0) return true;
  const asPlayer = await db
    .select({ campaignId: campaignPlayers.campaignId })
    .from(campaignPlayers)
    .where(
      and(
        eq(campaignPlayers.campaignId, campaignId),
        eq(campaignPlayers.userId, userId),
      ),
    )
    .limit(1);
  return asPlayer.length > 0;
}

export async function createCharacter(
  userId: string,
  name: string,
  campaignId: number | null,
): Promise<typeof characters.$inferSelect | null | "name_taken"> {
  // Reject attaching to a campaign the user isn't a member/owner of (#3).
  if (!(await userCanAttachToCampaign(campaignId, userId))) return null;
  if (campaignId !== null && (await isNameTakenInCampaign(db, campaignId, name))) return "name_taken";
  const defaultData: CharacterData = CharacterDataSchema.parse({});
  try {
    const rows = await db
      .insert(characters)
      .values({
        userId,
        name,
        campaignId,
        data: defaultData as Record<string, unknown>,
      })
      .returning();
    return rows[0];
  } catch (err) {
    if (isCampaignNameConflict(err)) return "name_taken";
    throw err;
  }
}

export type UpdateCharacterResult =
  | {
      ok: true;
      character: typeof characters.$inferSelect & { data: CharacterData };
      /** Keys not written: changed by someone else since the save's base (C2). */
      conflicts: string[];
    }
  | { ok: false; reason: "not_found" | "campaign_change" | "one_per_campaign" }
  | { ok: false; reason: "name_taken"; name: string };

// Keys only the campaign's DM writes (via the DM endpoints). A player patch that
// carries them is ignored: DM equipment feeds bonus-calc, so a self-written
// entry would be a free stat bonus.
const DM_OWNED_KEYS = ["dmEquipment"] as const;

export async function updateCharacter(
  id: number,
  userId: string,
  updates: {
    name?: string;
    /** Already validated with sanitizeDataPatch (see the PUT route). */
    data?: Record<string, unknown>;
    campaignId?: number | null;
    /**
     * What each changed key was when the caller started changing it. With a
     * base, the save is merged against the stored value (mergeAgainstBase).
     */
    base?: Record<string, unknown>;
  },
): Promise<UpdateCharacterResult> {
  // Auktorisering: ägaren ELLER kampanjens DM får uppdatera. DM (som inte är ägare)
  // kringgår lås - får redigera låsta sektioner på spelarens vägnar.
  const [existing] = await db
    .select({
      ownerId: characters.userId,
      // The live campaign: a character in a trashed one is free to move.
      campaignId: campaigns.id,
      campaignOwnerId: campaigns.userId,
      raceClassLocked: characters.raceClassLocked,
      attributesLocked: characters.attributesLocked,
      abilitiesLocked: characters.abilitiesLocked,
      data: characters.data,
      name: characters.name,
    })
    .from(characters)
    .leftJoin(campaigns, and(eq(characters.campaignId, campaigns.id), isNull(campaigns.deletedAt)))
    .where(and(eq(characters.id, id), isNull(characters.deletedAt)));
  if (!existing) return { ok: false, reason: "not_found" };
  const isOwner = existing.ownerId === userId;
  const isDm = existing.campaignOwnerId != null && existing.campaignOwnerId === userId;
  if (!isOwner && !isDm) return { ok: false, reason: "not_found" };
  const bypassLocks = isDm && !isOwner;

  if (updates.campaignId !== undefined && updates.campaignId !== existing.campaignId) {
    // Once in a campaign the character leaves only through the leave endpoint.
    // Otherwise a player could detach, unlock steps the DM locked, edit, and
    // attach again (the DM's locks only bind while campaignId is set).
    if (existing.campaignId != null) return { ok: false, reason: "campaign_change" };
    // Reject moving the character into a campaign the caller isn't part of (#3).
    if (!(await userCanAttachToCampaign(updates.campaignId, userId))) {
      return { ok: false, reason: "not_found" };
    }
    // One character per player in a campaign (L4).
    if (updates.campaignId !== null && (await playerHasAnotherCharacterIn(db, updates.campaignId, userId, id))) {
      return { ok: false, reason: "one_per_campaign" };
    }
  }

  // Entering a campaign, or a new name inside one: the name must be free there.
  const campaignAfter = updates.campaignId !== undefined ? updates.campaignId : existing.campaignId;
  const nameAfter = updates.name ?? existing.name;
  const entersOrRenames = (updates.campaignId !== undefined && updates.campaignId !== existing.campaignId) || updates.name !== undefined;
  if (campaignAfter != null && entersOrRenames && (await isNameTakenInCampaign(db, campaignAfter, nameAfter, id))) {
    return { ok: false, reason: "name_taken", name: nameAfter };
  }

  let patch: Record<string, unknown> = { ...(updates.data ?? {}) };
  if (!bypassLocks && existing.raceClassLocked) {
    delete patch.race;
    delete patch.class;
    delete patch.religion;
  }
  // The locks follow the sheet's steps (C3): skills are edited in the
  // attributes step, so the attributes lock holds them. Before, a player
  // could change skills after locking attributes, and lost skill edits
  // without a word while only abilities were locked.
  if (!bypassLocks && existing.attributesLocked) {
    delete patch.attributes;
    delete patch.skills;
  }
  if (!bypassLocks && existing.abilitiesLocked) {
    delete patch.spells;
  }
  if (!isDm) {
    for (const key of DM_OWNED_KEYS) delete patch[key];
    // Quest items are handed out by the DM; the player only archives and
    // restores them (see keepHeldQuestItems).
    if ("questItems" in patch || "questItemsArchived" in patch) {
      const current = typeof existing.data === "object" && existing.data !== null ? (existing.data as Record<string, unknown>) : {};
      const kept = keepHeldQuestItems(current, patch);
      if (kept.dropped > 0) {
        console.warn(`[characters] ${kept.dropped} quest item(s) the character does not hold were dropped from a player's save (character ${id})`);
      }
      Object.assign(patch, kept.patch);
    }
  }

  const write = async (conn: Tx | typeof db): Promise<{ rows: (typeof characters.$inferSelect)[]; conflicts: string[] }> => {
    let conflicts: string[] = [];
    // The campaign lock first, then the character's: the same order as join,
    // so the two never wait on each other.
    const entering = updates.campaignId != null && updates.campaignId !== existing.campaignId ? updates.campaignId : null;
    if (entering !== null) await conn.execute(sql`SELECT id FROM campaigns WHERE id = ${entering} FOR UPDATE`);
    // A save with a base is merged against the stored value, read under a row
    // lock so nothing changes between the comparison and the write. The
    // comparison is with the data as the caller sees it (parsed, with stash
    // content), since that is what the base was taken from.
    if (updates.base && Object.keys(patch).length > 0) {
      const [locked] = await conn
        .select({ data: characters.data, campaignId: characters.campaignId })
        .from(characters)
        .where(eq(characters.id, id))
        .for("update");
      if (locked) {
        const view = await withParsedData(locked);
        const merged = mergeAgainstBase(view.data as Record<string, unknown>, patch, updates.base);
        patch = merged.patch;
        conflicts = merged.conflicts;
      }
    }

    const setClause: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name !== undefined) setClause.name = updates.name;
    if (updates.campaignId !== undefined) setClause.campaignId = updates.campaignId;

    // Attribute/skill maps merge per key IN SQL, against the row being updated,
    // so a concurrent XP spend or DM edit to another key is never overwritten by
    // a stale snapshot (rule 11). Everything else merges per top-level key.
    const { attributes, skills, ...rest } = patch;
    if (attributes !== undefined || skills !== undefined || Object.keys(rest).length > 0) {
      let expr = mergeStatMaps(dataOrEmpty(), {
        attributes: attributes as Record<string, number> | undefined,
        skills: skills as Record<string, number> | undefined,
      });
      if (Object.keys(rest).length > 0) {
        expr = sql`${expr} || ${JSON.stringify(rest)}::jsonb`;
      }
      setClause.data = expr;
    }

    // Entering a campaign (L13): under the campaign lock, and only while the
    // user is still its DM or a player in it (a leave may have landed since
    // the check above).
    const stillAllowed =
      entering === null
        ? sql`true`
        : sql`exists (select 1 from campaigns c where c.id = ${entering} and c.deleted_at is null and (c.user_id = ${userId}
            or exists (select 1 from campaign_players cp where cp.campaign_id = c.id and cp.user_id = ${userId})))`;
    const rows = await conn
      .update(characters)
      .set(setClause)
      .where(and(eq(characters.id, id), isNull(characters.deletedAt), stillAllowed))
      .returning();
    return { rows, conflicts };
  };

  const entersCampaign = updates.campaignId != null && updates.campaignId !== existing.campaignId;
  let out: { rows: (typeof characters.$inferSelect)[]; conflicts: string[] };
  try {
    out = updates.base || entersCampaign ? await db.transaction((tx) => write(tx)) : await write(db);
  } catch (err) {
    if (isCampaignNameConflict(err)) return { ok: false, reason: "name_taken", name: nameAfter };
    throw err;
  }

  const [row] = out.rows;
  // The response reads the campaign the same way GET does: a trashed one as
  // none (a raw campaignId leaked here while GET said null).
  const liveId = updates.campaignId !== undefined ? updates.campaignId : existing.campaignId;
  return row
    ? { ok: true, character: await withParsedData(withLiveCampaign(row, liveId)), conflicts: out.conflicts }
    : { ok: false, reason: "not_found" };
}

export async function softDeleteCharacter(id: number, userId: string) {
  const rows = await db
    .update(characters)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(characters.id, id),
        eq(characters.userId, userId),
        isNull(characters.deletedAt),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function getDeletedCharacters(userId: string) {
  return db
    .select()
    .from(characters)
    .where(and(eq(characters.userId, userId), sql`${characters.deletedAt} IS NOT NULL`));
}

/**
 * Brings a character back from the trash, into its campaign. When another
 * character in that campaign has taken its name meanwhile, it comes back
 * outside the campaign (`detachedFromCampaign`), so the two never share a
 * name; the player can then join a campaign with it.
 */
/**
 * L4: a player has one character per campaign (the party list, the player view
 * and the visibility filter all assume it). A restored character whose player
 * attached another one meanwhile comes back outside the campaign. The DM's own
 * characters in their own campaign are not limited.
 */
export async function playerHasAnotherCharacterIn(
  conn: typeof db | Tx,
  campaignId: number,
  userId: string,
  exceptId: number,
): Promise<boolean> {
  const [hit] = await conn
    .select({ id: characters.id })
    .from(characters)
    .innerJoin(campaigns, eq(campaigns.id, characters.campaignId))
    .where(
      and(
        eq(characters.campaignId, campaignId),
        eq(characters.userId, userId),
        ne(characters.id, exceptId),
        isNull(characters.deletedAt),
        ne(campaigns.userId, userId),
      ),
    )
    .limit(1);
  return hit !== undefined;
}

export async function restoreCharacter(
  id: number,
  userId: string,
): Promise<(typeof characters.$inferSelect & { detachedFromCampaign: boolean }) | null> {
  return db.transaction(async (tx) => {
    const [trashed] = await tx
      .select({ name: characters.name, campaignId: characters.campaignId })
      .from(characters)
      .where(and(eq(characters.id, id), eq(characters.userId, userId), sql`${characters.deletedAt} IS NOT NULL`))
      .for("update");
    if (!trashed) return null;
    const detach =
      trashed.campaignId != null &&
      ((await isNameTakenInCampaign(tx, trashed.campaignId, trashed.name, id)) ||
        (await playerHasAnotherCharacterIn(tx, trashed.campaignId, userId, id)));
    const [row] = await tx
      .update(characters)
      .set({ deletedAt: null, updatedAt: new Date(), ...(detach ? { campaignId: null } : {}) })
      .where(eq(characters.id, id))
      .returning();
    return row ? { ...row, detachedFromCampaign: detach } : null;
  });
}

export async function permanentDeleteCharacter(id: number, userId: string) {
  const rows = await db
    .delete(characters)
    .where(
      and(
        eq(characters.id, id),
        eq(characters.userId, userId),
        sql`${characters.deletedAt} IS NOT NULL`,
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function lockCharacterStep(
  id: number,
  userId: string,
  step: "raceClass" | "attributes" | "abilities",
  locked: boolean,
) {
  const field = {
    raceClass: "raceClassLocked" as const,
    attributes: "attributesLocked" as const,
    abilities: "abilitiesLocked" as const,
  }[step];

  const rows = await db
    .update(characters)
    .set({
      [field]: locked,
      // A lock set in a campaign is the DM's to lift (L5), also after leaving.
      ...(locked ? { locksDmHeld: sql`${characters.locksDmHeld} or ${characters.campaignId} is not null` } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(characters.id, id), eq(characters.userId, userId), isNull(characters.deletedAt)))
    .returning();

  const row = rows[0];
  if (!row) return null;
  if (row.campaignId == null) return row;
  // Same reading as GET: a trashed campaign holds no characters.
  const [live] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.id, row.campaignId), isNull(campaigns.deletedAt)));
  return withLiveCampaign(row, live?.id ?? null);
}

/**
 * Spend XP to raise attributes/skills past the creation cap. Applies the given
 * deltas and deducts pointsAdded * XP_PER_POINT from available XP, atomically.
 * This is the *only* path that may raise attributes after they are locked -
 * the normal update path strips locked attribute/skill changes.
 */
export async function spendXp(
  id: number,
  userId: string,
  deltas: {
    attributes?: Record<string, number | undefined>;
    skills?: Record<string, number | undefined>;
  },
) {
  const positive = (m?: Record<string, number | undefined>): Record<string, number> =>
    Object.fromEntries(
      Object.entries(m ?? {}).filter(([, v]) => typeof v === "number" && v > 0),
    ) as Record<string, number>;
  const attrDeltas = positive(deltas.attributes);
  const skillDeltas = positive(deltas.skills);

  const pointsToAdd =
    Object.values(attrDeltas).reduce((s, v) => s + v, 0) +
    Object.values(skillDeltas).reduce((s, v) => s + v, 0);
  if (pointsToAdd < 1) return null;

  const cost = pointsToAdd * (await getXpPerPoint());

  // One statement: the affordability check, the XP charge and the stat
  // increments all apply to the current row, so two quick spends can neither
  // both pass the check nor overwrite each other's increments.
  const rows = await db
    .update(characters)
    .set({
      data: incrementStatMaps(dataOrEmpty(), { attributes: attrDeltas, skills: skillDeltas }),
      xpSpent: sql`${characters.xpSpent} + ${cost}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(characters.id, id),
        eq(characters.userId, userId),
        isNull(characters.deletedAt),
        sql`${characters.xp} - ${characters.xpSpent} >= ${cost}`,
      ),
    )
    .returning();

  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// DM character control (verifies campaign ownership, not character ownership)
// ---------------------------------------------------------------------------

async function verifyDmOwnsCharacter(
  characterId: number,
  dmUserId: string,
  campaignId: number,
) {
  // Bind the action to the campaign in the URL (#4): the character must live in
  // *this* campaign AND that campaign must be owned by the caller. Without the
  // `camp.id = campaignId` clause a DM who owns campaigns A and B could act on a
  // B-character through the /campaigns/A/... route.
  const rows = await db.execute(sql`
    SELECT c.id, c.data, c.xp, c.xp_spent
    FROM characters c
    JOIN campaigns camp ON c.campaign_id = camp.id
    WHERE c.id = ${characterId}
      AND camp.id = ${campaignId}
      AND camp.user_id = ${dmUserId}
      AND c.deleted_at IS NULL
      AND camp.deleted_at IS NULL
  `);
  const row = Array.from(rows)[0];
  return row ?? null;
}

export async function dmGiveXp(characterId: number, dmUserId: string, campaignId: number, amount: number) {
  const char = await verifyDmOwnsCharacter(characterId, dmUserId, campaignId);
  if (!char) return null;

  const rows = await db
    .update(characters)
    .set({ xp: sql`greatest(${characters.xp} + ${amount}, ${characters.xpSpent})`, updatedAt: new Date() })
    .where(and(eq(characters.id, characterId), isNull(characters.deletedAt)))
    .returning();
  return rows[0] ?? null;
}

export async function dmResetXp(characterId: number, dmUserId: string, campaignId: number) {
  const char = await verifyDmOwnsCharacter(characterId, dmUserId, campaignId);
  if (!char) return null;

  const rows = await db
    .update(characters)
    .set({ xp: 0, xpSpent: 0, updatedAt: new Date() })
    .where(eq(characters.id, characterId))
    .returning();
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Handing stash entries to characters and taking them back
// ---------------------------------------------------------------------------


const HELD_KEY: Record<HeldKind, "questItems" | "dmEquipment"> = { quest: "questItems", equipment: "dmEquipment" };

/**
 * Takes the entry back from the campaign's characters that hold it (all of
 * them, or one), under a row lock so a concurrent give or save cannot slip in
 * between the read and the write. Returns the ids of the characters it was
 * taken from.
 */
async function takeBackFromHolders(
  tx: Tx,
  campaignId: number,
  kind: HeldKind,
  entry: HeldEntry,
  scope: { only: number } | { except: number },
): Promise<number[]> {
  const who = "only" in scope ? eq(characters.id, scope.only) : ne(characters.id, scope.except);
  const rows = await tx
    .select({ id: characters.id, data: characters.data })
    .from(characters)
    .where(and(eq(characters.campaignId, campaignId), isNull(characters.deletedAt), who))
    .for("update");

  const taken: number[] = [];
  for (const row of rows) {
    const patch = takeBackPatch(dataOf(row.data), kind, entry);
    if (!patch) continue;
    await tx
      .update(characters)
      .set({ data: sql`${characters.data} || ${JSON.stringify(patch)}::jsonb`, updatedAt: new Date() })
      .where(eq(characters.id, row.id));
    taken.push(row.id);
  }
  return taken;
}

function dataOf(data: unknown): Record<string, unknown> {
  return typeof data === "object" && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
}

/**
 * Gives a stash entry to one character. With `move`, everyone else in the
 * campaign who holds it loses it in the same transaction (handing it over);
 * without, the others keep theirs (sharing). Giving what the character
 * already holds changes nothing.
 */
async function giveHeld(
  characterId: number,
  campaignId: number,
  kind: HeldKind,
  value: Record<string, unknown> & { name: string; stashId: number },
  move: boolean,
) {
  const key = HELD_KEY[kind];
  const entry: HeldEntry = { stashId: value.stashId, name: value.name };
  return db.transaction(async (tx) => {
    if (move) await takeBackFromHolders(tx, campaignId, kind, entry, { except: characterId });
    const [target] = await tx
      .select({ data: characters.data })
      .from(characters)
      .where(eq(characters.id, characterId))
      .for("update");
    if (!target) return null;
    const data = dataOf(target.data);
    const list = Array.isArray(data[key]) ? (data[key] as unknown[]) : [];
    const patch = holdsEntry(data, kind, entry) ? {} : { [key]: [...list, value] };
    const [row] = await tx
      .update(characters)
      .set({ data: sql`${characters.data} || ${JSON.stringify(patch)}::jsonb`, updatedAt: new Date() })
      .where(eq(characters.id, characterId))
      .returning();
    return row ?? null;
  });
}

/** Result of taking an entry back from one character. */
export type TakeBackResult = { taken: true } | { taken: false; reason: "notFound" | "notHeld" };

async function takeBackHeld(
  characterId: number,
  dmUserId: string,
  campaignId: number,
  kind: HeldKind,
  entry: HeldEntry,
): Promise<TakeBackResult> {
  const char = await verifyDmOwnsCharacter(characterId, dmUserId, campaignId);
  if (!char) return { taken: false, reason: "notFound" };
  const taken = await db.transaction((tx) => takeBackFromHolders(tx, campaignId, kind, entry, { only: characterId }));
  return taken.length > 0 ? { taken: true } : { taken: false, reason: "notHeld" };
}

export async function dmGiveItem(
  characterId: number,
  dmUserId: string,
  campaignId: number,
  item: { name: string; description: string; sessionName?: string; stashId?: number },
  options: { move?: boolean } = {},
) {
  const char = await verifyDmOwnsCharacter(characterId, dmUserId, campaignId);
  if (!char) return null;
  // Everything handed to a character is a stash entry (found or created).
  const stashId = await resolveStashId(campaignId, "quest", { name: item.name, description: item.description }, item.stashId);
  return giveHeld(characterId, campaignId, "quest", { ...item, stashId }, options.move ?? false);
}

export async function dmRemoveItem(
  characterId: number,
  dmUserId: string,
  campaignId: number,
  item: HeldEntry,
): Promise<TakeBackResult> {
  return takeBackHeld(characterId, dmUserId, campaignId, "quest", item);
}

export async function dmGiveEquipment(
  characterId: number,
  dmUserId: string,
  campaignId: number,
  equipment: Record<string, unknown>,
  options: { move?: boolean } = {},
) {
  const char = await verifyDmOwnsCharacter(characterId, dmUserId, campaignId);
  if (!char) return null;
  // Everything handed to a character is a stash entry (found or created).
  const { sessionName: _sessionName, stashId: givenStashId, hp: _hp, ...content } = equipment;
  const stashId = await resolveStashId(
    campaignId,
    "equipment",
    content,
    typeof givenStashId === "number" ? givenStashId : undefined,
  );
  const name = typeof equipment.name === "string" ? equipment.name : "";
  return giveHeld(characterId, campaignId, "equipment", { ...equipment, name, stashId }, options.move ?? false);
}

export async function dmRemoveEquipment(
  characterId: number,
  dmUserId: string,
  campaignId: number,
  equipment: HeldEntry,
): Promise<TakeBackResult> {
  return takeBackHeld(characterId, dmUserId, campaignId, "equipment", equipment);
}

export async function dmSetLocks(
  characterId: number,
  dmUserId: string,
  campaignId: number,
  locks: { raceClassLocked?: boolean; attributesLocked?: boolean; abilitiesLocked?: boolean },
) {
  const char = await verifyDmOwnsCharacter(characterId, dmUserId, campaignId);
  if (!char) return null;

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (locks.raceClassLocked !== undefined) update.raceClassLocked = locks.raceClassLocked;
  if (locks.attributesLocked !== undefined) update.attributesLocked = locks.attributesLocked;
  if (locks.abilitiesLocked !== undefined) update.abilitiesLocked = locks.abilitiesLocked;
  // The locks are the DM's while any step stays locked (L5); with all three
  // open the player is free again. Each step: the new value, else the stored one.
  const step = (v: boolean | undefined, column: AnyColumn) => (v === undefined ? sql`${column}` : sql`${v}`);
  update.locksDmHeld = sql`${step(locks.raceClassLocked, characters.raceClassLocked)} or ${step(locks.attributesLocked, characters.attributesLocked)} or ${step(locks.abilitiesLocked, characters.abilitiesLocked)}`;

  const rows = await db
    .update(characters)
    .set(update)
    .where(eq(characters.id, characterId))
    .returning();
  return rows[0] ?? null;
}

export async function dmUpdateHp(
  characterId: number,
  dmUserId: string,
  campaignId: number,
  change: { hp: number } | { delta: number },
) {
  const char = await verifyDmOwnsCharacter(characterId, dmUserId, campaignId);
  if (!char) return null;

  // Under a row lock, on the stored value: a delta from two quick clicks counts
  // twice, and a change the player made meanwhile is kept (live play, #85).
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ data: characters.data }).from(characters).where(eq(characters.id, characterId)).for("update");
    if (!row) return null;
    const charData = dataOf(row.data);
    const maxHp = Number(charData.maxHp ?? 0) || 0;
    const current = Number(charData.hp ?? 0) || 0;
    const wanted = "delta" in change ? current + change.delta : change.hp;
    const patch = { hp: Math.max(0, Math.min(wanted, maxHp)) };
    const rows = await tx
      .update(characters)
      .set({ data: sql`${characters.data} || ${JSON.stringify(patch)}::jsonb`, updatedAt: new Date() })
      .where(eq(characters.id, characterId))
      .returning();
    return rows[0] ?? null;
  });
}

/**
 * The DM raises or lowers a character's attributes and skills. Changes are
 * deltas applied in SQL against the stored values, key by key: only the stats
 * the DM changed are touched, and an XP purchase made meanwhile is kept (C1).
 * No cap: the creation cap (maxPointsPerField) is for building a character, and
 * values bought with XP go past it. Never below 0.
 */
export async function dmAdjustStats(
  characterId: number,
  dmUserId: string,
  campaignId: number,
  deltas: { attributes?: Record<string, number>; skills?: Record<string, number> },
) {
  const char = await verifyDmOwnsCharacter(characterId, dmUserId, campaignId);
  if (!char) return null;

  const changed = (m?: Record<string, number>): Record<string, number> | undefined =>
    m ? Object.fromEntries(Object.entries(m).filter(([, d]) => d !== 0)) : undefined;

  const rows = await db
    .update(characters)
    .set({
      data: incrementStatMaps(dataOrEmpty(), { attributes: changed(deltas.attributes), skills: changed(deltas.skills) }),
      updatedAt: new Date(),
    })
    .where(and(eq(characters.id, characterId), isNull(characters.deletedAt)))
    .returning();
  return rows[0] ?? null;
}

export async function dmUpdateEquipmentHp(
  characterId: number,
  dmUserId: string,
  campaignId: number,
  piece: { index: number; stashId?: number; name?: string },
  hp: number,
) {
  const char = await verifyDmOwnsCharacter(characterId, dmUserId, campaignId);
  if (!char) return null;

  // C11 (and fynd 3): read and write under a row lock, find the piece by its
  // stash id or name (the index came from the sheet's tolerant list, which can
  // skip broken rows, so it could point at another piece), and give the
  // equipped copy the same HP, which never reached it before.
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ data: characters.data }).from(characters).where(eq(characters.id, characterId)).for("update");
    if (!row) return null;
    const charData = dataOf(row.data);
    const dmEquipment = Array.isArray(charData.dmEquipment) ? [...(charData.dmEquipment as Record<string, unknown>[])] : [];
    const at = piece.stashId !== undefined
      ? dmEquipment.findIndex((x) => x?.stashId === piece.stashId)
      : piece.name !== undefined
        ? dmEquipment.findIndex((x) => x?.name === piece.name)
        : piece.index;
    if (at < 0 || at >= dmEquipment.length) return null;

    const item = dmEquipment[at];
    const maxHp = Number(item.maxHp ?? item.hp ?? 0) || 0;
    const newHp = Math.max(0, Math.min(hp, maxHp));
    dmEquipment[at] = { ...item, hp: newHp };

    const patch: Record<string, unknown> = { dmEquipment };
    const copyName = typeof item.name === "string" ? `${item.name}${DM_COPY_SUFFIX}` : null;
    if (copyName) {
      const armor = Array.isArray(charData.equippedArmor) ? (charData.equippedArmor as Record<string, unknown>[]) : [];
      // By stash id first (C5): a copy's stored name can be the stash's new one.
      const isCopy = (c: { name?: unknown; stashId?: unknown } | null | undefined) =>
        !!c && ((item.stashId != null && c.stashId === item.stashId) || c.name === copyName);
      if (armor.some(isCopy)) {
        patch.equippedArmor = armor.map((a) => (isCopy(a) ? { ...a, hp: newHp } : a));
      }
      const shield = charData.equippedShield as Record<string, unknown> | null | undefined;
      if (isCopy(shield)) patch.equippedShield = { ...shield, hp: newHp };
    }

    const rows = await tx
      .update(characters)
      .set({ data: sql`${characters.data} || ${JSON.stringify(patch)}::jsonb`, updatedAt: new Date() })
      .where(eq(characters.id, characterId))
      .returning();
    return rows[0] ?? null;
  });
}
