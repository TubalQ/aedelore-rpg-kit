import { z } from "zod";

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

export const QuestItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().catch(""),
  sessionName: z.string().optional(),
});

export const DmEquipmentBonusSchema = z.object({
  stat: z.string().catch(""),
  value: z.coerce.number().catch(0),
});

export const DmEquipmentSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["weapon", "armor", "shield", "misc"]),
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
  bonuses: z.array(DmEquipmentBonusSchema).optional(),
  specialEffect: z.string().optional(),
  rarity: z.string().optional(),
});

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
  bonuses: z.array(DmEquipmentBonusSchema).optional(),
  specialEffect: z.string().optional(),
});

const EquippedArmorSchema = z.object({
  name: z.string().catch(""),
  bodypart: z.string().catch(""),
  ac: z.coerce.number().catch(0),
  hp: z.coerce.number().catch(0),
  maxHp: z.coerce.number().catch(0),
  disadvantage: z.string().nullable().catch(null),
  advantage: z.string().optional(),
  bonuses: z.array(DmEquipmentBonusSchema).optional(),
  specialEffect: z.string().optional(),
});

const EquippedShieldSchema = z.object({
  name: z.string().catch(""),
  ac: z.coerce.number().catch(0),
  hp: z.coerce.number().catch(0),
  maxHp: z.coerce.number().catch(0),
  damage: z.string().catch(""),
  disadvantage: z.string().nullable().catch(null),
  advantage: z.string().optional(),
  bonuses: z.array(DmEquipmentBonusSchema).optional(),
  specialEffect: z.string().optional(),
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
  relation: z.string(),
  notes: z.string().default(""),
  archived: z.boolean().default(false),
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

  spells: z.array(SpellSlotSchema).default([]).catch([]),
  equippedWeapons: z.array(EquippedWeaponSchema).default([]).catch([]),
  equippedArmor: z.array(EquippedArmorSchema).default([]).catch([]),
  equippedShield: EquippedShieldSchema.nullable().default(null).catch(null),

  questItems: z.array(QuestItemSchema).default([]).catch([]),
  questItemsArchived: z.array(QuestItemSchema).default([]).catch([]),
  dmEquipment: z.array(DmEquipmentSchema).default([]).catch([]),
  relationships: z.preprocess(
    (val) => (Array.isArray(val) ? val : []),
    z.array(RelationshipSchema).default([]),
  ).catch([]),
  transformState: TransformStateSchema.default({ active: null, charges: 2, maxCharges: 2, originalData: {} }).catch({ active: null, charges: 2, maxCharges: 2, originalData: {} }),
});

export type CharacterData = z.infer<typeof CharacterDataSchema>;

// ---------------------------------------------------------------------------
// API request schemas
// ---------------------------------------------------------------------------

export const CreateCharacterSchema = z.object({
  name: z.string().min(1, "Karaktärsnamn krävs").max(100),
  campaignId: z.number().int().positive().nullable().default(null),
});

export type CreateCharacterInput = z.infer<typeof CreateCharacterSchema>;

export const UpdateCharacterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  campaignId: z.number().int().positive().nullable().optional(),
});

export type UpdateCharacterInput = z.infer<typeof UpdateCharacterSchema>;

export const LockStepSchema = z.object({
  step: z.enum(["raceClass", "attributes", "abilities"]),
  locked: z.boolean(),
});

export type LockStepInput = z.infer<typeof LockStepSchema>;

// Spending XP raises attributes/skills past the creation cap. The payload
// carries the *deltas* (points to add per field); each point costs XP_PER_POINT.
// Value type is optional so a partial record (e.g. only attributes) validates -
// see CLAUDE.md "z.record med enum-nycklar".
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
  amount: z.number().int(),
});

export type DmGiveXpInput = z.infer<typeof DmGiveXpSchema>;

export const DmResetXpSchema = z.object({
  characterId: z.number().int().positive(),
});

export type DmResetXpInput = z.infer<typeof DmResetXpSchema>;

export const DmGiveItemSchema = z.object({
  characterId: z.number().int().positive(),
  item: QuestItemSchema,
});

export type DmGiveItemInput = z.infer<typeof DmGiveItemSchema>;

export const DmRemoveItemSchema = z.object({
  characterId: z.number().int().positive(),
  itemName: z.string().min(1),
});

export type DmRemoveItemInput = z.infer<typeof DmRemoveItemSchema>;

export const DmGiveEquipmentSchema = z.object({
  characterId: z.number().int().positive(),
  equipment: DmEquipmentSchema,
});

export type DmGiveEquipmentInput = z.infer<typeof DmGiveEquipmentSchema>;

export const DmRemoveEquipmentSchema = z.object({
  characterId: z.number().int().positive(),
  equipmentName: z.string().min(1),
});

export type DmRemoveEquipmentInput = z.infer<typeof DmRemoveEquipmentSchema>;

export const DmSetLocksSchema = z.object({
  characterId: z.number().int().positive(),
  raceClassLocked: z.boolean().optional(),
  attributesLocked: z.boolean().optional(),
  abilitiesLocked: z.boolean().optional(),
});

export type DmSetLocksInput = z.infer<typeof DmSetLocksSchema>;

export const DmUpdateHpSchema = z.object({
  characterId: z.number().int().positive(),
  hp: z.number().int(),
});

export type DmUpdateHpInput = z.infer<typeof DmUpdateHpSchema>;

export const DmUpdateStatsSchema = z.object({
  characterId: z.number().int().positive(),
  attributes: z.record(
    z.string(),
    z.number().int().min(0).optional(),
  ).optional(),
  skills: z.record(
    z.string(),
    z.number().int().min(0).optional(),
  ).optional(),
});

export type DmUpdateStatsInput = z.infer<typeof DmUpdateStatsSchema>;

export const DmUpdateEquipmentHpSchema = z.object({
  characterId: z.number().int().positive(),
  equipmentIndex: z.number().int().min(0),
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
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export type Character = z.infer<typeof CharacterSchema>;
