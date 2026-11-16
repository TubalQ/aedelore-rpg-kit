import { config } from "../config.js";
import { logger } from "../logger.js";
import type { GameDataCache } from "./types.js";
import { checkContracts } from "./contracts.js";

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

const FETCH_TIMEOUT_MS = 10_000;
const BOOT_ATTEMPTS = 6;
let loadedAt = 0;
let refreshing = false;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const hasArray = (v: unknown, key: string): boolean => isRecord(v) && Array.isArray(v[key]);

// A 200 with a partial payload must never replace a good cache: tools index
// into these structures directly (gameData.weapons.weapons.find, ...).
function assertShape(raw: Record<string, unknown>): void {
  const problems = [
    hasArray(raw.weapons, "weapons") ? "" : "weapons.weapons",
    hasArray(raw.armor, "armor") ? "" : "armor.armor",
    isRecord(raw.spells) ? "" : "spells",
    hasArray(raw.races, "names") ? "" : "races.names",
    hasArray(raw.classes, "names") ? "" : "classes.names",
    hasArray(raw.religions, "names") ? "" : "religions.names",
  ].filter(Boolean);
  if (problems.length) throw new Error(`game data missing: ${problems.join(", ")}`);
}

async function fetchGameData(): Promise<GameDataCache> {
  const res = await fetch(`${config.API_URL}/api/game-data`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GET /api/game-data -> ${res.status}`);
  const raw = (await res.json()) as Record<string, unknown>;
  assertShape(raw);
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
  // The app may still be starting when the pod comes up: retry with backoff
  // before giving up (systemd then restarts the container).
  for (let attempt = 1; ; attempt++) {
    try {
      cache = await fetchGameData();
      loadedAt = Date.now();
      break;
    } catch (err) {
      if (attempt >= BOOT_ATTEMPTS) throw err;
      const delay = 1000 * 2 ** attempt;
      logger.warn({ err, attempt, delayMs: delay }, "Game data not available yet, retrying");
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  const shieldCount = Array.isArray(cache.shields) ? cache.shields.length : 0;
  logger.info({ shieldCount }, "Loaded game data from app API");
  await checkContracts();

  const timer = setInterval(async () => {
    if (refreshing) return;
    refreshing = true;
    try {
      cache = await fetchGameData();
      loadedAt = Date.now();
      await checkContracts();
      logger.debug("Refreshed game data from app API");
    } catch (err) {
      logger.warn({ err, ageMs: gameDataAgeMs() }, "Game data refresh failed; keeping cached copy");
    } finally {
      refreshing = false;
    }
  }, REFRESH_MS);
  timer.unref?.();

  return cache;
}

/** Milliseconds since game data was last loaded successfully (for /health). */
export function gameDataAgeMs(): number {
  return loadedAt ? Date.now() - loadedAt : -1;
}

export function getGameData(): GameDataCache {
  if (!cache) {
    throw new Error("Game data not loaded. Call loadGameData() first.");
  }
  return cache;
}
