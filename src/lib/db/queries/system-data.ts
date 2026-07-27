import { db } from "@/lib/db/client";
import { systemData } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { SYSTEMS, activeSystem, DEFAULT_SYSTEM } from "@/systems";

const SYSTEM = process.env.NEXT_PUBLIC_ACTIVE_SYSTEM ?? DEFAULT_SYSTEM;

/** The bundled JSON value for a kind - the seed source and fallback. */
export function bundledKind(kind: string): unknown {
  const base = SYSTEMS[SYSTEM] ?? activeSystem;
  return (base as unknown as Record<string, unknown>)[kind];
}

/** Current stored value for a kind (DB row), or the bundled fallback. */
export async function getKind(kind: string): Promise<unknown> {
  const [row] = await db
    .select()
    .from(systemData)
    .where(and(eq(systemData.system, SYSTEM), eq(systemData.kind, kind)))
    .limit(1);
  return row ? row.data : bundledKind(kind);
}

/** Insert or update a kind's data. Live: rendered pages pick it up next request. */
export async function setKind(kind: string, data: unknown): Promise<void> {
  const [existing] = await db
    .select({ id: systemData.id })
    .from(systemData)
    .where(and(eq(systemData.system, SYSTEM), eq(systemData.kind, kind)))
    .limit(1);
  if (existing) {
    await db
      .update(systemData)
      .set({ data, updatedAt: new Date() })
      .where(eq(systemData.id, existing.id));
  } else {
    await db.insert(systemData).values({ system: SYSTEM, kind, data });
  }
}
