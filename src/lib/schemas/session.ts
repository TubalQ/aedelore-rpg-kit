import { z } from "zod";
import { DmEquipmentSchema, DmEquipmentBonusSchema } from "@/lib/schemas/character";

// ---------------------------------------------------------------------------
// Session JSONB sub-schemas (stored in game_sessions.data)
// ---------------------------------------------------------------------------

// visibleTo: "all" = synlig för spelare (när entitetens spelvillkor uppfyllts),
// "dm" = dold för alla spelare, string[] = synlig för namngivna karaktärer.
export const VISIBLE_TO_ALL = "all" as const;
export const VISIBLE_TO_DM = "dm" as const;

export function isDmOnly(visibleTo: string | string[]): boolean {
  return visibleTo === VISIBLE_TO_DM;
}

const NpcStatusEnum = z.enum(["unused", "used"]);
const EncounterStatusEnum = z.enum(["planned", "started", "completed"]);
const DmNoteCategoryEnum = z.enum(["plot", "mechanic", "npc", "plan", "reminder"]);

// Tåliga fält: game_sessions.data lagras ovaliderat (PUT tar z.record), men SessionDataSchema.parse
// körs vid VARJE läsning. En felaktig lagrad typ (t.ex. number där sträng väntas, eller sträng där
// number väntas - som MCP:ns import_content historiskt skrivit) får därför ALDRIG kasta och 500:a
// hela läsvägen. Dessa coercion+catch-hjälpare läker även redan förgiftade sessioner vid läsning.
const tolerantStrNullable = z.union([z.null(), z.coerce.string()]).catch(null);
const tolerantInt = z.coerce.number().int().catch(0);
const tolerantNum = z.coerce.number().catch(0);

const SessionNpcSchema = z.object({
  name: z.string().default(""),
  role: z.string().default(""),
  description: z.string().default(""),
  plannedLocation: z.string().default(""),
  actualLocation: z.string().default(""),
  disposition: z.string().default(""),
  status: NpcStatusEnum.default("unused"),
  day: tolerantStrNullable.default(null),
  time: tolerantStrNullable.default(null),
  notes: z.string().default(""),
  visibleTo: z.union([z.string(), z.array(z.string())]).default("all"),
});

export type SessionNpc = z.infer<typeof SessionNpcSchema>;

const SessionPlaceSchema = z.object({
  name: z.string().default(""),
  description: z.string().default(""),
  visited: z.boolean().default(false),
  day: tolerantStrNullable.default(null),
  time: tolerantStrNullable.default(null),
  notes: z.string().default(""),
  visibleTo: z.union([z.string(), z.array(z.string())]).default("all"),
});

export type SessionPlace = z.infer<typeof SessionPlaceSchema>;

const EncounterEnemySchema = z.object({
  name: z.string().default(""),
  hp: tolerantInt.default(0),
  maxHp: tolerantInt.default(0),
  notes: z.string().default(""),
});

const SessionEncounterSchema = z.object({
  name: z.string().default(""),
  location: z.string().default(""),
  enemies: z.array(EncounterEnemySchema).default([]),
  tactics: z.string().default(""),
  loot: z.string().default(""),
  status: EncounterStatusEnum.default("planned"),
  day: tolerantStrNullable.default(null),
  time: tolerantStrNullable.default(null),
  notes: z.string().default(""),
  visibleTo: z.union([z.string(), z.array(z.string())]).default("all"),
});

export type SessionEncounter = z.infer<typeof SessionEncounterSchema>;

const SessionItemSchema = z.object({
  name: z.string().default(""),
  description: z.string().default(""),
  plannedLocation: z.string().default(""),
  actualLocation: z.string().default(""),
  found: z.boolean().default(false),
  givenTo: z.string().default(""),
  day: tolerantStrNullable.default(null),
  time: tolerantStrNullable.default(null),
  notes: z.string().default(""),
  visibleTo: z.union([z.string(), z.array(z.string())]).default("all"),
});

export type SessionItem = z.infer<typeof SessionItemSchema>;

const SessionEquipmentSchema = DmEquipmentSchema.omit({ sessionName: true }).extend({
  name: z.string().default(""),
  type: z.enum(["weapon", "armor", "shield", "misc"]).default("misc"),
  baseWeapon: z.string().default(""),
  atkBonus: z.string().default(""),
  damage: z.string().default(""),
  range: z.string().default(""),
  breakVal: z.string().default(""),
  advantage: z.string().default(""),
  baseArmor: z.string().default(""),
  bodypart: z.string().default(""),
  hp: tolerantNum.default(0),
  ac: tolerantNum.default(0),
  disadvantage: z.string().default(""),
  description: z.string().default(""),
  bonuses: z.array(DmEquipmentBonusSchema).default([]),
  specialEffect: z.string().default(""),
  rarity: z.string().default("common"),
  givenTo: z.string().default(""),
  plannedLocation: z.string().default(""),
  day: tolerantStrNullable.default(null),
  time: tolerantStrNullable.default(null),
  notes: z.string().default(""),
  // Loot the DM places is DM-only until explicitly revealed or given to a
  // character - matches how items stay hidden until `found`.
  visibleTo: z.union([z.string(), z.array(z.string())]).default("dm"),
});

export type SessionEquipment = z.infer<typeof SessionEquipmentSchema>;

const SessionReadAloudSchema = z.object({
  title: z.string().default(""),
  text: z.string().default(""),
  read: z.boolean().default(false),
  day: tolerantStrNullable.default(null),
  time: tolerantStrNullable.default(null),
  linkedType: tolerantStrNullable.default(null),
  linkedTo: z.string().default(""),
  visibleTo: z.union([z.string(), z.array(z.string())]).default("all"),
});

export type SessionReadAloud = z.infer<typeof SessionReadAloudSchema>;

const SessionEventSchema = z.object({
  text: z.string().default(""),
  timestamp: z.string().default(""),
  day: tolerantStrNullable.default(null),
  time: tolerantStrNullable.default(null),
  linkedType: tolerantStrNullable.default(null),
  linkedTo: z.string().default(""),
  visibleTo: z.union([z.string(), z.array(z.string())]).default("all"),
});

export type SessionEvent = z.infer<typeof SessionEventSchema>;

const SessionTurningPointSchema = z.object({
  description: z.string().default(""),
  consequence: z.string().default(""),
  linkedType: tolerantStrNullable.default(null),
  linkedTo: z.string().default(""),
  day: tolerantStrNullable.default(null),
  time: tolerantStrNullable.default(null),
  visibleTo: z.union([z.string(), z.array(z.string())]).default("all"),
});

export type SessionTurningPoint = z.infer<typeof SessionTurningPointSchema>;

const SessionDmNoteSchema = z.object({
  timestamp: z.string().default(""),
  text: z.string().default(""),
  category: DmNoteCategoryEnum.default("plan"),
});

export type SessionDmNote = z.infer<typeof SessionDmNoteSchema>;

const SessionNotesSchema = z.object({
  summary: z.string().default(""),
  wentWell: z.string().default(""),
  improve: z.string().default(""),
  followUp: z.string().default(""),
});

export type SessionNotes = z.infer<typeof SessionNotesSchema>;

// ---------------------------------------------------------------------------
// Session data (the full JSONB structure)
// ---------------------------------------------------------------------------

export const SessionDataSchema = z.object({
  hook: z.string().default(""),
  prolog: z.string().default(""),
  npcs: z.array(SessionNpcSchema).default([]),
  places: z.array(SessionPlaceSchema).default([]),
  encounters: z.array(SessionEncounterSchema).default([]),
  items: z.array(SessionItemSchema).default([]),
  equipment: z.array(SessionEquipmentSchema).default([]),
  readAloud: z.array(SessionReadAloudSchema).default([]),
  eventLog: z.array(SessionEventSchema).default([]),
  turningPoints: z.array(SessionTurningPointSchema).default([]),
  dmNotes: z.array(SessionDmNoteSchema).default([]),
  sessionNotes: SessionNotesSchema.default({ summary: "", wentWell: "", improve: "", followUp: "" }),
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
