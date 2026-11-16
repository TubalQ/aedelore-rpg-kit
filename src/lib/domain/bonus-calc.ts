import type { CharacterData } from "@/lib/schemas/character";
import { parseBonuses, BONUS_NAME_TO_FIELD_ID, getModifier } from "@/lib/domain/attributes";
import { normalizeStatName } from "@/lib/i18n/game-terms";
import { getTransformsForClass } from "@/lib/domain/transforms";
import { RACES } from "@/lib/domain/races";
import type { Race } from "@/lib/domain/races";
import { CLASSES } from "@/lib/domain/classes";
import type { CharacterClass } from "@/lib/domain/classes";
import { RELIGIONS } from "@/lib/domain/religions";
import type { Religion } from "@/lib/domain/religions";

export interface EquipmentBonusItem {
  /** Föremålets namn, t.ex. "Flammande svärd". */
  name: string;
  kind: "weapon" | "armor" | "shield";
  /** Summerat bonusvärde för just denna stat från detta föremål (kan vara negativt). */
  value: number;
}

export interface BonusSources {
  race: number;
  class: number;
  religion: number;
  equipment: number;
  /** Per-föremål-uppdelning av equipment-summan, för visning i builden. */
  equipmentItems: EquipmentBonusItem[];
  distributed: number;
  total: number;
}

/** Stat bonuses from all currently-equipped weapons, armor and shield, per item. */
function equipmentBonusItems(name: string, data: CharacterData): EquipmentBonusItem[] {
  const items: EquipmentBonusItem[] = [];
  // An equipped entry is a copy made when it was equipped. DM equipment is read
  // from the campaign stash, so its bonuses are the current ones: when the
  // equipped item matches DM equipment by name, the DM equipment's bonuses win
  // (also when the DM removed them all). Otherwise the copy's own bonuses count.
  //
  // C6: each piece of DM equipment backs ONE equipped copy. Three weapons
  // given the DM item's name gave its bonuses three times; now the copies past
  // the number the DM handed out count for nothing.
  // C5: a copy equipped with its stash id finds its DM equipment by id, so a
  // rename in the stash keeps the bonuses; older copies match by name.
  type Bonuses = { stat: string; value: number }[];
  type Dm = { bonuses: Bonuses; used: boolean; stashId?: number };
  const dmByName = new Map<string, Dm[]>();
  const dmById = new Map<number, Dm>();
  for (const e of data.dmEquipment) {
    const entry: Dm = { bonuses: Array.isArray(e.bonuses) ? e.bonuses : [], used: false, stashId: e.stashId };
    const list = dmByName.get(e.name) ?? [];
    list.push(entry);
    dmByName.set(e.name, list);
    if (e.stashId != null) dmById.set(e.stashId, entry);
  }
  const resolve = (itemName: string | undefined, own?: Bonuses, stashId?: number): Bonuses | undefined => {
    if (stashId != null && dmById.has(stashId)) {
      const entry = dmById.get(stashId)!;
      if (entry.used) return [];
      entry.used = true;
      return entry.bonuses;
    }
    if (!itemName) return own;
    const key = dmByName.has(itemName) ? itemName : itemName.replace(/ \(DM\)$/, "");
    const list = dmByName.get(key);
    if (!list) return own;
    const free = list.find((d) => !d.used);
    if (!free) return [];
    free.used = true;
    return free.bonuses;
  };
  const add = (
    itemName: string | undefined,
    kind: EquipmentBonusItem["kind"],
    bonuses?: { stat: string; value: number }[],
    stashId?: number,
  ) => {
    const eff = resolve(itemName, bonuses, stashId);
    if (!eff) return;
    let sum = 0;
    // Normaliserad matchning: äldre bonusar har fritext-statnamn ("styrka",
    // gemener, sv/en-blandat) - redan tilldelade föremål ska också gälla.
    for (const b of eff) if ((normalizeStatName(b.stat) ?? b.stat) === name) sum += b.value;
    if (sum !== 0) items.push({ name: itemName || "?", kind, value: sum });
  };
  for (const w of data.equippedWeapons) add(w.name, "weapon", w.bonuses, w.stashId);
  for (const a of data.equippedArmor) add(a.name, "armor", a.bonuses, a.stashId);
  if (data.equippedShield) add(data.equippedShield.name, "shield", data.equippedShield.bonuses, data.equippedShield.stashId);
  return items;
}

export function computeBonusSources(
  name: string,
  distributedValue: number,
  data: CharacterData,
): BonusSources {
  // Wildshape (and any "replace" transform) overrides the creature's physical
  // attributes/skills entirely - race/class/gear no longer apply while shifted.
  if (data.transformState?.active && data.class) {
    const def = getTransformsForClass(data.class);
    const form = def?.forms[data.transformState.active];
    if (form) {
      const fieldId = BONUS_NAME_TO_FIELD_ID[name];
      const formVal = fieldId
        ? form.attributes[fieldId] ?? form.skills[fieldId]
        : undefined;
      if (formVal !== undefined) {
        return { race: 0, class: 0, religion: 0, equipment: 0, equipmentItems: [], distributed: formVal, total: formVal };
      }
    }
  }

  let raceBonus = 0;
  let classBonus = 0;
  let religionBonus = 0;

  if (data.race) {
    const raceData = RACES[data.race as Race];
    if (raceData) {
      const parsed = parseBonuses(raceData.bonuses);
      raceBonus = parsed.attributes[name] ?? parsed.skills[name] ?? 0;
    }
  }
  if (data.class) {
    const classData = CLASSES[data.class as CharacterClass];
    if (classData) {
      const parsed = parseBonuses(classData.bonuses);
      classBonus = parsed.attributes[name] ?? parsed.skills[name] ?? 0;
    }
  }
  if (data.religion) {
    const relData = RELIGIONS[data.religion as Religion];
    if (relData?.bonuses) {
      const parsed = parseBonuses(relData.bonuses);
      religionBonus = parsed.attributes[name] ?? parsed.skills[name] ?? 0;
    }
  }

  const equipmentItems = equipmentBonusItems(name, data);
  const equipmentBonus = equipmentItems.reduce((sum, it) => sum + it.value, 0);

  return {
    race: raceBonus,
    class: classBonus,
    religion: religionBonus,
    equipment: equipmentBonus,
    equipmentItems,
    distributed: distributedValue,
    total: raceBonus + classBonus + religionBonus + equipmentBonus + distributedValue,
  };
}

/**
 * Full value of an attribute or skill: distributed points + all bonuses
 * (race, class, religion, equipped gear). Use this anywhere a derived stat
 * needs the *effective* value, e.g. weapon ATK modifiers.
 */
export function getAttributeTotal(name: string, data: CharacterData): number {
  const attrs = data.attributes as Record<string, number>;
  const skills = data.skills as Record<string, number>;
  const distributed = attrs[name] ?? skills[name] ?? 0;
  return computeBonusSources(name, distributed, data).total;
}

/**
 * Attack bonus of a weapon for a character: the weapon's base bonus plus the
 * best modifier among the attributes in its `ability` ("Strength",
 * "Strength/Dexterity" for finesse, or any attribute an admin configured).
 * Attributes use their FULL value (distributed + race/class/religion + gear).
 */
export function computeWeaponAtk(weapon: { ability: string; bonus: string }, data: CharacterData): number {
  const abilities = weapon.ability
    .split("/")
    .map((a) => a.trim())
    .filter(Boolean);
  const mods = abilities.map((a) => getModifier(getAttributeTotal(a, data)));
  const attrMod = mods.length > 0 ? Math.max(...mods) : 0;
  return (parseInt(weapon.bonus) || 0) + attrMod;
}
