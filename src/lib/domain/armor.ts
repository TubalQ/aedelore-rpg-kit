// ─── Armor - sourced from the active game system ────────
//
// AC system (D20-based): Total AC = baseAc + sum of all armor
// slot AC. Armor/shield/body-part data now lives in
// src/systems/<system>/armor.json. Same public API as before.

import { activeSystem } from "@/systems";
import { liveArray, getSystem } from "@/systems/runtime";
import type { ArmorData, ShieldData } from "@/systems/types";

export type { ArmorData, ShieldData } from "@/systems/types";

export type BodyPart =
  | "head"
  | "shoulders"
  | "chest"
  | "hands"
  | "legs"
  | "feet";
// Armor weight classes are now data (armor kind, editable in /system-admin),
// with the classic four as a fallback for a system that predates the field.
export type ArmorWeight = string;
export const ARMOR_WEIGHTS: readonly string[] = liveArray((s) =>
  s.armor.weights?.length ? s.armor.weights : ["Cloth", "Light", "Medium", "Heavy"],
);

export const ARMOR: readonly ArmorData[] = liveArray((s) => s.armor.armor);
export const SHIELDS: readonly ShieldData[] = liveArray((s) => s.armor.shields);
// Base AC is read LIVE from the active system (DB-backed) so it can be tuned in
// /system-admin without a rebuild. `?? activeSystem` guards old DB rows.
export const getBaseAc = (): number =>
  getSystem().armor.baseAc ?? activeSystem.armor.baseAc;
export const BODY_PARTS: readonly BodyPart[] = liveArray(
  (s) => s.armor.bodyParts,
) as readonly BodyPart[];

// ─── Helpers ────────────────────────────────────────────

export function getArmorBySlot(slot: BodyPart): ArmorData[] {
  return ARMOR.filter((a) => a.bodypart === slot);
}

/** Aggregate disadvantage penalties from equipped armor + shield into skill -> total penalty. */
export function aggregateDisadvantages(
  equippedArmor: readonly { hp: number; disadvantage: string | null }[],
  equippedShield: { hp: number; disadvantage: string | null } | null,
): Record<string, number> {
  const penalties: Record<string, number> = {};

  const sources = [
    ...equippedArmor.filter((a) => a.hp > 0),
    ...(equippedShield && equippedShield.hp > 0 ? [equippedShield] : []),
  ];

  for (const source of sources) {
    if (!source.disadvantage) continue;
    for (const part of source.disadvantage.split(",")) {
      const match = part.trim().match(/^(-\d+)\s+(.+)$/);
      if (match) {
        const value = parseInt(match[1]);
        const skill = match[2];
        penalties[skill] = (penalties[skill] ?? 0) + value;
      }
    }
  }

  return penalties;
}
