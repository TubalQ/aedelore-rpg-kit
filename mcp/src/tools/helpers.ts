import { ApiClient } from "../api/client.js";
import * as sessionsApi from "../api/sessions.js";
import * as charactersApi from "../api/characters.js";

// ---------------------------------------------------------------------------
// Runtime type-narrowing helpers (replaces unsafe `as Record<...>` casts)
// ---------------------------------------------------------------------------

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("Expected object response from API");
}

export function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  throw new Error("Expected array response from API");
}

// Serialisera read-modify-write per resurs (session/karaktär). Utan detta kan samtidiga
// verktyg (damage_enemy m.fl.) läsa samma snapshot och skriva över varandra - JSONB-||
// merge:ar per top-nivå-nyckel, inte per array-element, så ett helt fält kan klobbras.
const lockChains = new Map<string, Promise<unknown>>();
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = (lockChains.get(key) ?? Promise.resolve()).catch(() => {});
  const run = prev.then(fn);
  lockChains.set(key, run);
  try {
    return await run;
  } finally {
    if (lockChains.get(key) === run) lockChains.delete(key);
  }
}

type ToolText = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

/** Top-level keys of `data` whose value differs from the `before` snapshot. */
function changedKeys(before: Map<string, string>, data: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!before.has(k) || before.get(k) !== JSON.stringify(v)) patch[k] = v;
  }
  return patch;
}

function snapshot(data: Record<string, unknown>): Map<string, string> {
  return new Map(Object.entries(data).map(([k, v]) => [k, JSON.stringify(v)]));
}

// ---------------------------------------------------------------------------
// withSession: fetch session, run mutator on its data, save only changed keys.
// Snapshots top-level values before mutation, diffs after, and sends only the
// changed keys as a JSONB patch - the v2 API merges atomically with ||.
// Serialiserad per session (se withLock) för att undvika lost updates.
// ---------------------------------------------------------------------------
export async function withSession(
  client: ApiClient,
  token: string,
  sessionId: number,
  mutator: (
    data: Record<string, unknown>,
    session: Record<string, unknown>,
  ) => Promise<ToolText>,
): Promise<ToolText> {
  return withLock(`session:${sessionId}`, () =>
    withSessionInner(client, token, sessionId, mutator),
  );
}

async function withSessionInner(
  client: ApiClient,
  token: string,
  sessionId: number,
  mutator: (
    data: Record<string, unknown>,
    session: Record<string, unknown>,
  ) => Promise<ToolText>,
): Promise<ToolText> {
  const session = asRecord(await sessionsApi.getSession(client, token, sessionId));
  const data = asRecord(session.data ?? {});

  const before = snapshot(data);
  const result = await mutator(data, session);
  const patch = changedKeys(before, data);
  if (Object.keys(patch).length > 0 && !result.isError) {
    await sessionsApi.updateSession(client, token, sessionId, { data: patch });
  }
  return result;
}

// ---------------------------------------------------------------------------
// withCharacter: the same for characters. The mutator edits `data` in place;
// only the top-level keys it changed are sent, so a concurrent edit from the
// web sheet to any other key is never overwritten by this tool's snapshot.
// Nothing is saved when the mutator returns an error result.
// ---------------------------------------------------------------------------
export async function withCharacter(
  client: ApiClient,
  token: string,
  characterId: number,
  mutator: (
    data: Record<string, unknown>,
    character: Record<string, unknown>,
  ) => Promise<ToolText> | ToolText,
): Promise<ToolText> {
  return withLock(`character:${characterId}`, async () => {
    const character = asRecord(await charactersApi.getCharacter(client, token, characterId));
    const data = asRecord(character.data ?? {});
    const before = snapshot(data);
    const result = await mutator(data, character);
    const patch = changedKeys(before, data);
    if (Object.keys(patch).length > 0 && !result.isError) {
      // The base (each key as read) lets the app merge this with what the sheet
      // or the DM wrote since the read, instead of overwriting it. A list
      // changed meanwhile is not written and comes back as a conflict.
      const base = Object.fromEntries(Object.keys(patch).filter((k) => before.has(k)).map((k) => [k, JSON.parse(before.get(k)!)]));
      const saved = asRecord(await charactersApi.updateCharacter(client, token, characterId, { data: patch, base }));
      const conflicts = Array.isArray(saved.conflicts) ? saved.conflicts.map(String) : [];
      if (conflicts.length > 0) {
        return textError(
          `Not saved: ${conflicts.join(", ")} changed elsewhere (the sheet or the DM) while this ran. Read the character again and redo that part. Everything else was saved.`,
        );
      }
    }
    return result;
  });
}

// ---------------------------------------------------------------------------
// findByKey: exact name match with day/time disambiguation when the same
// name appears more than once. `kind` is for error messages. `keyField`
// defaults to "name" (use "title" for readAloud).
// ---------------------------------------------------------------------------
interface FindByKeyOpts {
  day?: number;
  time?: string;
  kind?: string;
  keyField?: string;
}

interface FindByKeyResult {
  x: Record<string, unknown>;
  i: number;
}

export function findByKey(
  arr: unknown[],
  value: string,
  opts: FindByKeyOpts = {},
): FindByKeyResult {
  const { day, time, kind = "item", keyField = "name" } = opts;

  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error(`No ${kind}s exist in this session.`);
  }

  const records = arr.map((item) => asRecord(item));
  let candidates = records
    .map((x, i) => ({ x, i }))
    // Trimmed on both sides (M11): a name saved with a stray space could not
    // be matched by any tool call.
    .filter(({ x }) => typeof x[keyField] === "string" && (x[keyField] as string).trim() === value.trim());

  if (candidates.length === 0) {
    const available = records
      .map((x) => x[keyField])
      .filter(Boolean)
      .slice(0, 12)
      .join(", ");
    throw new Error(`${kind} "${value}" not found. Available: ${available || "(none)"}.`);
  }

  if (candidates.length > 1) {
    if (day === undefined && time === undefined) {
      const detail = candidates.map(({ x }) => `day ${x.day} ${x.time}`).join("; ");
      throw new Error(
        `Multiple ${kind}s named "${value}" exist (${detail}). Pass day and time to disambiguate.`,
      );
    }
    // Typ-tålig jämförelse: day lagras/läses som sträng (SessionDataSchema coercar), men
    // verktygsparametern är ofta number → jämför strängifierat så "1" === 1 matchar.
    if (day !== undefined)
      candidates = candidates.filter(({ x }) => String(x.day) === String(day));
    if (time !== undefined)
      candidates = candidates.filter(({ x }) => String(x.time) === String(time));
    if (candidates.length === 0) {
      throw new Error(`No ${kind} named "${value}" matches day=${day} time=${time}.`);
    }
    if (candidates.length > 1) {
      throw new Error(
        `Multiple ${kind}s named "${value}" still match after day/time filter -- data may be corrupted.`,
      );
    }
  }

  return candidates[0];
}

// ---------------------------------------------------------------------------
// appendNote: timestamp + append to a record's notes field.
// ---------------------------------------------------------------------------
export function appendNote(record: Record<string, unknown>, note: string): void {
  if (!note) return;
  const ts = new Date().toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  record.notes = (((record.notes as string) || "").trim() + `\n[${ts}] ${note}`).trim();
}

// ---------------------------------------------------------------------------
// Text helpers for tool results.
// ---------------------------------------------------------------------------
export function text(msg: string) {
  return { content: [{ type: "text" as const, text: msg }] };
}

export function textError(msg: string) {
  return { content: [{ type: "text" as const, text: msg }], isError: true as const };
}

// ---------------------------------------------------------------------------
// Wiki pages are stored as editor HTML. Tags and link attributes cost tokens
// and carry nothing the AI needs, so pages are handed over as plain text with
// markdown headings, bold, list items and table rows.
// ---------------------------------------------------------------------------
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function htmlToText(html: string): string {
  if (!/<[a-z!/]/i.test(html)) return html.trim();
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    // A paragraph inside a table cell would split the row over several lines.
    .replace(/<\/p>\s*(<\/t[dh]>)/gi, "$1")
    .replace(/(<t[dh][^>]*>)\s*<p[^>]*>/gi, "$1")
    .replace(/<h([1-6])[^>]*>/gi, (_m, level: string) => `\n\n${"#".repeat(Math.min(Number(level) + 1, 6))} `)
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<(strong|b)>/gi, "**")
    .replace(/<\/(strong|b)>/gi, "**")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, " | ")
    .replace(/<tr[^>]*>/gi, "\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|ul|ol|table|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (e) => HTML_ENTITIES[e.toLowerCase()] ?? e)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
