// ─── Weapons - sourced from the active game system ──────
//
// Weapon + ammunition data now lives in
// src/systems/<system>/weapons.json. Keeps the SAME public
// API (WEAPONS, AMMUNITION, helpers, taxonomy consts) so
// every consumer is unchanged.

import { liveArray } from "@/systems/runtime";
import type { WeaponData, AmmunitionData } from "@/systems/types";

export type { WeaponData, AmmunitionData } from "@/systems/types";

// Weapon taxonomy - the ordered `type` values used to group the equipment
// dropdowns. Now data (weapons kind, editable in /system-admin). Falls back to
// the distinct weapon types if a system predates the `categories` field, so the
// dropdowns never come up empty. A string now that it's runtime data.
export type WeaponCategory = string;
export const WEAPON_CATEGORIES: readonly string[] = liveArray((s) =>
  s.weapons.categories?.length
    ? s.weapons.categories
    : [...new Set(s.weapons.weapons.map((w) => w.type))],
);

export const WEAPONS: readonly WeaponData[] = liveArray((s) => s.weapons.weapons);
export const AMMUNITION: readonly AmmunitionData[] =
  liveArray((s) => s.weapons.ammunition);

// ─── Lookup helpers ─────────────────────────────────────

export function getWeapon(name: string): WeaponData | undefined {
  return WEAPONS.find((w) => w.name === name);
}

export function getWeaponsByType(type: string): WeaponData[] {
  return WEAPONS.filter((w) => w.type === type);
}
