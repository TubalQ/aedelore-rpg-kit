import { z } from "zod";
import { EQUIPMENT_TYPES, RARITIES, bonusesInput } from "../equipment-input.js";

// Session content input schemas shared by import/add/update/delete tools.
// Enum lists mirror the app (src/lib/domain/time.ts, src/lib/schemas/session.ts);
// the MCP is on zod 3 and built separately, so keep them in sync by hand.

export const TIMES_OF_DAY = ["dawn", "morning", "noon", "afternoon", "dusk", "evening", "night"] as const;
export const LINKABLE_TYPES = ["place", "encounter", "npc"] as const;
export const ENCOUNTER_STATUSES = ["planned", "started", "completed"] as const;
export const NPC_STATUSES = ["unused", "used"] as const;
export const ENEMY_STATUSES = ["fighting", "fled", "surrendered", "captured"] as const;
export const DM_NOTE_CATEGORIES = ["plot", "mechanic", "npc", "plan", "reminder"] as const;
export const DEFAULT_DM_NOTE_CATEGORY = "plan";

export const timeEnum = z.enum(TIMES_OF_DAY);
export const linkedTypeEnum = z.enum(LINKABLE_TYPES);
export const dayNumber = z.number().int().min(1);

export const dayOpt = dayNumber
  .optional()
  .describe("Day number (only needed if multiple records share this name)");
export const timeOpt = timeEnum
  .optional()
  .describe("Time of day (only needed if multiple records share this name)");

// Who holds an item: one character name, or several when it is shared. The
// app stores a list; a single name (or "" for nobody) is accepted as before.
export const givenToInput = z
  .union([z.string(), z.array(z.string())])
  .describe("Character name holding it, or a list of names when shared; empty clears it");

// "all" and "dm" are the visibility values, never character names (the app
// refuses them as names). Inside a list they would be ambiguous: ["all"]
// shows the entry to everyone, ["dm"] to nobody but a character called "dm".
const visibilityName = z
  .string()
  .min(1)
  .refine((n) => !["all", "dm"].includes(n.trim().toLowerCase()), {
    message: 'A list holds character names only: use "all" or "dm" on their own, not inside a list',
  });

/** "all" (players), "dm" (hidden) or a list of character names. */
export const visibleToInput = z
  .union([z.enum(["all", "dm"]), z.array(visibilityName).min(1)])
  .describe('Who can see this: "all" (players), "dm" (hidden), or a list of character names');

// An LLM naturally writes "defeated" for a beaten enemy; map common words onto
// the three statuses instead of refusing the call.
export function clampEncounterStatus(raw: unknown): (typeof ENCOUNTER_STATUSES)[number] {
  const s = String(raw ?? "").toLowerCase().trim();
  if ((ENCOUNTER_STATUSES as readonly string[]).includes(s)) return s as (typeof ENCOUNTER_STATUSES)[number];
  if (["defeated", "dead", "slain", "killed", "resolved", "done", "finished", "complete", "cleared", "won"].includes(s))
    return "completed";
  if (["active", "ongoing", "inprogress", "in-progress", "in_progress", "running", "current"].includes(s))
    return "started";
  return "planned";
}

export const encounterStatusInput = z
  .preprocess(clampEncounterStatus, z.enum(ENCOUNTER_STATUSES))
  .describe("planned | started | completed");

// ---------------------------------------------------------------------------
// New content (import_content / add_*)
// ---------------------------------------------------------------------------

export const placeSchema = z.object({
  name: z.string().min(1).describe("Place name"),
  description: z.string().describe("Place description"),
  day: dayNumber.describe("Day number (integer)"),
  time: timeEnum.describe("Time of day"),
  visibleTo: visibleToInput.optional().describe('Who sees it: "all" (default), "dm", or a list of character names'),
});

export const npcSchema = z.object({
  name: z.string().min(1).describe("NPC name"),
  role: z.string().optional().describe("NPC role"),
  description: z.string().optional().describe("NPC description"),
  disposition: z.string().optional().describe("friendly, neutral, or hostile"),
  day: dayNumber.describe("Day number -- MUST match the place day"),
  time: timeEnum.describe("Time of day -- MUST match the place time"),
  plannedLocation: z.string().describe("EXACT name of the place where this NPC is found"),
  visibleTo: visibleToInput.optional().describe('Who sees it: "all" (default), "dm", or a list of character names'),
});

export const enemySchema = z.object({
  name: z.string().min(1).describe("Enemy name"),
  disposition: z.string().optional().default("enemy"),
  role: z
    .string()
    .optional()
    .describe("Warrior, Rogue, Mage, Healer, Ranger, Beast, Civilian, Historian, Other"),
  hp: z.coerce.number().int().min(0).describe("Hit points (integer)"),
  armor: z.string().optional(),
  weapon: z.string().optional(),
  atkBonus: z.string().optional().describe('Attack bonus as string like "+3"'),
  dmg: z.string().optional().describe('Damage like "1d8"'),
  maxHp: z.coerce.number().int().min(0).optional().describe("Max HP (defaults to hp for a new enemy, kept for an existing one)"),
  notes: z.string().optional().describe("DM notes on this enemy (kept when left out)"),
  status: z.enum(ENEMY_STATUSES).optional().describe("fighting (default), fled, surrendered or captured; kept when left out"),
});

export const encounterSchema = z.object({
  name: z.string().min(1).describe("Encounter name"),
  location: z.string().describe("EXACT name of the place where this encounter happens"),
  day: dayNumber.describe("Day number -- MUST match the place day"),
  time: timeEnum.describe("Time of day -- MUST match the place time"),
  status: encounterStatusInput.optional(),
  enemies: z.array(enemySchema).optional().describe("List of enemies with stats"),
  tactics: z.string().optional(),
  loot: z.string().optional().describe("Simple loot only: gold, potions. Story items go in items array."),
  visibleTo: visibleToInput.optional().describe('Who sees it: "all" (default), "dm", or a list of character names'),
});

export const readAloudSchema = z.object({
  title: z.string().min(1).describe("Title for the read-aloud text"),
  text: z.string().describe("The atmospheric text to read aloud"),
  day: dayNumber.describe("Day number -- MUST match linked content day"),
  time: timeEnum.describe("Time of day -- MUST match linked content time"),
  linkedType: linkedTypeEnum.describe("What this text is linked to"),
  linkedTo: z.string().describe("EXACT name of the place, encounter, or NPC"),
  visibleTo: visibleToInput.optional().describe('Who sees it: "all" (default), "dm", or a list of character names'),
});

export const itemSchema = z.object({
  name: z.string().min(1).describe("Item name"),
  description: z.string().describe("Item description"),
  day: dayNumber.describe("Day number -- MUST match the place/encounter day"),
  time: timeEnum.describe("Time of day -- MUST match the place/encounter time"),
  plannedLocation: z.string().describe("EXACT name of the place or encounter where this item is found"),
  visibleTo: visibleToInput.optional().describe('Who sees it: "all" (default), "dm", or a list of character names'),
});

export const equipmentSchema = z.object({
  name: z.string().min(1).max(200).describe("Equipment name"),
  type: z.enum(EQUIPMENT_TYPES).describe("Equipment type"),
  rarity: z.enum(RARITIES).optional().default("common").describe("Rarity tier"),
  description: z.string().max(5000).optional().describe("Equipment description/lore"),
  specialEffect: z.string().max(500).optional().describe("Special effect text"),
  bonuses: bonusesInput,
  baseWeapon: z.string().optional().describe("Base weapon type (for weapons)"),
  atkBonus: z.string().optional().describe("Attack bonus (for weapons)"),
  damage: z.string().optional().describe('Damage dice (for weapons, e.g. "1d8")'),
  range: z.string().optional().describe("Range (for weapons)"),
  breakVal: z.string().optional().describe("Break value (for weapons)"),
  advantage: z.string().optional().describe("Advantage condition (for weapons)"),
  baseArmor: z.string().optional().describe("Base armor type (for armor)"),
  bodypart: z.string().optional().describe("Body part, e.g. head, chest, feet (for armor)"),
  hp: z.number().int().min(0).optional().describe("HP value (for armor/shield)"),
  ac: z.number().int().min(0).optional().describe("AC value (for armor/shield)"),
  disadvantage: z.string().optional().describe("Disadvantage condition (for armor)"),
  day: dayNumber.optional().describe("Day number"),
  time: timeEnum.optional().describe("Time of day"),
  visibleTo: visibleToInput.optional().describe('Who sees it: "dm" (default for equipment), "all", or a list of character names'),
});

// ---------------------------------------------------------------------------
// Patches (update_*): typed and strict, so a wrong type or an unknown field is
// a clear tool error instead of a value stored in the session.
// ---------------------------------------------------------------------------

const common = {
  day: dayNumber.optional(),
  time: timeEnum.optional(),
  notes: z.string().optional(),
  visibleTo: visibleToInput.optional(),
};

export const placePatch = z
  .object({ description: z.string().optional(), visited: z.boolean().optional(), ...common })
  .strict();

export const npcPatch = z
  .object({
    role: z.string().optional(),
    description: z.string().optional(),
    disposition: z.string().optional(),
    plannedLocation: z.string().optional(),
    actualLocation: z.string().optional(),
    status: z.enum(NPC_STATUSES).optional(),
    ...common,
  })
  .strict();

export const encounterPatch = z
  .object({
    location: z.string().optional(),
    tactics: z.string().optional(),
    loot: z.string().optional(),
    status: encounterStatusInput.optional(),
    enemies: z.array(enemySchema).optional().describe("Replaces the whole enemy list"),
    ...common,
  })
  .strict();

export const itemPatch = z
  .object({
    description: z.string().optional(),
    plannedLocation: z.string().optional(),
    actualLocation: z.string().optional(),
    found: z.boolean().optional(),
    givenTo: givenToInput.optional(),
    ...common,
  })
  .strict();

export const readAloudPatch = z
  .object({
    text: z.string().optional(),
    read: z.boolean().optional(),
    linkedType: linkedTypeEnum.optional(),
    linkedTo: z.string().optional(),
    day: dayNumber.optional(),
    time: timeEnum.optional(),
    visibleTo: visibleToInput.optional(),
  })
  .strict();

export const equipmentPatch = equipmentSchema
  .omit({ name: true })
  .partial()
  .extend({ givenTo: givenToInput.optional(), plannedLocation: z.string().optional(), ...common })
  .strict();
