// ─── Races - sourced from the active game system ────────
//
// Race data is no longer hardcoded here. It lives in
// src/systems/<system>/races.json and is selected by the
// active system (NEXT_PUBLIC_ACTIVE_SYSTEM, default
// "aedelore"). This module keeps the SAME public API
// (RACES, RACE_NAMES, Race, RaceData) so every consumer -
// character creation, the MCP export, bonus-calc - is unchanged.

import { liveRecord, liveArray } from "@/systems/runtime";
import type { RaceData } from "@/systems/types";

export type { RaceData, StartingEquipment } from "@/systems/types";

// Race names are data now, so this is a string rather than a
// compile-time literal union. Consumers already cast
// `data.race as Race` (race arrives as a string from the DB),
// so this is source-compatible.
export type Race = string;

// Live views over the active system (which the DB can override at runtime).
// Consumers keep importing RACES / RACE_NAMES unchanged; the values follow
// live admin edits.
export const RACES: Readonly<Record<string, RaceData>> =
  liveRecord((s) => s.races.data);

export const RACE_NAMES: readonly string[] = liveArray((s) => s.races.names);
