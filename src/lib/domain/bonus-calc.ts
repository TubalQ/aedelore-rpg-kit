import type { CharacterData } from "@/lib/schemas/character";
import { parseBonuses, BONUS_NAME_TO_FIELD_ID } from "@/lib/domain/attributes";
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
  // Säkerhetsnät: en utrustad post ska bära sin egen bonuses-array (v2:s equip-flöde
  // kopierar in den). Men om den saknas (t.ex. v1-migrerade utrustade poster) faller vi
  // tillbaka till DM-föremålets bonuses matchat på namn - så bonusen ALLTID räknas när
  // föremålet är utrustat, oavsett hur det hamnade där.
  const dmBonuses = new Map<string, { stat: string; value: number }[]>();
  for (const e of data.dmEquipment) {
    if (Array.isArray(e.bonuses) && e.bonuses.length > 0) dmBonuses.set(e.name, e.bonuses);
  }
  const resolve = (itemName: string | undefined, own?: { stat: string; value: number }[]) => {
    if (Array.isArray(own) && own.length > 0) return own;
    if (!itemName) return own;
    return dmBonuses.get(itemName) ?? dmBonuses.get(itemName.replace(/ \(DM\)$/, "")) ?? own;
  };
  const add = (
    itemName: string | undefined,
    kind: EquipmentBonusItem["kind"],
    bonuses?: { stat: string; value: number }[],
  ) => {
    const eff = resolve(itemName, bonuses);
    if (!eff) return;
    let sum = 0;
    // Normaliserad matchning: äldre bonusar har fritext-statnamn ("styrka",
    // gemener, sv/en-blandat) - redan tilldelade föremål ska också gälla.
    for (const b of eff) if ((normalizeStatName(b.stat) ?? b.stat) === name) sum += b.value;
    if (sum !== 0) items.push({ name: itemName || "?", kind, value: sum });
  };
  for (const w of data.equippedWeapons) add(w.name, "weapon", w.bonuses);
  for (const a of data.equippedArmor) add(a.name, "armor", a.bonuses);
  if (data.equippedShield) add(data.equippedShield.name, "shield", data.equippedShield.bonuses);
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
