import { DEFAULT_DM_NOTE_CATEGORY, TIMES_OF_DAY } from "./schemas.js";

// Session text for the AI, laid out the way the game is played: by day and
// time of day. Every record shows the key the write tools match on (exact
// name + day + time), so the AI never has to guess it from an error message.

type Rec = Record<string, unknown>;

const UNDATED = "Undated";
const PREVIEW_CHARS = 200;

export function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}

/** Holders of an item ("A, B"): stored as a list, older rows as one name. */
export function names(v: unknown): string {
  const all = Array.isArray(v) ? v : [v];
  return all.map(str).filter(Boolean).join(", ");
}

function list(data: Rec, key: string): Rec[] {
  const v = data[key];
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Rec[]) : [];
}

export function preview(s: string, max = PREVIEW_CHARS): string {
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

/** "day 2, morning" -- the slot the write tools take as day + time. */
export function slotLabel(r: Rec): string {
  const day = str(r.day);
  const time = str(r.time);
  if (!day && !time) return "";
  return [day && `day ${day}`, time].filter(Boolean).join(", ");
}

function slotKey(r: Rec): string {
  const day = str(r.day);
  const time = str(r.time);
  return day || time ? `${day}|${time}` : UNDATED;
}

function slotOrder(key: string): [number, number] {
  if (key === UNDATED) return [Number.MAX_SAFE_INTEGER, 0];
  const [day, time] = key.split("|");
  const d = Number(day);
  const t = (TIMES_OF_DAY as readonly string[]).indexOf(time);
  return [Number.isFinite(d) && day !== "" ? d : Number.MAX_SAFE_INTEGER - 1, t < 0 ? TIMES_OF_DAY.length : t];
}

export function visibility(r: Rec): string {
  const v = r.visibleTo;
  if (v === "dm") return " [hidden from players]";
  if (Array.isArray(v) && v.length) return ` [visible to ${v.join(", ")}]`;
  return "";
}

export function enemyLine(e: Rec): string {
  const hp = e.maxHp ? `${str(e.hp) || "?"}/${str(e.maxHp)}` : str(e.hp) || "?";
  const status = str(e.status);
  const stats = [
    `HP ${hp}`,
    Number(e.maxHp) > 0 && Number(e.hp) <= 0 ? "defeated" : status && status !== "fighting" ? status : "",
    str(e.role),
    str(e.armor) && `armor ${str(e.armor)}`,
    str(e.weapon) && `weapon ${str(e.weapon)}`,
    str(e.atkBonus) && `ATK ${str(e.atkBonus)}`,
    str(e.dmg) && `DMG ${str(e.dmg)}`,
  ].filter(Boolean);
  const notes = str(e.notes);
  return `${str(e.name) || "?"} (${stats.join(", ")})${notes ? ` -- ${notes}` : ""}`;
}

function lines(data: Rec, detail: "full" | "summary"): Map<string, string[]> {
  const slots = new Map<string, string[]>();
  const push = (r: Rec, line: string): void => {
    const key = slotKey(r);
    const arr = slots.get(key) ?? [];
    arr.push(line);
    slots.set(key, arr);
  };
  const desc = (r: Rec, field = "description"): string => {
    const d = str(r[field]);
    if (!d) return "";
    return `: ${detail === "full" ? d : preview(d, 120)}`;
  };

  for (const p of list(data, "places")) {
    push(p, `- Place "${str(p.name)}"${p.visited ? " (visited)" : ""}${visibility(p)}${desc(p)}`);
  }
  for (const n of list(data, "npcs")) {
    const meta = [str(n.role), str(n.disposition), str(n.status) === "used" ? "met" : ""].filter(Boolean).join(", ");
    const at = str(n.actualLocation) || str(n.plannedLocation);
    push(n, `- NPC "${str(n.name)}"${meta ? ` (${meta})` : ""}${at ? ` at ${at}` : ""}${visibility(n)}${desc(n)}`);
  }
  for (const e of list(data, "encounters")) {
    let line = `- Encounter "${str(e.name)}" [${str(e.status) || "planned"}]${str(e.location) ? ` at ${str(e.location)}` : ""}${visibility(e)}`;
    const enemies = list(e, "enemies");
    if (enemies.length) line += `\n  Enemies: ${enemies.map(enemyLine).join("; ")}`;
    if (detail === "full") {
      if (str(e.tactics)) line += `\n  Tactics: ${str(e.tactics)}`;
      if (str(e.loot)) line += `\n  Loot: ${str(e.loot)}`;
    }
    push(e, line);
  }
  for (const r of list(data, "readAloud")) {
    const link = str(r.linkedTo) ? ` -> ${str(r.linkedTo)}` : "";
    push(r, `- Read-aloud "${str(r.title) || "Untitled"}"${r.read ? " (read)" : ""}${link}${visibility(r)}: ${preview(str(r.text))}`);
  }
  for (const i of list(data, "items")) {
    const where = str(i.actualLocation) || str(i.plannedLocation);
    push(
      i,
      `- Item "${str(i.name)}"${i.found ? " (found)" : ""}${names(i.givenTo) ? ` (given to ${names(i.givenTo)})` : ""}${where ? ` at ${where}` : ""}${i.stashId ? ` [stash #${str(i.stashId)}]` : ""}${visibility(i)}${desc(i)}`,
    );
  }
  for (const q of list(data, "equipment")) {
    const rarity = str(q.rarity) && str(q.rarity) !== "common" ? `, ${str(q.rarity)}` : "";
    push(
      q,
      `- Equipment "${str(q.name)}" (${str(q.type) || "misc"}${rarity})${names(q.givenTo) ? ` (given to ${names(q.givenTo)})` : ""}${q.stashId ? ` [stash #${str(q.stashId)}]` : ""}${visibility(q)}${desc(q)}`,
    );
  }
  for (const ev of list(data, "eventLog")) {
    const link = str(ev.linkedTo) ? `[${str(ev.linkedTo)}] ` : "";
    push(ev, `- Event: ${link}${str(ev.text)}${visibility(ev)}`);
  }
  for (const tp of list(data, "turningPoints")) {
    const link = str(tp.linkedTo) ? `[${str(tp.linkedTo)}] ` : "";
    const cons = str(tp.consequence) ? ` => ${str(tp.consequence)}` : "";
    push(tp, `- Turning point: ${link}${str(tp.description)}${cons}${visibility(tp)}`);
  }
  return slots;
}

/**
 * Format one session for the AI. `full` is for running or prepping the
 * session; `summary` is for history (short descriptions, no tactics/loot,
 * no read-aloud text beyond a preview).
 */
export function formatSession(session: Rec, detail: "full" | "summary" = "full"): string {
  const data = (session.data ?? {}) as Rec;
  const num = session.sessionNumber ?? "?";
  const title = str(session.title);
  let out = `Session #${num}${title ? `: ${title}` : ""} (session_id ${str(session.id)}, ${str(session.date) || "no date"}, ${str(session.status) || "draft"})`;
  if (str(session.location)) out += ` -- ${str(session.location)}`;
  out += "\n";

  const notes = (data.sessionNotes ?? {}) as Rec;
  if (str(notes.summary)) out += `\nSummary: ${str(notes.summary)}\n`;
  if (str(notes.followUp)) out += `Follow-up: ${str(notes.followUp)}\n`;
  if (str(data.hook)) out += `Hook: ${detail === "full" ? str(data.hook) : preview(str(data.hook))}\n`;
  if (detail === "full" && str(data.prolog)) out += `Prolog: ${str(data.prolog)}\n`;

  const slots = lines(data, detail);
  if (slots.size) {
    out += `\nRecords by day and time. Write tools match on the exact quoted name; pass day + time when a name repeats.\n`;
    const keys = [...slots.keys()].sort((a, b) => {
      const [da, ta] = slotOrder(a);
      const [db, tb] = slotOrder(b);
      return da - db || ta - tb;
    });
    for (const key of keys) {
      const label = key === UNDATED ? UNDATED : slotLabel({ day: key.split("|")[0], time: key.split("|")[1] });
      out += `\n## ${label}\n${(slots.get(key) ?? []).join("\n")}\n`;
    }
  }

  const dmNotes = list(data, "dmNotes");
  if (detail === "full" && dmNotes.length) {
    out += `\n## DM notes (private, never shown to players)\n`;
    for (const n of dmNotes) out += `- [${str(n.category) || DEFAULT_DM_NOTE_CATEGORY}] ${str(n.text)}\n`;
  }
  return out;
}

/** One short block per session for "the story so far". */
export function sessionDigest(session: Rec): string {
  const data = (session.data ?? {}) as Rec;
  const notes = (data.sessionNotes ?? {}) as Rec;
  const title = str(session.title);
  const head = `- #${session.sessionNumber ?? "?"}${title ? ` ${title}` : ""} (session_id ${str(session.id)}, ${str(session.status) || "draft"})`;
  const summary = str(notes.summary);
  const next = str(notes.followUp) ? ` Next: ${preview(str(notes.followUp), 200)}` : "";
  if (summary) return `${head}: ${preview(summary, 400)}${next}`;
  const moments = list(data, "turningPoints").map((t) => str(t.description)).filter(Boolean);
  if (moments.length) return `${head}: key moments: ${preview(moments.join("; "), 400)}`;
  const events = list(data, "eventLog").map((e) => str(e.text)).filter(Boolean);
  if (events.length) return `${head}: last events: ${preview(events.slice(-3).join("; "), 300)}`;
  return `${head}: (no summary yet)`;
}

/** Where the party was last seen: the latest dated event (the last logged one within a slot), else the last visited place. */
export function lastPosition(session: Rec): string {
  const data = (session.data ?? {}) as Rec;
  const dated = list(data, "eventLog").filter((r) => slotKey(r) !== UNDATED);
  // Latest slot wins; within a slot the entry logged last (later in the array).
  const latest = dated.reduce<Rec | undefined>((best, r) => {
    if (!best) return r;
    const [db, tb] = slotOrder(slotKey(best));
    const [dr, tr] = slotOrder(slotKey(r));
    return dr > db || (dr === db && tr >= tb) ? r : best;
  }, undefined);
  const turning = list(data, "turningPoints");
  const lastTurn = turning[turning.length - 1];
  const visited = list(data, "places").filter((p) => p.visited);
  const place = visited[visited.length - 1];
  const parts = [
    latest && `last logged ${slotLabel(latest)}: ${preview(str(latest.text), 160)}`,
    lastTurn && `latest turning point: ${preview(str(lastTurn.description), 160)}`,
    place && `last visited place "${str(place.name)}"${slotLabel(place) ? ` (${slotLabel(place)})` : ""}`,
  ].filter(Boolean);
  return parts.join("; ");
}
