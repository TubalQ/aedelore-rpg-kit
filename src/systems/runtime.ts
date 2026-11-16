// ─── Runtime active-system holder ───────────────────────
//
// The domain layer used to read game data straight from the build-time
// bundled `activeSystem` (the JSON files). To make races/classes/weapons/...
// editable live in the admin UI, the data now lives in the database and is
// loaded at runtime. This module holds the "effective" system for the current
// JS context (one singleton per server process, one per browser tab) and the
// domain modules read from it through the `liveRecord` / `liveArray` proxies
// below - so every existing consumer keeps importing the same constants
// (`RACES`, `WEAPONS`, ...) with no change, but the values follow live edits.
//
// - Server: the root layout loads the system from the DB and calls setSystem()
//   per request (see src/systems/load.ts + app/layout.tsx).
// - Client: <SystemProvider> hydrates the same data at render.
// The default is the bundled JSON system, which is also the per-kind fallback,
// so nothing breaks before the DB is seeded.

import { activeSystem } from "@/systems";
import type { GameSystem } from "@/systems/types";

let current: GameSystem = activeSystem;

export function getSystem(): GameSystem {
  return current;
}

export function setSystem(system: GameSystem): void {
  current = system;
}

/**
 * A live, read-only Record view backed by the current system. Reads are
 * forwarded to whatever system is active *now*, so consumers that captured the
 * reference at import time still see live data.
 */
export function liveRecord<T>(
  pick: (s: GameSystem) => Readonly<Record<string, T>>,
): Readonly<Record<string, T>> {
  // Own keys only (Y6): with `in` and plain indexing, a race or class named
  // "constructor" or "toString" read Object.prototype's function, and the
  // sheet and the DM's party tab crashed on it.
  const own = (o: Readonly<Record<string, T>>, k: string | symbol): k is string =>
    typeof k === "string" && Object.hasOwn(o, k);
  return new Proxy({} as Record<string, T>, {
    get: (_t, k) => {
      const o = pick(getSystem());
      return own(o, k) ? o[k] : undefined;
    },
    has: (_t, k) => own(pick(getSystem()), k),
    ownKeys: () => Reflect.ownKeys(pick(getSystem())),
    getOwnPropertyDescriptor: (_t, k) => {
      const o = pick(getSystem());
      return own(o, k) ? { enumerable: true, configurable: true, value: o[k] } : undefined;
    },
  });
}

/** A live, read-only Array view backed by the current system. */
export function liveArray<T>(pick: (s: GameSystem) => readonly T[]): readonly T[] {
  return new Proxy([] as T[], {
    get: (_t, k) => Reflect.get(pick(getSystem()) as T[], k),
    has: (_t, k) => Reflect.has(pick(getSystem()) as T[], k),
    ownKeys: () => Reflect.ownKeys(pick(getSystem()) as T[]),
    getOwnPropertyDescriptor: (_t, k) =>
      Reflect.getOwnPropertyDescriptor(pick(getSystem()) as T[], k),
  });
}
