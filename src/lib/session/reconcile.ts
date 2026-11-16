import type { SessionData } from "@/lib/schemas/session";

// The session editor keeps a local copy of the session and saves whole lists
// per data key (all npcs, the whole event log ...). Changes made elsewhere
// while the editor is open (the MCP, another tab, the stash page) must reach
// that copy, or the next save of the same key writes the old list back over
// them. These helpers take the server version for every key the user has not
// changed locally, the same rule the character sheet follows.

export const SESSION_META_KEYS = ["title", "date", "location", "gameLocation"] as const;
export type SessionMetaKey = (typeof SESSION_META_KEYS)[number];
export type SessionMeta = Record<SessionMetaKey, string>;

/** Prefix for data keys in the editor's dirty-key set ("data.npcs"). */
const DATA_PREFIX = "data.";

/**
 * Keys a session patch touches, as the editor tracks them: meta fields by
 * name and every data key as "data.<key>", so an unsaved npc edit protects
 * the npc list without freezing the rest of the session.
 */
export function sessionPatchKeys(patch: Record<string, unknown>): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (key === "data" && value && typeof value === "object") {
      for (const dataKey of Object.keys(value)) keys.push(DATA_PREFIX + dataKey);
    } else {
      keys.push(key);
    }
  }
  return keys;
}

const same = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * The server's data for every key without local changes, the local data for
 * the rest. Returns `local` itself when nothing differs, so a poll that brings
 * nothing new causes no re-render.
 */
export function reconcileSessionData(local: SessionData, server: SessionData, dirty: ReadonlySet<string>): SessionData {
  let next: SessionData | null = null;
  for (const key of Object.keys(server) as (keyof SessionData)[]) {
    if (dirty.has(DATA_PREFIX + key) || same(local[key], server[key])) continue;
    next ??= { ...local };
    (next as Record<string, unknown>)[key] = server[key];
  }
  return next ?? local;
}

/** The same for the meta fields (title, date, location, gameLocation). */
export function reconcileSessionMeta(local: SessionMeta, server: SessionMeta, dirty: ReadonlySet<string>): SessionMeta {
  let next: SessionMeta | null = null;
  for (const key of SESSION_META_KEYS) {
    if (dirty.has(key) || local[key] === server[key]) continue;
    next ??= { ...local };
    next[key] = server[key];
  }
  return next ?? local;
}
