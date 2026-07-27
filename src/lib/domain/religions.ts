// ─── Religions - sourced from the active game system ────
//
// Religion data now lives in
// src/systems/<system>/religions.json and is selected by the
// active system. Keeps the SAME public API (RELIGIONS,
// RELIGION_NAMES, Religion, ReligionData) so every consumer
// is unchanged.

import { liveRecord, liveArray } from "@/systems/runtime";
import type { ReligionData } from "@/systems/types";

export type { ReligionData } from "@/systems/types";

// Religion names are data now, so this is a string rather than
// a compile-time literal union. Consumers already cast
// `data.religion as Religion`, so this is source-compatible.
export type Religion = string;

export const RELIGIONS: Readonly<Record<string, ReligionData>> =
  liveRecord((s) => s.religions.data);

export const RELIGION_NAMES: readonly string[] =
  liveArray((s) => s.religions.names);
