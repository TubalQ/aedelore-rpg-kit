import { z } from "zod";
import { DmEquipmentBonusSchema, EQUIPMENT_TYPES, RARITIES } from "@/lib/schemas/character";
import {
  tolerantArray,
  tolerantBool,
  tolerantEnum,
  tolerantInt,
  tolerantNum,
  tolerantStr,
  tolerantStashId,
  tolerantStrNullable,
  tolerantVisibleTo,
  tolerantNameList,
} from "@/lib/schemas/tolerant";
import { VISIBLE_TO_ALL, VISIBLE_TO_DM, isReservedCharacterName } from "@/lib/schemas/visibility";

// ---------------------------------------------------------------------------
// Session JSONB sub-schemas (stored in game_sessions.data)
// ---------------------------------------------------------------------------

// visibleTo: "all" = synlig för spelare (när entitetens spelvillkor uppfyllts),
// "dm" = dold för alla spelare, string[] = synlig för namngivna karaktärer.
export { VISIBLE_TO_ALL, VISIBLE_TO_DM };

export function isDmOnly(visibleTo: string | string[]): boolean {
  return visibleTo === VISIBLE_TO_DM;
}

/**
 * Whether a player whose character is `characterName` may see an entry. A
 * player with no character (null/"") only sees entries shared with everyone:
 * an empty name must never match an empty or unset field. Neither may a
 * reserved name: a character called "dm" would otherwise match entries
 * hidden from players (names are refused on create/rename too; this holds
 * whatever got stored).
 */
export function isVisibleTo(visibleTo: string | string[], characterName: string | null): boolean {
  if (visibleTo === VISIBLE_TO_ALL) return true;
  if (Array.isArray(visibleTo) && visibleTo.includes(VISIBLE_TO_ALL)) return true;
  if (!characterName || isReservedCharacterName(characterName)) return false;
  return Array.isArray(visibleTo) ? visibleTo.includes(characterName) : visibleTo === characterName;
}

/** Whether an item/equipment entry was handed to this character (never true for no character). */
export function isGivenTo(givenTo: readonly string[], characterName: string | null): boolean {
  return !!characterName && givenTo.includes(characterName);
}

/** The kinds of prep content the session editor adds, links and removes. */
export const CONTENT_KINDS = ["place", "encounter", "npc", "item", "equipment", "readAloud"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const NPC_STATUSES = ["unused", "used"] as const;
export const ENCOUNTER_STATUSES = ["planned", "started", "completed"] as const;
// An enemy out of the fight without dying (#71). Defeated stays HP 0.
export const ENEMY_STATUSES = ["fighting", "fled", "surrendered", "captured"] as const;
export const DM_NOTE_CATEGORIES = ["plot", "mechanic", "npc", "plan", "reminder"] as const;
export const DEFAULT_DM_NOTE_CATEGORY = "plan" satisfies DmNoteCategory;

export type NpcStatus = (typeof NPC_STATUSES)[number];
export type EncounterStatus = (typeof ENCOUNTER_STATUSES)[number];
export type EnemyStatus = (typeof ENEMY_STATUSES)[number];
export type DmNoteCategory = (typeof DM_NOTE_CATEGORIES)[number];

// game_sessions.data is parsed on every read and one session is part of the
// campaign's session list, so every field is tolerant (see ./tolerant.ts): a
// bad stored value degrades to its default instead of 500ing the read path.
// The same schemas normalise writes (sanitizeDataPatch in the PUT route).

const SessionNpcSchema = z.object({
  name: tolerantStr(),
  role: tolerantStr(),
  description: tolerantStr(),
  plannedLocation: tolerantStr(),
  actualLocation: tolerantStr(),
  disposition: tolerantStr(),
  status: tolerantEnum(NPC_STATUSES, "unused"),
  day: tolerantStrNullable,
  time: tolerantStrNullable,
  notes: tolerantStr(),
  visibleTo: tolerantVisibleTo(VISIBLE_TO_ALL),
});

export type SessionNpc = z.infer<typeof SessionNpcSchema>;

const SessionPlaceSchema = z.object({
  name: tolerantStr(),
  description: tolerantStr(),
  visited: tolerantBool(),
  day: tolerantStrNullable,
  time: tolerantStrNullable,
  notes: tolerantStr(),
  visibleTo: tolerantVisibleTo(VISIBLE_TO_ALL),
});

export type SessionPlace = z.infer<typeof SessionPlaceSchema>;

// role/armor/weapon/atkBonus/dmg/disposition are written by the MCP prep tools
// and shown on the encounter card; they were previously stripped on read and
// lost on the next save from the web.
const EncounterEnemySchema = z.object({
  name: tolerantStr(),
  hp: tolerantInt,
  maxHp: tolerantInt,
  role: tolerantStr(),
  disposition: tolerantStr(),
  armor: tolerantStr(),
  weapon: tolerantStr(),
  atkBonus: tolerantStr(),
  dmg: tolerantStr(),
  notes: tolerantStr(),
  status: tolerantEnum(ENEMY_STATUSES, "fighting"),
});

export type EncounterEnemy = z.infer<typeof EncounterEnemySchema>;

const SessionEncounterSchema = z.object({
  name: tolerantStr(),
  location: tolerantStr(),
  enemies: tolerantArray(EncounterEnemySchema),
  tactics: tolerantStr(),
  loot: tolerantStr(),
  // A missing status is a new (planned) encounter. An unknown stored value
  // (e.g. "defeated" from an older MCP writer) reads as completed.
  status: z.union([z.undefined().transform(() => "planned" as const), tolerantEnum(ENCOUNTER_STATUSES, "completed")]),
  day: tolerantStrNullable,
  time: tolerantStrNullable,
  notes: tolerantStr(),
  visibleTo: tolerantVisibleTo(VISIBLE_TO_ALL),
});

export type SessionEncounter = z.infer<typeof SessionEncounterSchema>;

// Items and equipment are placements of campaign stash entries: `stashId`
// points at the entry, whose content (name, description, stats) is read from
// the stash. The rest of the fields are about this placement.
export const SessionItemSchema = z.object({
  stashId: tolerantStashId,
  name: tolerantStr(),
  description: tolerantStr(),
  plannedLocation: tolerantStr(),
  actualLocation: tolerantStr(),
  found: tolerantBool(),
  // The characters holding it. One name when handed over, several when shared.
  givenTo: tolerantNameList,
  day: tolerantStrNullable,
  time: tolerantStrNullable,
  notes: tolerantStr(),
  visibleTo: tolerantVisibleTo(VISIBLE_TO_ALL),
});

export type SessionItem = z.infer<typeof SessionItemSchema>;

export const SessionEquipmentSchema = z.object({
  stashId: tolerantStashId,
  name: tolerantStr(),
  type: tolerantEnum(EQUIPMENT_TYPES, "misc"),
  baseWeapon: tolerantStr(),
  atkBonus: tolerantStr(),
  damage: tolerantStr(),
  range: tolerantStr(),
  breakVal: tolerantStr(),
  advantage: tolerantStr(),
  baseArmor: tolerantStr(),
  bodypart: tolerantStr(),
  hp: tolerantNum,
  maxHp: tolerantNum,
  ac: tolerantNum,
  disadvantage: tolerantStr(),
  description: tolerantStr(),
  bonuses: tolerantArray(DmEquipmentBonusSchema),
  specialEffect: tolerantStr(),
  rarity: tolerantEnum(RARITIES, "common"),
  // The characters holding it (see SessionItemSchema).
  givenTo: tolerantNameList,
  plannedLocation: tolerantStr(),
  day: tolerantStrNullable,
  time: tolerantStrNullable,
  notes: tolerantStr(),
  // Loot the DM places is DM-only until explicitly revealed or given to a
  // character - matches how items stay hidden until `found`.
  visibleTo: tolerantVisibleTo(VISIBLE_TO_DM),
});

export type SessionEquipment = z.infer<typeof SessionEquipmentSchema>;

const SessionReadAloudSchema = z.object({
  title: tolerantStr(),
  text: tolerantStr(),
  read: tolerantBool(),
  day: tolerantStrNullable,
  time: tolerantStrNullable,
  linkedType: tolerantStrNullable,
  linkedTo: tolerantStr(),
  visibleTo: tolerantVisibleTo(VISIBLE_TO_ALL),
});

export type SessionReadAloud = z.infer<typeof SessionReadAloudSchema>;

const SessionEventSchema = z.object({
  text: tolerantStr(),
  timestamp: tolerantStr(),
  day: tolerantStrNullable,
  time: tolerantStrNullable,
  linkedType: tolerantStrNullable,
  linkedTo: tolerantStr(),
  visibleTo: tolerantVisibleTo(VISIBLE_TO_ALL),
});

export type SessionEvent = z.infer<typeof SessionEventSchema>;

const SessionTurningPointSchema = z.object({
  description: tolerantStr(),
  consequence: tolerantStr(),
  linkedType: tolerantStrNullable,
  linkedTo: tolerantStr(),
  day: tolerantStrNullable,
  time: tolerantStrNullable,
  visibleTo: tolerantVisibleTo(VISIBLE_TO_ALL),
});

export type SessionTurningPoint = z.infer<typeof SessionTurningPointSchema>;

const SessionDmNoteSchema = z.object({
  timestamp: tolerantStr(),
  text: tolerantStr(),
  category: tolerantEnum(DM_NOTE_CATEGORIES, DEFAULT_DM_NOTE_CATEGORY),
});

export type SessionDmNote = z.infer<typeof SessionDmNoteSchema>;

const EMPTY_SESSION_NOTES = { summary: "", wentWell: "", improve: "", followUp: "" };

const SessionNotesSchema = z
  .object({
    summary: tolerantStr(),
    wentWell: tolerantStr(),
    improve: tolerantStr(),
    followUp: tolerantStr(),
  })
  .catch(EMPTY_SESSION_NOTES);

export type SessionNotes = z.infer<typeof SessionNotesSchema>;

// ---------------------------------------------------------------------------
// Session data (the full JSONB structure)
// ---------------------------------------------------------------------------

export const SessionDataSchema = z.object({
  hook: tolerantStr(),
  prolog: tolerantStr(),
  npcs: tolerantArray(SessionNpcSchema),
  places: tolerantArray(SessionPlaceSchema),
  encounters: tolerantArray(SessionEncounterSchema),
  items: tolerantArray(SessionItemSchema),
  equipment: tolerantArray(SessionEquipmentSchema),
  readAloud: tolerantArray(SessionReadAloudSchema),
  eventLog: tolerantArray(SessionEventSchema),
  turningPoints: tolerantArray(SessionTurningPointSchema),
  dmNotes: tolerantArray(SessionDmNoteSchema),
  sessionNotes: SessionNotesSchema,
});

export type SessionData = z.infer<typeof SessionDataSchema>;

// ---------------------------------------------------------------------------
// API request schemas
// ---------------------------------------------------------------------------

export const CreateSessionSchema = z.object({
  campaignId: z.number().int().positive(),
  title: z.string().max(200).optional().default(""),
  date: z.string().max(50).optional().default(""),
  location: z.string().max(200).optional().default(""),
  gameLocation: z.string().max(200).optional().default(""),
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

export const UpdateSessionSchema = z.object({
  title: z.string().max(200).optional(),
  date: z.string().max(50).optional(),
  location: z.string().max(200).optional(),
  gameLocation: z.string().max(200).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export type SessionRow = {
  id: number;
  campaignId: number;
  userId: string;
  sessionNumber: number;
  title: string | null;
  date: string | null;
  location: string | null;
  gameLocation: string | null;
  status: string;
  data: SessionData;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

// ---------------------------------------------------------------------------
// Factories for new entries. The schema is the single source of defaults, so
// UI code never hand-writes a full empty object that can drift from it.
// ---------------------------------------------------------------------------

export const newNpc = (init: Partial<SessionNpc> = {}): SessionNpc => SessionNpcSchema.parse(init);
export const newPlace = (init: Partial<SessionPlace> = {}): SessionPlace =>
  SessionPlaceSchema.parse(init);
export const newEncounter = (init: Partial<SessionEncounter> = {}): SessionEncounter =>
  SessionEncounterSchema.parse(init);
export const newEnemy = (init: Partial<EncounterEnemy> = {}): EncounterEnemy =>
  EncounterEnemySchema.parse(init);
export const newItem = (init: Partial<SessionItem> = {}): SessionItem => SessionItemSchema.parse(init);
export const newSessionEquipment = (init: Partial<SessionEquipment> = {}): SessionEquipment =>
  SessionEquipmentSchema.parse(init);
export const newReadAloud = (init: Partial<SessionReadAloud> = {}): SessionReadAloud =>
  SessionReadAloudSchema.parse(init);
