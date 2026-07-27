// ─── Classes - sourced from the active game system ──────
//
// Class data now lives in src/systems/<system>/classes.json
// and is selected by the active system. This module keeps the
// SAME public API (CLASSES, CLASS_NAMES, CharacterClass,
// ClassData) so every consumer - character creation, spells,
// bonus-calc, the MCP export - is unchanged.

import { liveRecord, liveArray } from "@/systems/runtime";
import type { ClassData } from "@/systems/types";

export type { ClassData } from "@/systems/types";

// Class names are data now, so this is a string rather than a
// compile-time literal union. Consumers already cast
// `data.class as CharacterClass`, so this is source-compatible.
export type CharacterClass = string;

export const CLASSES: Readonly<Record<string, ClassData>> =
  liveRecord((s) => s.classes.data);

export const CLASS_NAMES: readonly string[] = liveArray((s) => s.classes.names);
