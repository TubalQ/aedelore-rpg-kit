import { stripSpoilerContent } from "@/lib/wiki/spoilers";
import { apiAuth } from "@/lib/auth/api-auth";

// The public wiki API (/api/wiki, no login required) must show exactly what the
// public wiki pages show: GM spoiler blocks are emptied and author notes are
// hidden unless the caller is an admin (cookie session or MCP bearer token).

export async function viewerCanSeeGmContent(): Promise<boolean> {
  const session = await apiAuth();
  return session?.user?.isAdmin === true;
}

// W5: stripping spoilers parses the page (jsdom), 0.5-0.8 s of CPU for a full
// book on an endpoint anyone may call 300 times a minute. The result is kept
// per page version (id + updatedAt), so an edit gets a fresh entry by itself.
const STRIPPED_MAX = 2000;
const stripped = new Map<string, string>();

function strippedContent(entry: Record<string, unknown>, content: string): string {
  const version = entry.updatedAt instanceof Date ? entry.updatedAt.getTime() : String(entry.updatedAt ?? "");
  const key = entry.id !== undefined && version !== "" ? `${String(entry.id)}:${version}` : null;
  if (key) {
    const hit = stripped.get(key);
    if (hit !== undefined) return hit;
  }
  const out = stripSpoilerContent(content);
  if (key) {
    if (stripped.size >= STRIPPED_MAX) stripped.delete(stripped.keys().next().value as string);
    stripped.set(key, out);
  }
  return out;
}

export function toPublicWiki<T extends object>(entry: T, canSeeGm: boolean): T {
  if (canSeeGm) return entry;
  const out: Record<string, unknown> = Object.fromEntries(Object.entries(entry));
  delete out.authorNote;
  if (typeof out.content === "string") out.content = strippedContent(out, out.content);
  return out as T;
}
