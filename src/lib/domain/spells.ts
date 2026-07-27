// ─── Spells - sourced from the active game system ───────
//
// Class spell/ability lists now live in
// src/systems/<system>/spells.json (keyed by class name).
// Same public API (SPELLS_BY_CLASS, SpellData, helpers).

import { liveRecord } from "@/systems/runtime";
import type { CharacterClass } from "./classes";
import type { SpellData } from "@/systems/types";

export type { SpellData } from "@/systems/types";

export const SPELLS_BY_CLASS: Readonly<Record<string, readonly SpellData[]>> =
  liveRecord((s) => s.spells);

export function getSpellsForClass(
  className: CharacterClass,
): readonly SpellData[] {
  return SPELLS_BY_CLASS[className] ?? [];
}
