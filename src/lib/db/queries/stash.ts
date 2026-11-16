import { DM_COPY_SUFFIX } from "@/lib/stash/holdings";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { campaignItems, campaigns, characters, gameSessions } from "@/lib/db/schema";
import {
  DmEquipmentSchema,
  QuestItemSchema,
  type CharacterData,
  type DmEquipment,
} from "@/lib/schemas/character";
import {
  SessionEquipmentSchema,
  SessionItemSchema,
  type SessionData,
  type SessionEquipment,
  type SessionItem,
} from "@/lib/schemas/session";
import {
  STASH_KINDS,
  StashEquipmentSchema,
  StashQuestSchema,
  type StashEntry,
  type StashKind,
  type StashPlacement,
  type StashHolder,
  STASH_EQUIPMENT_KEYS,
  defaultPlacementVisibility,
} from "@/lib/schemas/stash";

// ---------------------------------------------------------------------------
// The campaign stash (förråd): one row per item or piece of equipment in
// campaign_items. Sessions place stash entries (items/equipment with stashId)
// and characters hold them (questItems/dmEquipment with stashId). The CONTENT
// (name, description, stats) lives only here; placements and holdings keep a
// copy as a fallback, but every read overlays the stash content, so an edit in
// the stash reaches every session and every character at once.
// ---------------------------------------------------------------------------

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Conn = Db | Tx;

type StashRow = { id: number; kind: StashKind; data: Record<string, unknown> };
export type StashMap = Map<number, StashRow>;

const isKind = (k: string): k is StashKind => (STASH_KINDS as readonly string[]).includes(k);
const norm = (name: string): string => name.trim().toLowerCase();

/** Content fields a session equipment placement takes from its stash entry. */
/** Per-character state kept on a held piece of equipment (not stash content). */
const HOLDER_OWN_KEYS = ["hp", "sessionName"] as const;

export async function verifyDmOwnsCampaign(campaignId: number, userId: string, conn: Conn = db): Promise<boolean> {
  const rows = await conn
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId), isNull(campaigns.deletedAt)));
  return rows.length > 0;
}

export async function getStashMap(campaignId: number, conn: Conn = db): Promise<StashMap> {
  const rows = await conn
    .select({ id: campaignItems.id, kind: campaignItems.kind, data: campaignItems.data })
    .from(campaignItems)
    .where(eq(campaignItems.campaignId, campaignId));
  const map: StashMap = new Map();
  for (const r of rows) if (isKind(r.kind)) map.set(r.id, { id: r.id, kind: r.kind, data: r.data });
  return map;
}

/** Stash maps for several campaigns in one query (lists across campaigns). */
export async function getStashMaps(campaignIds: number[]): Promise<Map<number, StashMap>> {
  const out = new Map<number, StashMap>();
  const ids = [...new Set(campaignIds)];
  if (ids.length === 0) return out;
  const rows = await db
    .select({ id: campaignItems.id, campaignId: campaignItems.campaignId, kind: campaignItems.kind, data: campaignItems.data })
    .from(campaignItems)
    .where(inArray(campaignItems.campaignId, ids));
  for (const id of ids) out.set(id, new Map());
  for (const r of rows) if (isKind(r.kind)) out.get(r.campaignId)?.set(r.id, { id: r.id, kind: r.kind, data: r.data });
  return out;
}

// ---------------------------------------------------------------------------
// Reading: overlay stash content on placements and holdings
// ---------------------------------------------------------------------------

function questContent(row: StashRow): { name: string; description: string } | null {
  const parsed = StashQuestSchema.safeParse(row.data);
  return parsed.success ? { name: parsed.data.name, description: parsed.data.description } : null;
}

function equipmentContent(row: StashRow): Record<string, unknown> | null {
  const parsed = StashEquipmentSchema.safeParse(row.data);
  return parsed.success ? parsed.data : null;
}

export function hydrateSessionData(data: SessionData, stash: StashMap): SessionData {
  if (stash.size === 0) return data;
  const items = data.items.map((it): SessionItem => {
    const row = it.stashId ? stash.get(it.stashId) : undefined;
    const content = row?.kind === "quest" ? questContent(row) : null;
    return content ? { ...it, ...content } : it;
  });
  const equipment = data.equipment.map((eq): SessionEquipment => {
    const row = eq.stashId ? stash.get(eq.stashId) : undefined;
    const content = row?.kind === "equipment" ? equipmentContent(row) : null;
    if (!content) return eq;
    // Missing optional stash fields fall back to the placement schema defaults.
    const blank = Object.fromEntries(STASH_EQUIPMENT_KEYS.map((k) => [k, undefined]));
    return SessionEquipmentSchema.parse({ ...eq, ...blank, ...content, stashId: eq.stashId });
  });
  return { ...data, items, equipment };
}

export function hydrateCharacterData(data: CharacterData, stash: StashMap): CharacterData {
  if (stash.size === 0) return data;
  const quest = <T extends { stashId?: number; name: string; description: string }>(q: T): T => {
    const row = q.stashId ? stash.get(q.stashId) : undefined;
    const content = row?.kind === "quest" ? questContent(row) : null;
    return content ? { ...q, ...content } : q;
  };
  const dmEquipment = data.dmEquipment.map((e): DmEquipment => {
    const row = e.stashId ? stash.get(e.stashId) : undefined;
    const content = row?.kind === "equipment" ? equipmentContent(row) : null;
    if (!content) return e;
    const own = Object.fromEntries(HOLDER_OWN_KEYS.filter((k) => e[k] !== undefined).map((k) => [k, e[k]]));
    const parsed = DmEquipmentSchema.safeParse({ ...content, ...own, stashId: e.stashId });
    return parsed.success ? parsed.data : e;
  });
  // An equipped copy of DM equipment carries its stash id (C5): its name
  // follows a rename in the stash, as its bonuses already do.
  const named = <T extends { name: string; stashId?: number }>(c: T): T => {
    const row = c.stashId ? stash.get(c.stashId) : undefined;
    const content = row?.kind === "equipment" ? equipmentContent(row) : null;
    const name = content && typeof content.name === "string" ? `${content.name}${DM_COPY_SUFFIX}` : null;
    return name && name !== c.name ? { ...c, name } : c;
  };
  return {
    ...data,
    questItems: data.questItems.map(quest),
    questItemsArchived: data.questItemsArchived.map(quest),
    dmEquipment,
    equippedWeapons: data.equippedWeapons.map(named),
    equippedArmor: data.equippedArmor.map(named),
    equippedShield: data.equippedShield ? named(data.equippedShield) : data.equippedShield,
  };
}

// ---------------------------------------------------------------------------
// Writing: every item/equipment that reaches a session or a character is a
// stash entry. Content edited through a placement is written to the stash
// entry. A new card in a session always gets its own entry (S2): reusing an
// existing one is an explicit choice, made with "Take from the stash", which
// places it by id. Linking by name here caught a card while its name was being
// typed ("Svärd" on the way to "Svärdet av Kael"), and the next save wrote the
// new card over the existing entry everywhere it was placed.
// ---------------------------------------------------------------------------

async function createEntry(
  conn: Conn,
  campaignId: number,
  kind: StashKind,
  content: Record<string, unknown>,
  stash: StashMap,
): Promise<number> {
  const [row] = await conn
    .insert(campaignItems)
    .values({ campaignId, kind, data: content })
    .returning({ id: campaignItems.id });
  stash.set(row.id, { id: row.id, kind, data: content });
  return row.id;
}

/**
 * Finds the entry by name, else creates it. Only for hand-overs to a character
 * (resolveStashId), which never write content back to the entry.
 */
async function findOrCreate(
  conn: Conn,
  campaignId: number,
  kind: StashKind,
  content: Record<string, unknown>,
  stash: StashMap,
): Promise<number> {
  const name = typeof content.name === "string" ? norm(content.name) : "";
  for (const row of stash.values()) {
    if (row.kind === kind && typeof row.data.name === "string" && norm(row.data.name) === name) return row.id;
  }
  return createEntry(conn, campaignId, kind, content, stash);
}

async function writeThrough(conn: Conn, row: StashRow, content: Record<string, unknown>): Promise<void> {
  const merged = { ...row.data, ...content };
  if (JSON.stringify(merged) === JSON.stringify(row.data)) return;
  await conn
    .update(campaignItems)
    .set({ data: merged, updatedAt: new Date() })
    .where(eq(campaignItems.id, row.id));
  row.data = merged;
}

/**
 * Links the items/equipment in a (sanitised) session data patch to the stash
 * and returns the patch with stashIds set. Called inside the session update.
 */
export async function linkSessionPatch(
  conn: Conn,
  campaignId: number,
  patch: Record<string, unknown>,
  stored: unknown = {},
): Promise<Record<string, unknown>> {
  if (!Array.isArray(patch.items) && !Array.isArray(patch.equipment)) return patch;
  const stash = await getStashMap(campaignId, conn);
  const out = { ...patch };
  // S8: a card's content is written to its stash entry only when it changed
  // since this session last stored it, i.e. it was edited in this editor. Every
  // save used to write every card back, so a second placement of the same
  // entry, or an editor that had not seen an edit made on the stash page,
  // wrote old text back over the entry.
  const before = typeof stored === "object" && stored !== null ? (stored as Record<string, unknown>) : {};
  const storedCards = (key: "items" | "equipment"): Record<string, unknown>[] =>
    Array.isArray(before[key]) ? (before[key] as Record<string, unknown>[]) : [];
  const changedSince = (key: "items" | "equipment", stashId: number, content: Record<string, unknown>): boolean => {
    const copies = storedCards(key).filter((c) => c.stashId === stashId);
    if (copies.length === 0) return true;
    return !copies.some((c) => Object.entries(content).every(([k, v]) => JSON.stringify(c[k] ?? null) === JSON.stringify(v ?? null)));
  };

  if (Array.isArray(patch.items)) {
    out.items = [];
    for (const raw of patch.items as SessionItem[]) {
      const it = SessionItemSchema.parse(raw);
      if (!it.name.trim()) {
        (out.items as SessionItem[]).push({ ...it, stashId: null });
        continue;
      }
      const content = { name: it.name.trim(), description: it.description };
      const row = it.stashId ? stash.get(it.stashId) : undefined;
      let stashId: number;
      if (row && row.kind === "quest") {
        if (changedSince("items", row.id, content)) await writeThrough(conn, row, content);
        stashId = row.id;
      } else {
        stashId = await createEntry(conn, campaignId, "quest", content, stash);
      }
      (out.items as SessionItem[]).push({ ...it, stashId });
    }
  }

  if (Array.isArray(patch.equipment)) {
    out.equipment = [];
    for (const raw of patch.equipment as SessionEquipment[]) {
      const eq = SessionEquipmentSchema.parse(raw);
      if (!eq.name.trim()) {
        (out.equipment as SessionEquipment[]).push({ ...eq, stashId: null });
        continue;
      }
      const parsed = StashEquipmentSchema.safeParse(
        Object.fromEntries(STASH_EQUIPMENT_KEYS.map((k) => [k, eq[k]])),
      );
      if (!parsed.success) {
        (out.equipment as SessionEquipment[]).push(eq);
        continue;
      }
      // A card saved before the card set maxHp with its HP: the HP is the max.
      if (!parsed.data.maxHp && parsed.data.hp) parsed.data.maxHp = parsed.data.hp;
      const row = eq.stashId ? stash.get(eq.stashId) : undefined;
      let stashId: number;
      if (row && row.kind === "equipment") {
        if (changedSince("equipment", row.id, parsed.data)) await writeThrough(conn, row, parsed.data);
        stashId = row.id;
      } else {
        stashId = await createEntry(conn, campaignId, "equipment", parsed.data, stash);
      }
      (out.equipment as SessionEquipment[]).push({ ...eq, stashId });
    }
  }
  return out;
}

/** The stash entry an item/equipment handed to a character belongs to (found by id, then name, else created). */
export async function resolveStashId(
  campaignId: number,
  kind: StashKind,
  content: Record<string, unknown>,
  stashId?: number,
): Promise<number> {
  const stash = await getStashMap(campaignId);
  if (stashId) {
    const row = stash.get(stashId);
    if (row && row.kind === kind) return row.id;
  }
  const clean = kind === "quest" ? StashQuestSchema.parse(content) : StashEquipmentSchema.parse(content);
  return findOrCreate(db, campaignId, kind, clean, stash);
}

// ---------------------------------------------------------------------------
// The stash as a list, with where each entry is (DM view)
// ---------------------------------------------------------------------------

export async function listStash(campaignId: number): Promise<StashEntry[]> {
  const rows = await db
    .select()
    .from(campaignItems)
    .where(eq(campaignItems.campaignId, campaignId))
    .orderBy(campaignItems.sortOrder, campaignItems.id);

  const placements = new Map<number, StashPlacement[]>();
  const holders = new Map<number, StashHolder[]>();
  const push = <T>(m: Map<number, T[]>, id: number | null | undefined, v: T) => {
    if (!id) return;
    const list = m.get(id) ?? [];
    list.push(v);
    m.set(id, list);
  };

  const sessions = await db
    .select({ id: gameSessions.id, number: gameSessions.sessionNumber, title: gameSessions.title, data: gameSessions.data })
    .from(gameSessions)
    .where(and(eq(gameSessions.campaignId, campaignId), isNull(gameSessions.deletedAt)));
  for (const s of sessions) {
    const d = s.data as Partial<Record<"items" | "equipment", unknown[]>>;
    for (const key of ["items", "equipment"] as const) {
      for (const raw of d[key] ?? []) {
        const p = (key === "items" ? SessionItemSchema : SessionEquipmentSchema).safeParse(raw);
        if (!p.success) continue;
        push(placements, p.data.stashId, {
          sessionId: s.id,
          sessionNumber: s.number,
          sessionTitle: s.title ?? "",
          plannedLocation: p.data.plannedLocation,
          day: p.data.day,
          time: p.data.time,
          found: key === "items" ? (p.data as SessionItem).found : null,
          givenTo: p.data.givenTo,
          visibleTo: p.data.visibleTo,
        });
      }
    }
  }

  const chars = await db
    .select({ id: characters.id, name: characters.name, data: characters.data })
    .from(characters)
    .where(and(eq(characters.campaignId, campaignId), isNull(characters.deletedAt)));
  for (const c of chars) {
    const d = c.data as Partial<Record<"questItems" | "questItemsArchived" | "dmEquipment", unknown[]>>;
    for (const [key, archived] of [["questItems", false], ["questItemsArchived", true], ["dmEquipment", false]] as const) {
      for (const raw of d[key] ?? []) {
        const id = (raw as { stashId?: unknown })?.stashId;
        if (typeof id === "number") push(holders, id, { characterId: c.id, characterName: c.name, archived });
      }
    }
  }

  return rows
    .filter((r): r is typeof r & { kind: StashKind } => isKind(r.kind))
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      data: r.data,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      placements: placements.get(r.id) ?? [],
      holders: holders.get(r.id) ?? [],
    }));
}

export async function createStashEntry(campaignId: number, kind: StashKind, data: Record<string, unknown>) {
  const [row] = await db.insert(campaignItems).values({ campaignId, kind, data }).returning();
  return row;
}

export async function updateStashEntry(campaignId: number, stashId: number, data: Record<string, unknown>) {
  const rows = await db
    .update(campaignItems)
    .set({ data, updatedAt: new Date() })
    .where(and(eq(campaignItems.id, stashId), eq(campaignItems.campaignId, campaignId)))
    .returning();
  return rows[0] ?? null;
}

export async function getStashEntry(campaignId: number, stashId: number) {
  const rows = await db
    .select()
    .from(campaignItems)
    .where(and(eq(campaignItems.id, stashId), eq(campaignItems.campaignId, campaignId)));
  const row = rows[0];
  return row && isKind(row.kind) ? { ...row, kind: row.kind } : null;
}

/** Deletes an entry that is placed nowhere and held by no one (else "in_use"). */
export async function deleteStashEntry(campaignId: number, stashId: number): Promise<"deleted" | "not_found" | "in_use"> {
  const entry = (await listStash(campaignId)).find((e) => e.id === stashId);
  if (!entry) return "not_found";
  if (entry.placements.length > 0 || entry.holders.length > 0) return "in_use";
  await db.delete(campaignItems).where(and(eq(campaignItems.id, stashId), eq(campaignItems.campaignId, campaignId)));
  return "deleted";
}

/** Places a stash entry in a session of the same campaign (appended atomically). */
export async function placeStashEntry(
  campaignId: number,
  stashId: number,
  placement: {
    sessionId: number;
    plannedLocation: string;
    day: string | null;
    time: string | null;
    visibleTo?: string | string[];
    notes: string;
  },
): Promise<"placed" | "not_found" | "locked"> {
  const entry = await getStashEntry(campaignId, stashId);
  if (!entry) return "not_found";
  const [session] = await db
    .select({ id: gameSessions.id, status: gameSessions.status })
    .from(gameSessions)
    .where(and(eq(gameSessions.id, placement.sessionId), eq(gameSessions.campaignId, campaignId), isNull(gameSessions.deletedAt)));
  if (!session) return "not_found";
  if (session.status === "locked") return "locked";

  const key = entry.kind === "quest" ? "items" : "equipment";
  placement = { ...placement, visibleTo: placement.visibleTo ?? defaultPlacementVisibility(entry.kind) };
  const element =
    entry.kind === "quest"
      ? SessionItemSchema.parse({ ...QuestItemSchema.partial().parse(entry.data), ...placement, stashId })
      : SessionEquipmentSchema.parse({ ...entry.data, ...placement, stashId });
  // S12: the lock and the trash are checked in the UPDATE itself, so a session
  // locked or deleted after the read above is not written to.
  const placed = await db
    .update(gameSessions)
    .set({
      data: sql`jsonb_set(${gameSessions.data}, ${`{${key}}`}::text[], coalesce(${gameSessions.data}->${key}, '[]'::jsonb) || ${JSON.stringify([element])}::jsonb)`,
      updatedAt: new Date(),
    })
    .where(and(eq(gameSessions.id, session.id), ne(gameSessions.status, "locked"), isNull(gameSessions.deletedAt)))
    .returning({ id: gameSessions.id });
  return placed.length > 0 ? "placed" : "locked";
}
