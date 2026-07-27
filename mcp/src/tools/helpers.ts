import { ApiClient } from "../api/client.js";
import * as sessionsApi from "../api/sessions.js";

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

// Serialisera read-modify-write per session. Utan detta kan samtidiga live-combat-verktyg
// (damage_enemy m.fl.) läsa samma snapshot och skriva över varandra - JSONB-|| merge:ar per
// top-nivå-nyckel, inte per array-element, så ett helt `npcs`/`encounters`-fält kan klobbras.
const sessionChains = new Map<number, Promise<unknown>>();
async function withSessionLock<T>(
  sessionId: number,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = (sessionChains.get(sessionId) ?? Promise.resolve()).catch(() => {});
  const run = prev.then(fn);
  sessionChains.set(sessionId, run);
  try {
    return await run;
  } finally {
    if (sessionChains.get(sessionId) === run) sessionChains.delete(sessionId);
  }
}

// ---------------------------------------------------------------------------
// withSession: fetch session, run mutator on its data, save only changed keys.
// Snapshots top-level values before mutation, diffs after, and sends only the
// changed keys as a JSONB patch - the v2 API merges atomically with ||.
// Serialiserad per session (se withSessionLock) för att undvika lost updates.
// ---------------------------------------------------------------------------
export async function withSession(
  client: ApiClient,
  token: string,
  sessionId: number,
  mutator: (
    data: Record<string, unknown>,
    session: Record<string, unknown>,
  ) => Promise<{ content: Array<{ type: "text"; text: string }> }>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  return withSessionLock(sessionId, () =>
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
  ) => Promise<{ content: Array<{ type: "text"; text: string }> }>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const session = asRecord(await sessionsApi.getSession(client, token, sessionId));
  const data = asRecord(session.data ?? {});

  const before = new Map<string, string>();
  for (const [k, v] of Object.entries(data)) {
    before.set(k, JSON.stringify(v));
  }

  const result = await mutator(data, session);

  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    const serialized = JSON.stringify(v);
    if (!before.has(k) || before.get(k) !== serialized) {
      patch[k] = v;
    }
  }

  if (Object.keys(patch).length > 0) {
    await sessionsApi.updateSession(client, token, sessionId, { data: patch });
  }
  return result;
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
    .filter(({ x }) => x[keyField] === value);

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
