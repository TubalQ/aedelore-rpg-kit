import { z } from "zod";

// Mirrors the app's EQUIPMENT_TYPES / RARITIES (src/lib/schemas/character.ts).
// The MCP is built separately on zod 3, so it cannot import the app schemas
// yet; keep these two lists in sync with the app until they are shared.
export const EQUIPMENT_TYPES = ["weapon", "armor", "shield", "misc"] as const;
export const RARITIES = ["common", "enchanted", "rare", "legendary"] as const;

export interface EquipmentBonus {
  stat: string;
  value: number;
}

/**
 * "+1 Intelligence" -> { stat: "Intelligence", value: 1 }. The app stores
 * bonuses as objects; an unparsable string is reported instead of dropped.
 */
export function parseBonusStrings(raw: readonly string[]): { bonuses: EquipmentBonus[]; invalid: string[] } {
  const bonuses: EquipmentBonus[] = [];
  const invalid: string[] = [];
  for (const entry of raw) {
    const match = entry.trim().match(/^([+-]?\d+)\s+(.+)$/);
    if (match) bonuses.push({ stat: match[2].trim(), value: Number(match[1]) });
    else invalid.push(entry);
  }
  return { bonuses, invalid };
}

export const bonusesInput = z
  .array(z.string())
  .max(10)
  .optional()
  .describe('Stat bonuses, each "+N StatName" (e.g. "+1 Intelligence")');

/** Tool parameters for DM equipment (give_equipment, add_box_equipment). */
export const equipmentToolShape = {
  name: z.string().min(1).max(200).describe("Equipment name"),
  type: z.enum(EQUIPMENT_TYPES).describe("Equipment type"),
  rarity: z.enum(RARITIES).optional().describe("Rarity tier (default common)"),
  description: z.string().max(5000).optional().describe("Description/lore"),
  special_effect: z.string().max(500).optional().describe("Special effect text"),
  bonuses: bonusesInput,
  base_weapon: z.string().optional().describe("Base weapon type (for weapons)"),
  atk_bonus: z.string().optional().describe("Attack bonus (for weapons)"),
  damage: z.string().optional().describe('Damage dice (for weapons, e.g. "1d8")'),
  range: z.string().optional().describe("Range (for weapons)"),
  break_val: z.string().optional().describe("Break value (for weapons)"),
  advantage: z.string().optional().describe("Advantage condition (for weapons)"),
  base_armor: z.string().optional().describe("Base armor type (for armor)"),
  bodypart: z.string().optional().describe("Body part, e.g. head, chest, feet (for armor)"),
  hp: z.number().int().min(0).optional().describe("HP value (for armor/shield)"),
  ac: z.number().int().min(0).optional().describe("AC value (for armor/shield)"),
  disadvantage: z.string().optional().describe("Disadvantage condition (for armor)"),
};

type EquipmentToolArgs = z.infer<z.ZodObject<typeof equipmentToolShape>>;

/** The app's DmEquipment object from tool args, or the bonus strings that failed to parse. */
export function buildEquipment(
  args: EquipmentToolArgs,
): { ok: true; equipment: Record<string, unknown> } | { ok: false; invalidBonuses: string[] } {
  const { bonuses, invalid } = parseBonusStrings(args.bonuses ?? []);
  if (invalid.length > 0) return { ok: false, invalidBonuses: invalid };

  const optional: Record<string, unknown> = {
    rarity: args.rarity,
    description: args.description,
    specialEffect: args.special_effect,
    bonuses: bonuses.length ? bonuses : undefined,
    baseWeapon: args.base_weapon,
    atkBonus: args.atk_bonus,
    damage: args.damage,
    range: args.range,
    breakVal: args.break_val,
    advantage: args.advantage,
    baseArmor: args.base_armor,
    bodypart: args.bodypart,
    hp: args.hp,
    maxHp: args.hp,
    ac: args.ac,
    disadvantage: args.disadvantage,
  };
  const equipment: Record<string, unknown> = { name: args.name, type: args.type };
  for (const [k, v] of Object.entries(optional)) if (v !== undefined && v !== "") equipment[k] = v;
  return { ok: true, equipment };
}

export const invalidBonusMessage = (invalid: string[]): string =>
  `ERROR: Could not read bonus(es) ${invalid.map((b) => `"${b}"`).join(", ")}. Use "+N StatName", e.g. "+1 Intelligence".`;
