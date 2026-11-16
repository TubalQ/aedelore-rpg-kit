import { z } from "zod";
import { tolerantArray } from "@/lib/schemas/tolerant";
import { RESERVED_CHARACTER_NAME_MESSAGE, isReservedCharacterName } from "@/lib/schemas/visibility";

// ---------------------------------------------------------------------------
// Race / class / religion AND attribute/skill names are all runtime-editable
// game data (added via the game system editor at /system-admin), so every field
// keyed by them must accept ANY string rather than a build-time frozen z.enum.
// With a frozen enum, an editor-added name would fail validation and, because
// CharacterData uses `.catch(...)`, a character using it would be SILENTLY
// BLANKED on save. (Attribute/skill VALUE maps use z.string() keys below.)
// ---------------------------------------------------------------------------

const RaceEnum = z.string();
const ClassEnum = z.string();
const ReligionEnum = z.string();

// ---------------------------------------------------------------------------
// Sub-schemas for character data
// ---------------------------------------------------------------------------

export const EQUIPMENT_TYPES = ["weapon", "armor", "shield", "misc"] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const RARITIES = ["common", "enchanted", "rare", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

// `stashId` links the copy on a character to its campaign stash entry
// (campaign_items.id): the entry's content is read from the stash, so an edit
// there reaches every character holding it.
export const QuestItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().catch(""),
  sessionName: z.string().optional(),
  stashId: z.number().int().positive().optional().catch(undefined),
});

// A bonus is stored as {stat, value}. Older writers (MCP) sent the display form
// "+1 Intelligence"; that is converted here instead of failing the element.
function bonusFromString(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const match = raw.trim().match(/^([+-]?\d+)\s+(.+)$/);
  return match ? { stat: match[2].trim(), value: Number(match[1]) } : raw;
}

export const DmEquipmentBonusSchema = z.preprocess(
  bonusFromString,
  z.object({
    stat: z.string().catch(""),
    value: z.coerce.number().catch(0),
  }),
);

export type DmEquipmentBonus = z.infer<typeof DmEquipmentBonusSchema>;

export const DmEquipmentSchema = z.object({
  name: z.string().min(1),
  type: z.enum(EQUIPMENT_TYPES).catch("misc"),
  baseWeapon: z.string().optional(),
  atkBonus: z.string().optional(),
  damage: z.string().optional(),
  range: z.string().optional(),
  breakVal: z.string().optional(),
  advantage: z.string().optional(),
  baseArmor: z.string().optional(),
  bodypart: z.string().optional(),
  hp: z.number().optional(),
  maxHp: z.number().optional(),
  ac: z.number().optional(),
  disadvantage: z.string().optional(),
  description: z.string().optional(),
  sessionName: z.string().optional(),
  bonuses: tolerantArray(DmEquipmentBonusSchema).optional(),
  specialEffect: z.string().optional(),
  rarity: z.enum(RARITIES).optional().catch(undefined),
  stashId: z.number().int().positive().optional().catch(undefined),
});

export type DmEquipment = z.infer<typeof DmEquipmentSchema>;
export type QuestItem = z.infer<typeof QuestItemSchema>;

// Härdade fält: migrerad/äldre data kan ha null i obligatoriska tal/strängar. `.catch`
// gör att ett trasigt fält självläker till default i stället för att fälla HELA
// karaktärs-parsningen (som annars gör att bladet renderas tomt - se character-sheet).
const EquippedWeaponSchema = z.object({
  name: z.string().catch(""),
  damage: z.string().catch(""),
  bonus: z.string().catch(""),
  range: z.string().catch(""),
  break: z.coerce.number().catch(0),
  advantage: z.string().optional(),
  disadvantage: z.string().optional(),
  bonuses: tolerantArray(DmEquipmentBonusSchema).optional(),
  specialEffect: z.string().optional(),
  // The DM equipment it was equipped from (C5): bonuses follow the stash
  // entry also after a rename. Copies equipped before this match by name.
  stashId: z.number().int().positive().optional().catch(undefined),
});

const EquippedArmorSchema = z.object({
  name: z.string().catch(""),
  bodypart: z.string().catch(""),
  ac: z.coerce.number().catch(0),
  hp: z.coerce.number().catch(0),
  maxHp: z.coerce.number().catch(0),
  disadvantage: z.string().nullable().catch(null),
  advantage: z.string().optional(),
  bonuses: tolerantArray(DmEquipmentBonusSchema).optional(),
  specialEffect: z.string().optional(),
  // The DM equipment it was equipped from (C5): bonuses follow the stash
  // entry also after a rename. Copies equipped before this match by name.
  stashId: z.number().int().positive().optional().catch(undefined),
});

const EquippedShieldSchema = z.object({
  name: z.string().catch(""),
  ac: z.coerce.number().catch(0),
  hp: z.coerce.number().catch(0),
  maxHp: z.coerce.number().catch(0),
  damage: z.string().catch(""),
  disadvantage: z.string().nullable().catch(null),
  advantage: z.string().optional(),
  bonuses: tolerantArray(DmEquipmentBonusSchema).optional(),
  specialEffect: z.string().optional(),
  // The DM equipment it was equipped from (C5): bonuses follow the stash
  // entry also after a rename. Copies equipped before this match by name.
  stashId: z.number().int().positive().optional().catch(undefined),
});

// Keys are attribute/skill NAMES, which are now live-editable data (not a fixed
// enum). Using z.string() keys (instead of z.enum(ATTRIBUTE_NAMES)) means an
// admin-added attribute never fails validation and blanks the whole map via the
// `.catch({})` on the field - mirrors the race/class/religion R2 fix.
const AttributeValues = z.record(
  z.string(),
  z.number().int().min(0).optional().default(0),
);

const SkillValues = z.record(
  z.string(),
  z.number().int().min(0).optional().default(0),
);

const SpellSlotSchema = z.object({
  name: z.string().catch(""),
  selected: z.boolean().catch(false),
});

const RelationshipSchema = z.object({
  name: z.string().min(1),
  relation: z.string().catch(""),
  notes: z.string().catch(""),
  archived: z.boolean().catch(false),
});

const TransformStateSchema = z.object({
  active: z.string().nullable().default(null),
  charges: z.number().int().min(0).default(2),
  maxCharges: z.number().int().min(0).default(2),
  originalData: z.record(z.string(), z.unknown()).default({}),
});

// ---------------------------------------------------------------------------
// Character data (stored as JSONB in the `characters.data` column)
// ---------------------------------------------------------------------------

export const CharacterDataSchema = z.object({
  // Varje fält har `.catch(default)`: ett trasigt/oväntat värde (t.ex. migrerad data,
  // omdöpt ras, null där ett tal väntas) degraderar då till sitt default i stället för
  // att fälla HELA karaktärs-parsningen → bladet blir aldrig tomt. Tal `.coerce`:as så
  // "24"/null självläker till tal. (Se character-sheet: safeParse-fail → tomma defaults.)
  race: RaceEnum.nullable().default(null).catch(null),
  class: ClassEnum.nullable().default(null).catch(null),
  religion: ReligionEnum.nullable().default(null).catch(null),
  background: z.string().default("").catch(""),
  avatarSeed: z.string().default("").catch(""),
  avatarImage: z.string().default("").catch(""),

  attributes: AttributeValues.default({}).catch({}),
  skills: SkillValues.default({}).catch({}),

  hp: z.coerce.number().int().min(0).default(0).catch(0),
  maxHp: z.coerce.number().int().min(0).default(0).catch(0),
  arcana: z.coerce.number().int().min(0).default(0).catch(0),
  maxArcana: z.coerce.number().int().min(0).default(0).catch(0),
  weakened: z.coerce.number().int().min(0).default(0).catch(0),
  maxWeakened: z.coerce.number().int().min(0).default(0).catch(0),
  willpower: z.coerce.number().int().min(0).default(0).catch(0),
  maxWillpower: z.coerce.number().int().min(0).default(0).catch(0),
  bleed: z.coerce.number().int().min(0).default(0).catch(0),
  worthiness: z.coerce.number().int().default(0).catch(0),
  gold: z.coerce.number().int().min(0).default(0).catch(0),
  food: z.coerce.number().int().min(0).default(0).catch(0),

  // Arrays are parsed per element (tolerantArray): one bad element is dropped
  // instead of blanking the whole list, which the next save would then persist.
  spells: tolerantArray(SpellSlotSchema),
  equippedWeapons: tolerantArray(EquippedWeaponSchema),
  equippedArmor: tolerantArray(EquippedArmorSchema),
  equippedShield: EquippedShieldSchema.nullable().default(null).catch(null),

  questItems: tolerantArray(QuestItemSchema),
  questItemsArchived: tolerantArray(QuestItemSchema),
  dmEquipment: tolerantArray(DmEquipmentSchema),
  relationships: tolerantArray(RelationshipSchema),
  transformState: TransformStateSchema.default({ active: null, charges: 2, maxCharges: 2, originalData: {} }).catch({ active: null, charges: 2, maxCharges: 2, originalData: {} }),
});

export type CharacterData = z.infer<typeof CharacterDataSchema>;

// ---------------------------------------------------------------------------
// API request schemas
// ---------------------------------------------------------------------------

// A character's name is matched against session visibility, where "dm" and
// "all" mean something else (see ./visibility.ts).
const characterName = z
  .string()
  .min(1, "Karaktärsnamn krävs")
  .max(100)
  .refine((name) => !isReservedCharacterName(name), RESERVED_CHARACTER_NAME_MESSAGE);

export const CreateCharacterSchema = z.object({
  name: characterName,
  campaignId: z.number().int().positive().nullable().default(null),
});

export type CreateCharacterInput = z.infer<typeof CreateCharacterSchema>;

export const UpdateCharacterSchema = z.object({
  name: characterName.optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  // What each changed data key was when the caller started changing it: the
  // save is then merged against the stored value instead of overwriting it
  // (mergeAgainstBase, C2).
  base: z.record(z.string(), z.unknown()).optional(),
  campaignId: z.number().int().positive().nullable().optional(),
});

export type UpdateCharacterInput = z.infer<typeof UpdateCharacterSchema>;

export const ApplyRaceClassSchema = z.object({
  race: z.string().min(1),
  class: z.string().min(1),
  religion: z.string().min(1).optional(),
});

export type ApplyRaceClassInput = z.infer<typeof ApplyRaceClassSchema>;

export const LOCK_STEPS = ["raceClass", "attributes", "abilities"] as const;

export const LockStepSchema = z.object({
  step: z.enum(LOCK_STEPS),
  locked: z.boolean(),
});

export type LockStepInput = z.infer<typeof LockStepSchema>;

// Spending XP raises attributes/skills past the creation cap. The payload
// carries the *deltas* (points to add per field); each point costs XP_PER_POINT.
// Value type is optional so a partial record (e.g. only attributes) validates -
// see the project rules "z.record med enum-nycklar".
export const SpendXpSchema = z.object({
  attributes: z.record(
    z.string(),
    z.number().int().min(0).optional(),
  ).optional(),
  skills: z.record(
    z.string(),
    z.number().int().min(0).optional(),
  ).optional(),
});

export type SpendXpInput = z.infer<typeof SpendXpSchema>;

export const DmGiveXpSchema = z.object({
  characterId: z.number().int().positive(),
  // Negative amounts take XP back (e.g. a mistake); the query never lets total
  // XP drop below what the character has already spent.
  amount: z.number().int().min(-10_000).max(10_000).refine((n) => n !== 0, "Amount must not be 0"),
});

export type DmGiveXpInput = z.infer<typeof DmGiveXpSchema>;

export const DmResetXpSchema = z.object({
  characterId: z.number().int().positive(),
});

export type DmResetXpInput = z.infer<typeof DmResetXpSchema>;

// `move`: hand it over, everyone else in the campaign who holds the same
// stash entry loses it. Without it the others keep theirs (shared).
export const DmGiveItemSchema = z.object({
  characterId: z.number().int().positive(),
  item: QuestItemSchema,
  move: z.boolean().optional(),
});

export type DmGiveItemInput = z.infer<typeof DmGiveItemSchema>;

// Taking back matches on the stash entry when `stashId` is given (survives a
// rename in the stash), otherwise on the name.
export const DmRemoveItemSchema = z.object({
  characterId: z.number().int().positive(),
  itemName: z.string().min(1),
  stashId: z.number().int().positive().optional(),
});

export type DmRemoveItemInput = z.infer<typeof DmRemoveItemSchema>;

export const DmGiveEquipmentSchema = z.object({
  characterId: z.number().int().positive(),
  equipment: DmEquipmentSchema,
  move: z.boolean().optional(),
});

export type DmGiveEquipmentInput = z.infer<typeof DmGiveEquipmentSchema>;

export const DmRemoveEquipmentSchema = z.object({
  characterId: z.number().int().positive(),
  equipmentName: z.string().min(1),
  stashId: z.number().int().positive().optional(),
});

export type DmRemoveEquipmentInput = z.infer<typeof DmRemoveEquipmentSchema>;

export const DmSetLocksSchema = z.object({
  characterId: z.number().int().positive(),
  raceClassLocked: z.boolean().optional(),
  attributesLocked: z.boolean().optional(),
  abilitiesLocked: z.boolean().optional(),
});

export type DmSetLocksInput = z.infer<typeof DmSetLocksSchema>;

// Either a new value (hp) or a change (delta). The +/- buttons send a delta,
// counted on the stored value: an absolute value from the button's local copy
// dropped one of two quick clicks and overwrote what the player had changed.
export const DmUpdateHpSchema = z
  .object({
    characterId: z.number().int().positive(),
    hp: z.number().int().optional(),
    delta: z.number().int().optional(),
  })
  .refine((v) => (v.hp === undefined) !== (v.delta === undefined), "Send hp or delta");

export type DmUpdateHpInput = z.infer<typeof DmUpdateHpSchema>;

// The DM changes stats by deltas (see dmAdjustStats): +n raises, -n lowers.
const statDelta = z.number().int().min(-100).max(100);
export const DmAdjustStatsSchema = z.object({
  characterId: z.number().int().positive(),
  attributes: z.record(z.string(), statDelta).optional(),
  skills: z.record(z.string(), statDelta).optional(),
});

export type DmAdjustStatsInput = z.infer<typeof DmAdjustStatsSchema>;

export const DmUpdateEquipmentHpSchema = z.object({
  characterId: z.number().int().positive(),
  equipmentIndex: z.number().int().min(0),
  /** Identifies the piece (C11); the index alone could point at another one. */
  stashId: z.number().int().positive().optional(),
  name: z.string().optional(),
  hp: z.number().int().min(0),
});

export type DmUpdateEquipmentHpInput = z.infer<typeof DmUpdateEquipmentHpSchema>;

// ---------------------------------------------------------------------------
// Full character (row from DB + parsed data)
// ---------------------------------------------------------------------------

export const CharacterSchema = z.object({
  id: z.number().int(),
  userId: z.string().uuid(),
  campaignId: z.number().int().nullable(),
  name: z.string(),
  data: CharacterDataSchema,
  xp: z.number().int(),
  xpSpent: z.number().int(),
  raceClassLocked: z.boolean(),
  attributesLocked: z.boolean(),
  abilitiesLocked: z.boolean(),
  locksDmHeld: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export type Character = z.infer<typeof CharacterSchema>;

/**
 * A character as the API returns it: JSON (dates are ISO strings), `data`
 * already parsed with CharacterDataSchema on the server, plus view fields.
 */
export type CharacterResponse = Omit<Character, "createdAt" | "updatedAt" | "deletedAt"> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** The viewer is the campaign's DM (not the owner): locks are bypassed. */
  viewerIsDm?: boolean;
  /** Name of the campaign the character belongs to (list view). */
  campaignName?: string | null;
};
