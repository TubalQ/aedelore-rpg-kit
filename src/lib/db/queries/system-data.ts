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

// Every page render and several API routes read the game system. The rows are
// small and change only through /system-admin (setKind below, same process),
// so they are cached briefly and the cache is dropped on every write: admin
// edits still show up on the next request.
//
// The cache lives on globalThis (#83): Next bundles this module once for the
// route handlers and once for page rendering, and with module-level variables
// a save in the admin API cleared only the route handlers' copy. Pages kept
// the old system until the TTL ran out (20-60 s in the tests).
const CACHE_TTL_MS = 30_000;

interface SystemDataCache {
  cached: { rows: Map<string, unknown>; at: number } | null;
  inflight: Promise<Map<string, unknown>> | null;
  generation: number;
}
const globalCache = globalThis as typeof globalThis & { __aedeloreSystemData?: SystemDataCache };
const cache: SystemDataCache = (globalCache.__aedeloreSystemData ??= { cached: null, inflight: null, generation: 0 });

/** Stored rows for the active system, keyed by kind (cached, see above). */
export async function getStoredKinds(): Promise<Map<string, unknown>> {
  if (cache.cached && Date.now() - cache.cached.at < CACHE_TTL_MS) return cache.cached.rows;
  if (!cache.inflight) {
    // Y10: a read that started before a save must not cache what it read
    // after the save cleared the cache (the old data stayed for the TTL).
    const startedAt = cache.generation;
    const read: Promise<Map<string, unknown>> = db
      .select({ kind: systemData.kind, data: systemData.data })
      .from(systemData)
      .where(eq(systemData.system, SYSTEM))
      .then((rows) => {
        const map = new Map(rows.map((r) => [r.kind, r.data as unknown]));
        if (cache.generation === startedAt) cache.cached = { rows: map, at: Date.now() };
        return map;
      })
      .finally(() => {
        if (cache.inflight === read) cache.inflight = null;
      });
    cache.inflight = read;
  }
  return cache.inflight;
}

export function invalidateSystemDataCache(): void {
  cache.generation += 1;
  cache.cached = null;
  // The next read goes to the database, not to a read started before the save.
  cache.inflight = null;
}

/** Current stored value for a kind (DB row), or the bundled fallback. */
export async function getKind(kind: string): Promise<unknown> {
  const rows = await getStoredKinds();
  return rows.has(kind) ? rows.get(kind) : bundledKind(kind);
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
  invalidateSystemDataCache();
}
