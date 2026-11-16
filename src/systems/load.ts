// Server-only by construction (imports the DB client); only imported by the
// root layout. Not marked with the `server-only` package to avoid adding a dep.
import { getStoredKinds } from "@/lib/db/queries/system-data";
import { KIND_SCHEMAS } from "@/lib/schemas/system-data";
import { activeSystem, SYSTEMS, DEFAULT_SYSTEM } from "@/systems";
import type { GameSystem } from "@/systems/types";
import { setSystem } from "@/systems/runtime";

// Server-side loader: assemble the active GameSystem from the `system_data`
// rows, falling back to the bundled JSON per kind when a row is missing (fresh
// DB, or a kind that was never seeded). The bundled system is also the shape
// authority, so a missing/edited kind never crashes a render.

const SYSTEM_ID = process.env.NEXT_PUBLIC_ACTIVE_SYSTEM ?? DEFAULT_SYSTEM;

type Kind = keyof Pick<
  GameSystem,
  | "races"
  | "classes"
  | "religions"
  | "weapons"
  | "armor"
  | "spells"
  | "transforms"
  | "attributes"
  | "theme"
  | "landing"
  | "palettes"
>;

export async function loadActiveSystem(): Promise<GameSystem> {
  const base = SYSTEMS[SYSTEM_ID] ?? activeSystem;

  let byKind: Map<string, unknown>;
  try {
    byKind = await getStoredKinds();
  } catch (e) {
    // DB not reachable / table missing → use the bundled system unchanged.
    console.error("[system] could not read system_data, using bundled system", e);
    return base;
  }

  // A stored kind that no longer matches its schema (hand-edited row, old
  // format) falls back to the bundled data instead of crashing every render.
  const pick = <K extends Kind>(kind: K): GameSystem[K] => {
    if (!byKind.has(kind)) return base[kind];
    const stored = byKind.get(kind);
    const check = KIND_SCHEMAS[kind]?.safeParse(stored);
    if (check && !check.success) {
      console.error(`[system] stored "${kind}" is invalid, using the bundled data`, check.error.issues.slice(0, 5));
      return base[kind];
    }
    return stored as GameSystem[K];
  };

  return {
    id: base.id,
    name: base.name,
    races: pick("races"),
    classes: pick("classes"),
    religions: pick("religions"),
    weapons: pick("weapons"),
    armor: pick("armor"),
    spells: pick("spells"),
    transforms: pick("transforms"),
    attributes: pick("attributes"),
    theme: pick("theme"),
    landing: pick("landing"),
    palettes: pick("palettes"),
  };
}

/**
 * API routes do not run the root layout, so the domain modules (RACES,
 * CLASSES, ...) still point at the bundled seed there. Call this first in a
 * route that uses domain data so it sees the live, admin-edited system.
 */
export async function activateLiveSystem(): Promise<void> {
  setSystem(await loadActiveSystem());
}
