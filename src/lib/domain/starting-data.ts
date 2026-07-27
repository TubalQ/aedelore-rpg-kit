import type { CharacterData } from "@/lib/schemas/character";
import { RACES, type Race } from "./races";
import { CLASSES, type CharacterClass } from "./classes";
import { ARMOR, SHIELDS } from "./armor";
import { getWeapon } from "./weapons";

export function computeStartingStats(
  race: Race | null,
  cls: CharacterClass | null,
): Partial<CharacterData> {
  const raceEquip = race ? RACES[race].startingEquipment : null;
  const classEquip = cls ? CLASSES[cls].startingEquipment : null;

  const baseHp = raceEquip?.hp ?? 0;
  const hpBonus = classEquip?.hpBonus ?? 0;
  const totalHp = baseHp + hpBonus;

  const worthiness =
    (raceEquip?.worthiness ?? 0) + (classEquip?.worthiness ?? 0);
  const gold = classEquip?.gold ?? 0;

  const result: Partial<CharacterData> = {
    hp: totalHp,
    maxHp: totalHp,
    worthiness,
    gold,
  };

  if (cls) {
    const clsData = CLASSES[cls];
    result.maxArcana = clsData.arcanaMax;
    result.arcana = clsData.arcanaStart;
  } else {
    result.maxArcana = 0;
    result.arcana = 0;
  }

  return result;
}

export function computeStartingEquipment(
  cls: CharacterClass | null,
): Partial<CharacterData> {
  if (!cls) return {};
  const classData = CLASSES[cls];
  const se = classData.startingEquipment;

  const equippedWeapons: CharacterData["equippedWeapons"] = [];
  const weapon = getWeapon(se.weapon);
  if (weapon) {
    equippedWeapons.push({
      name: weapon.name,
      damage: weapon.damage,
      bonus: weapon.bonus,
      range: weapon.range,
      break: weapon.break,
    });
  }

  const equippedArmor: CharacterData["equippedArmor"] = [];
  if (se.armor) {
    for (const [slot, armorName] of Object.entries(se.armor)) {
      const piece = ARMOR.find((a) => a.name === armorName && a.bodypart === slot);
      if (piece) {
        equippedArmor.push({
          name: piece.name,
          bodypart: slot,
          ac: piece.ac,
          hp: piece.hp,
          maxHp: piece.hp,
          disadvantage: piece.disadvantage,
        });
      }
    }
  }

  let equippedShield: CharacterData["equippedShield"] = null;
  if (se.shield) {
    const shield = SHIELDS.find((s) => s.name === se.shield);
    if (shield) {
      equippedShield = {
        name: shield.name,
        ac: shield.ac,
        hp: shield.hp,
        maxHp: shield.hp,
        damage: shield.damage,
        disadvantage: shield.disadvantage,
      };
    }
  }

  return { equippedWeapons, equippedArmor, equippedShield };
}
