import type { CharacterData } from "@/lib/schemas/character";
import { RACES, type Race } from "./races";
import { CLASSES, type CharacterClass } from "./classes";
import { ARMOR, SHIELDS } from "./armor";
import { getWeapon } from "./weapons";
import { RELIGIONS } from "./religions";

/** The worthiness scale (the sheet's labels run from -10 to 10). */
export const WORTHINESS_MIN = -10;
export const WORTHINESS_MAX = 10;

/** "+N Worthiness" / "-N Worthiness" lines in a religion's bonuses (C9). */
function religionWorthiness(religion: string | null | undefined): number {
  if (!religion) return 0;
  let sum = 0;
  for (const line of RELIGIONS[religion]?.bonuses ?? []) {
    const m = line.trim().match(/^([+\-\u2212])(\d+)\s+(.+)$/);
    if (m && m[3].trim().toLowerCase() === "worthiness") sum += (m[1] === "+" ? 1 : -1) * Number(m[2]);
  }
  return sum;
}

export function computeStartingStats(
  race: Race | null,
  cls: CharacterClass | null,
  religion?: string | null,
): Partial<CharacterData> {
  // A race or class can be renamed or removed in the system editor (Y1):
  // an unknown one contributes nothing instead of throwing.
  const raceEquip = race ? (RACES[race]?.startingEquipment ?? null) : null;
  const classEquip = cls ? (CLASSES[cls]?.startingEquipment ?? null) : null;

  const baseHp = raceEquip?.hp ?? 0;
  const hpBonus = classEquip?.hpBonus ?? 0;
  const totalHp = baseHp + hpBonus;

  // C9: the religion's worthiness counts too, and the start stays on the
  // scale (22 of 72 race and class pairs started above +10).
  const worthiness = Math.max(
    WORTHINESS_MIN,
    Math.min(WORTHINESS_MAX, (raceEquip?.worthiness ?? 0) + (classEquip?.worthiness ?? 0) + religionWorthiness(religion)),
  );
  const gold = classEquip?.gold ?? 0;

  const result: Partial<CharacterData> = {
    hp: totalHp,
    maxHp: totalHp,
    worthiness,
    gold,
  };

  const clsData = cls ? CLASSES[cls] : undefined;
  if (clsData) {
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
  race?: Race | null,
): Partial<CharacterData> {
  const classData = cls ? CLASSES[cls] : undefined;
  if (!classData) return {};
  const se = classData.startingEquipment;

  // The class's weapon, and the race's too (C10: the rulebook gives both
  // "starting equipment (weapons, food...)"; the race's was never handed out).
  // The same weapon twice is given once. The race's food is a die to roll, so
  // it stays with the player.
  const equippedWeapons: CharacterData["equippedWeapons"] = [];
  const raceWeapon = race ? RACES[race]?.startingEquipment?.weapon : undefined;
  for (const name of [se.weapon, raceWeapon]) {
    const weapon = name ? getWeapon(name) : undefined;
    if (!weapon || equippedWeapons.some((w) => w.name === weapon.name)) continue;
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
