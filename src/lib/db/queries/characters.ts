import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { characters, campaigns, campaignPlayers } from "@/lib/db/schema";
import { CharacterDataSchema } from "@/lib/schemas/character";
import type { CharacterData } from "@/lib/schemas/character";
import { getKind } from "./system-data";

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


export async function getCharactersByUser(userId: string) {
  // Left-join kampanjnamnet så listan kan visa var karaktären hör hemma.
  const rows = await db
    .select({ character: characters, campaignName: campaigns.name })
    .from(characters)
    .leftJoin(campaigns, eq(characters.campaignId, campaigns.id))
    .where(and(eq(characters.userId, userId), isNull(characters.deletedAt)));
  return rows.map((r) => ({ ...r.character, campaignName: r.campaignName }));
}

export async function getCharacterById(id: number, userId: string) {
  const rows = await db
    .select()
    .from(characters)
    .where(
      and(
        eq(characters.id, id),
        eq(characters.userId, userId),
        isNull(characters.deletedAt),
      ),
    );
  return rows[0] ?? null;
}

// Läsning för en "viewer": ägaren ELLER kampanjens DM. Returnerar karaktären med
// flaggan viewerIsDm (true = DM som inte äger karaktären) för DM-läget på bladet.
export async function getCharacterForViewer(id: number, userId: string) {
  const rows = await db
    .select({ character: characters, campaignOwnerId: campaigns.userId })
    .from(characters)
    .leftJoin(campaigns, eq(characters.campaignId, campaigns.id))
    .where(and(eq(characters.id, id), isNull(characters.deletedAt)));
  const row = rows[0];
  if (!row) return null;
  const isOwner = row.character.userId === userId;
  const isDm = row.campaignOwnerId != null && row.campaignOwnerId === userId;
  if (!isOwner && !isDm) return null;
  return { ...row.character, viewerIsDm: isDm && !isOwner };
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
) {
  // Reject attaching to a campaign the user isn't a member/owner of (#3).
  if (!(await userCanAttachToCampaign(campaignId, userId))) return null;
  const defaultData: CharacterData = CharacterDataSchema.parse({});
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
}

export async function updateCharacter(
  id: number,
  userId: string,
  updates: {
    name?: string;
    data?: Partial<CharacterData>;
    campaignId?: number | null;
  },
) {
  // Auktorisering: ägaren ELLER kampanjens DM får uppdatera. DM (som inte är ägare)
  // kringgår lås - får redigera låsta sektioner på spelarens vägnar.
  const [existing] = await db
    .select({
      ownerId: characters.userId,
      campaignOwnerId: campaigns.userId,
      raceClassLocked: characters.raceClassLocked,
      attributesLocked: characters.attributesLocked,
      abilitiesLocked: characters.abilitiesLocked,
      data: characters.data,
    })
    .from(characters)
    .leftJoin(campaigns, eq(characters.campaignId, campaigns.id))
    .where(and(eq(characters.id, id), isNull(characters.deletedAt)));
  if (!existing) return null;
  const isOwner = existing.ownerId === userId;
  const isDm = existing.campaignOwnerId != null && existing.campaignOwnerId === userId;
  if (!isOwner && !isDm) return null;
  const bypassLocks = isDm && !isOwner;

  // Reject moving the character into a campaign the caller isn't part of (#3).
  // Applies to both the owner and a DM editing on the player's behalf.
  if (
    updates.campaignId !== undefined &&
    !(await userCanAttachToCampaign(updates.campaignId, userId))
  ) {
    return null;
  }

  let dataToMerge = updates.data;

  if (dataToMerge) {
    dataToMerge = { ...dataToMerge };
    if (!bypassLocks && existing.raceClassLocked) {
      delete dataToMerge.race;
      delete dataToMerge.class;
      delete dataToMerge.religion;
    }
    if (!bypassLocks && existing.attributesLocked) {
      delete dataToMerge.attributes;
    }
    if (!bypassLocks && existing.abilitiesLocked) {
      delete dataToMerge.skills;
      delete dataToMerge.spells;
    }

    // Merge attribute/skill values with existing data
    if (dataToMerge.attributes || dataToMerge.skills) {
      const existingData = existing.data as Record<string, unknown>;
      if (dataToMerge.attributes) {
        dataToMerge.attributes = {
          ...(existingData.attributes as Record<string, number> ?? {}),
          ...(dataToMerge.attributes as Record<string, number>),
        } as CharacterData["attributes"];
      }
      if (dataToMerge.skills) {
        dataToMerge.skills = {
          ...(existingData.skills as Record<string, number> ?? {}),
          ...(dataToMerge.skills as Record<string, number>),
        } as CharacterData["skills"];
      }
    }
  }

  const setClause: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (updates.name !== undefined) {
    setClause.name = updates.name;
  }
  if (updates.campaignId !== undefined) {
    setClause.campaignId = updates.campaignId;
  }
  if (dataToMerge && Object.keys(dataToMerge).length > 0) {
    setClause.data = sql`${characters.data} || ${JSON.stringify(dataToMerge)}::jsonb`;
  }

  const rows = await db
    .update(characters)
    .set(setClause)
    .where(and(eq(characters.id, id), isNull(characters.deletedAt)))
    .returning();

  return rows[0] ?? null;
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

export async function restoreCharacter(id: number, userId: string) {
  const rows = await db
    .update(characters)
    .set({ deletedAt: null, updatedAt: new Date() })
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
    .set({ [field]: locked, updatedAt: new Date() })
    .where(and(eq(characters.id, id), eq(characters.userId, userId), isNull(characters.deletedAt)))
    .returning();

  return rows[0] ?? null;
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
  const existing = await getCharacterById(id, userId);
  if (!existing) return null;

  const attrDeltas = Object.fromEntries(
    Object.entries(deltas.attributes ?? {}).filter(([, v]) => typeof v === "number" && v > 0),
  ) as Record<string, number>;
  const skillDeltas = Object.fromEntries(
    Object.entries(deltas.skills ?? {}).filter(([, v]) => typeof v === "number" && v > 0),
  ) as Record<string, number>;

  const pointsToAdd =
    Object.values(attrDeltas).reduce((s, v) => s + v, 0) +
    Object.values(skillDeltas).reduce((s, v) => s + v, 0);
  if (pointsToAdd < 1) return null;

  const xpPerPoint = await getXpPerPoint();
  const available = Math.floor((existing.xp - existing.xpSpent) / xpPerPoint);
  if (pointsToAdd > available) return null;

  const data = existing.data as Record<string, unknown>;
  const newAttributes = { ...((data.attributes as Record<string, number>) ?? {}) };
  for (const [k, v] of Object.entries(attrDeltas)) newAttributes[k] = (newAttributes[k] ?? 0) + v;
  const newSkills = { ...((data.skills as Record<string, number>) ?? {}) };
  for (const [k, v] of Object.entries(skillDeltas)) newSkills[k] = (newSkills[k] ?? 0) + v;

  const patch = { attributes: newAttributes, skills: newSkills };

  const rows = await db
    .update(characters)
    .set({
      data: sql`${characters.data} || ${JSON.stringify(patch)}::jsonb`,
      xpSpent: existing.xpSpent + pointsToAdd * xpPerPoint,
      updatedAt: new Date(),
    })
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
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
    .set({ xp: sql`${characters.xp} + ${amount}`, updatedAt: new Date() })
    .where(eq(characters.id, characterId))
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

export async function dmGiveItem(
  characterId: number,
  dmUserId: string,
  campaignId: number,
  item: { name: string; description: string; sessionName?: string },
) {
  const char = await verifyDmOwnsCharacter(characterId, dmUserId, campaignId);
  if (!char) return null;

  const data = char.data as Record<string, unknown>;
  const questItems = Array.isArray(data.questItems) ? data.questItems : [];
  // Dedup på namn: ett item ges bara en gång (idempotent - hindrar staplade kopior vid
  // dubbelklick och gör backfillen omkörningsbar). SSoT för "hur ett item blir en karaktärs item".
  const exists = questItems.some((i) => (i as { name?: string })?.name === item.name);
  const patch = { questItems: exists ? questItems : [...questItems, item] };

  const rows = await db
    .update(characters)
    .set({ data: sql`${characters.data} || ${JSON.stringify(patch)}::jsonb`, updatedAt: new Date() })
    .where(eq(characters.id, characterId))
    .returning();
  return rows[0] ?? null;
}

export async function dmRemoveItem(characterId: number, dmUserId: string, campaignId: number, itemName: string) {
  const char = await verifyDmOwnsCharacter(characterId, dmUserId, campaignId);
  if (!char) return null;

  const data = char.data as Record<string, unknown>;
  const questItems = Array.isArray(data.questItems) ? data.questItems : [];
  const filtered = questItems.filter((i: Record<string, unknown>) => i.name !== itemName);
  const patch = { questItems: filtered };

  const rows = await db
    .update(characters)
    .set({ data: sql`${characters.data} || ${JSON.stringify(patch)}::jsonb`, updatedAt: new Date() })
    .where(eq(characters.id, characterId))
    .returning();
  return rows[0] ?? null;
}

export async function dmGiveEquipment(
  characterId: number,
  dmUserId: string,
  campaignId: number,
  equipment: Record<string, unknown>,
) {
  const char = await verifyDmOwnsCharacter(characterId, dmUserId, campaignId);
  if (!char) return null;

  const data = char.data as Record<string, unknown>;
  const dmEquipment = Array.isArray(data.dmEquipment) ? data.dmEquipment : [];
  // Dedup på namn (samma idempotens-regel som dmGiveItem).
  const exists = dmEquipment.some((e) => (e as { name?: string })?.name === (equipment as { name?: string }).name);
  const patch = { dmEquipment: exists ? dmEquipment : [...dmEquipment, equipment] };

  const rows = await db
    .update(characters)
    .set({ data: sql`${characters.data} || ${JSON.stringify(patch)}::jsonb`, updatedAt: new Date() })
    .where(eq(characters.id, characterId))
    .returning();
  return rows[0] ?? null;
}

export async function dmRemoveEquipment(characterId: number, dmUserId: string, campaignId: number, equipmentName: string) {
  const char = await verifyDmOwnsCharacter(characterId, dmUserId, campaignId);
  if (!char) return null;

  const data = char.data as Record<string, unknown>;
  const dmEquipment = Array.isArray(data.dmEquipment) ? data.dmEquipment : [];
  const filtered = dmEquipment.filter((e: Record<string, unknown>) => e.name !== equipmentName);
  const patch = { dmEquipment: filtered };

  const rows = await db
    .update(characters)
    .set({ data: sql`${characters.data} || ${JSON.stringify(patch)}::jsonb`, updatedAt: new Date() })
    .where(eq(characters.id, characterId))
    .returning();
  return rows[0] ?? null;
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

  const rows = await db
    .update(characters)
    .set(update)
    .where(eq(characters.id, characterId))
    .returning();
  return rows[0] ?? null;
}

export async function dmUpdateHp(characterId: number, dmUserId: string, campaignId: number, hp: number) {
  const char = await verifyDmOwnsCharacter(characterId, dmUserId, campaignId);
  if (!char) return null;

  const charData = char.data as Record<string, unknown>;
  const maxHp = (charData.maxHp as number) ?? 0;
  const clamped = Math.max(0, Math.min(hp, maxHp));
  const patch = { hp: clamped };
  const rows = await db
    .update(characters)
    .set({ data: sql`${characters.data} || ${JSON.stringify(patch)}::jsonb`, updatedAt: new Date() })
    .where(eq(characters.id, characterId))
    .returning();
  return rows[0] ?? null;
}

export async function dmUpdateStats(
  characterId: number,
  dmUserId: string,
  campaignId: number,
  stats: { attributes?: Record<string, number | undefined>; skills?: Record<string, number | undefined> },
) {
  const char = await verifyDmOwnsCharacter(characterId, dmUserId, campaignId);
  if (!char) return null;

  const data = char.data as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if (stats.attributes) {
    const existing = (data.attributes ?? {}) as Record<string, number>;
    const provided = Object.fromEntries(
      Object.entries(stats.attributes).filter(([, v]) => v !== undefined),
    ) as Record<string, number>;
    patch.attributes = { ...existing, ...provided };
  }
  if (stats.skills) {
    const existing = (data.skills ?? {}) as Record<string, number>;
    const provided = Object.fromEntries(
      Object.entries(stats.skills).filter(([, v]) => v !== undefined),
    ) as Record<string, number>;
    patch.skills = { ...existing, ...provided };
  }

  const rows = await db
    .update(characters)
    .set({ data: sql`${characters.data} || ${JSON.stringify(patch)}::jsonb`, updatedAt: new Date() })
    .where(eq(characters.id, characterId))
    .returning();
  return rows[0] ?? null;
}

export async function dmUpdateEquipmentHp(
  characterId: number,
  dmUserId: string,
  campaignId: number,
  equipmentIndex: number,
  hp: number,
) {
  const char = await verifyDmOwnsCharacter(characterId, dmUserId, campaignId);
  if (!char) return null;

  const charData = char.data as Record<string, unknown>;
  const dmEquipment = Array.isArray(charData.dmEquipment) ? [...charData.dmEquipment] : [];
  if (equipmentIndex < 0 || equipmentIndex >= dmEquipment.length) return null;

  const item = dmEquipment[equipmentIndex] as Record<string, unknown>;
  const maxHp = (item.maxHp as number) ?? (item.hp as number) ?? 0;
  dmEquipment[equipmentIndex] = { ...item, hp: Math.max(0, Math.min(hp, maxHp)) };

  const patch = { dmEquipment };
  const rows = await db
    .update(characters)
    .set({ data: sql`${characters.data} || ${JSON.stringify(patch)}::jsonb`, updatedAt: new Date() })
    .where(eq(characters.id, characterId))
    .returning();
  return rows[0] ?? null;
}
