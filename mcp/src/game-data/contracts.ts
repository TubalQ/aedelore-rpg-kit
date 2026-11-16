import { config } from "../config.js";
import { logger } from "../logger.js";
import { EQUIPMENT_TYPES, RARITIES } from "../tools/equipment-input.js";
import {
  TIMES_OF_DAY,
  LINKABLE_TYPES,
  ENCOUNTER_STATUSES,
  ENEMY_STATUSES,
  NPC_STATUSES,
  DM_NOTE_CATEGORIES,
  DEFAULT_DM_NOTE_CATEGORY,
} from "../tools/session/schemas.js";

// The MCP keeps copies of the app's enum lists for its tool input schemas (it
// is built separately on zod 3 and cannot import the app's schemas). The app
// serves the originals at /api/contracts; this compares them on every
// game-data load so a change in the app that was not mirrored here shows up
// at once (logged as an error and reported by /health) instead of as tool
// input the app rejects.
/** Mirrors the app's LOCK_STEPS (character build steps). */
export const LOCK_STEPS = ["raceClass", "attributes", "abilities"] as const;

const LOCAL: Record<string, readonly string[] | string> = {
  equipmentTypes: EQUIPMENT_TYPES,
  rarities: RARITIES,
  lockSteps: LOCK_STEPS,
  encounterStatuses: ENCOUNTER_STATUSES,
  enemyStatuses: ENEMY_STATUSES,
  npcStatuses: NPC_STATUSES,
  dmNoteCategories: DM_NOTE_CATEGORIES,
  defaultDmNoteCategory: DEFAULT_DM_NOTE_CATEGORY,
  timesOfDay: TIMES_OF_DAY,
  linkableTypes: LINKABLE_TYPES,
};

let drift: string[] = [];

export function contractDrift(): string[] {
  return drift;
}

export async function checkContracts(): Promise<void> {
  try {
    const res = await fetch(`${config.API_URL}/api/contracts`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`GET /api/contracts -> ${res.status}`);
    const remote = (await res.json()) as Record<string, unknown>;
    drift = Object.entries(LOCAL)
      .filter(([key, local]) => JSON.stringify(remote[key]) !== JSON.stringify(local))
      .map(([key, local]) => `${key}: app=${JSON.stringify(remote[key])} mcp=${JSON.stringify(local)}`);
    if (drift.length) logger.error({ drift }, "MCP enum lists differ from the app's contracts");
  } catch (err) {
    logger.warn({ err }, "Could not check the app's contracts");
  }
}
