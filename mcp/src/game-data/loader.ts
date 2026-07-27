import { config } from "../config.js";
import { logger } from "../logger.js";
import type { GameDataCache } from "./types.js";

// Game data is read LIVE from the app's public /api/game-data endpoint (the same
// data shown on the landing page / character creation), NOT from static files.
// This is the single source of truth: an admin edit in /system-admin reaches the
// MCP tools on the next background refresh - no export step, no MCP restart.

let cache: GameDataCache | null = null;
const REFRESH_MS = 60_000;

const EMPTY_ATTRIBUTES: GameDataCache["attributes"] = {
  attributeNames: [],
  skillNames: [],
  attributes: {},
  skills: {},
  freePointsTotal: 7,
  maxPointsPerField: 3,
  maxThirdEye: 3,
};

async function fetchGameData(): Promise<GameDataCache> {
  const res = await fetch(`${config.API_URL}/api/game-data`);
  if (!res.ok) throw new Error(`GET /api/game-data -> ${res.status}`);
  const raw = (await res.json()) as Record<string, unknown>;
  const armor = (raw.armor ?? {}) as GameDataCache["armor"];
  return {
    weapons: raw.weapons as GameDataCache["weapons"],
    armor,
    // shields live inside armor; expose them at the top level too (API parity
    // with the old file loader's derived `shields`).
    shields: (armor.shields ?? []) as GameDataCache["shields"],
    spells: raw.spells as GameDataCache["spells"],
    races: raw.races as GameDataCache["races"],
    classes: raw.classes as GameDataCache["classes"],
    religions: raw.religions as GameDataCache["religions"],
    attributes: (raw.attributes ?? EMPTY_ATTRIBUTES) as GameDataCache["attributes"],
  };
}

/**
 * Fetch game data once at boot (throws if the app is unreachable - same
 * fail-fast as the old file loader) and then refresh it in the background so
 * live edits reach the tools without a restart. Reads via getGameData() stay
 * synchronous, so no tool code changes.
 */
export async function loadGameData(): Promise<GameDataCache> {
  cache = await fetchGameData();
  const shieldCount = Array.isArray(cache.shields) ? cache.shields.length : 0;
  logger.info({ shieldCount }, "Loaded game data from app API");

  const timer = setInterval(async () => {
    try {
      cache = await fetchGameData();
      logger.debug("Refreshed game data from app API");
    } catch (err) {
      logger.warn({ err }, "Game data refresh failed; keeping cached copy");
    }
  }, REFRESH_MS);
  timer.unref?.();

  return cache;
}

export function getGameData(): GameDataCache {
  if (!cache) {
    throw new Error("Game data not loaded. Call loadGameData() first.");
  }
  return cache;
}
