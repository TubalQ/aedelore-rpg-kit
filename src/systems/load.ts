// Server-only by construction (imports the DB client); only imported by the
// root layout. Not marked with the `server-only` package to avoid adding a dep.
import { db } from "@/lib/db/client";
import { systemData } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { activeSystem, SYSTEMS, DEFAULT_SYSTEM } from "@/systems";
import type { GameSystem } from "@/systems/types";

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

  let byKind: Record<string, unknown> = {};
  try {
    const rows = await db
      .select()
      .from(systemData)
      .where(eq(systemData.system, SYSTEM_ID));
    byKind = Object.fromEntries(rows.map((r) => [r.kind, r.data]));
  } catch {
    // DB not reachable / table missing → use the bundled system unchanged.
    return base;
  }

  const pick = <K extends Kind>(kind: K): GameSystem[K] =>
    (byKind[kind] as GameSystem[K] | undefined) ?? base[kind];

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
