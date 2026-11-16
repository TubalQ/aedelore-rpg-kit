import type { CharacterData } from "@/lib/schemas/character";

// Attributes and skills are sent per stat (only the ones changed) and the
// server merges them per stat (C1). Locally, and when two quick edits are
// combined before saving, the maps merge key by key too: otherwise the
// second edit's map would replace the first's and drop its stat.

const STAT_MAPS = ["attributes", "skills"] as const;

export function mergeCharacterPatch(older: Partial<CharacterData>, newer: Partial<CharacterData>): Partial<CharacterData> {
  const merged: Partial<CharacterData> = { ...older, ...newer };
  for (const key of STAT_MAPS) {
    if (older[key] && newer[key]) merged[key] = { ...older[key], ...newer[key] };
  }
  return merged;
}

/** The sheet's data with a change applied (stat maps merged per stat). */
export function applyCharacterPatch(data: CharacterData, patch: Partial<CharacterData>): CharacterData {
  return { ...data, ...mergeCharacterPatch(data, patch) };
}

// ---------------------------------------------------------------------------
// Merging a save against what it was based on (C2)
//
// The sheet's copy of a character can be up to 30 s old, and others write the
// same keys meanwhile: the DM (damage, items handed out or taken back), the
// MCP. A save carries `base`: the value of each changed key as it was when the
// sheet started changing it. Against the stored value:
//  - unchanged since base: the save's value is written;
//  - changed, and a number (HP, arcana, gold ...): the save is applied as a
//    change on top of what is stored now (base 10, saved 11, stored 5 -> 6);
//    never below 0;
//  - changed, and anything else (a list): not written; the key is reported as
//    a conflict, so the sheet shows the stored value and says so.
// A key without a base is written as before (callers that send none).
// ---------------------------------------------------------------------------

type Rec = Record<string, unknown>;

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bArr = b as unknown[];
    return a.length === bArr.length && a.every((x, i) => deepEqual(x, bArr[i]));
  }
  const ao = a as Rec;
  const bo = b as Rec;
  // undefined members count as missing (JSON drops them).
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)].filter((k) => ao[k] !== undefined || bo[k] !== undefined));
  return [...keys].every((k) => deepEqual(ao[k], bo[k]));
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function mergeNumber(stored: unknown, saved: unknown, base: unknown): unknown {
  if (deepEqual(stored, base)) return saved;
  if (isNum(stored) && isNum(saved) && isNum(base)) return Math.max(0, stored + (saved - base));
  return undefined;
}

// Keys a single change spans: archiving moves a quest item from one list to
// the other. If one of them conflicts, none of them is written, or the item
// would end up in both lists (or neither).
const KEPT_TOGETHER: readonly (readonly string[])[] = [["questItems", "questItemsArchived"]];

export function mergeAgainstBase(stored: Rec, patch: Rec, base: Rec): { patch: Rec; conflicts: string[] } {
  const merged = mergeEachKey(stored, patch, base);
  for (const group of KEPT_TOGETHER) {
    if (!group.some((k) => merged.conflicts.includes(k))) continue;
    for (const k of group) {
      if (!(k in patch)) continue;
      delete merged.patch[k];
      if (!merged.conflicts.includes(k)) merged.conflicts.push(k);
    }
  }
  return merged;
}

function mergeEachKey(stored: Rec, patch: Rec, base: Rec): { patch: Rec; conflicts: string[] } {
  const out: Rec = {};
  const conflicts: string[] = [];
  for (const [key, saved] of Object.entries(patch)) {
    if (!(key in base)) {
      out[key] = saved;
      continue;
    }
    if ((STAT_MAPS as readonly string[]).includes(key) && saved && typeof saved === "object") {
      const savedMap = saved as Record<string, unknown>;
      const baseMap = (base[key] && typeof base[key] === "object" ? base[key] : {}) as Record<string, unknown>;
      const storedMap = (stored[key] && typeof stored[key] === "object" ? stored[key] : {}) as Record<string, unknown>;
      const merged: Rec = {};
      for (const [stat, value] of Object.entries(savedMap)) {
        if (!(stat in baseMap)) {
          merged[stat] = value;
          continue;
        }
        const m = mergeNumber(storedMap[stat] ?? 0, value, baseMap[stat]);
        if (m !== undefined) merged[stat] = m;
      }
      out[key] = merged;
      continue;
    }
    const m = deepEqual(stored[key], base[key]) ? saved : mergeNumber(stored[key], saved, base[key]);
    if (m === undefined) conflicts.push(key);
    else out[key] = m;
  }
  return { patch: out, conflicts };
}

// ---------------------------------------------------------------------------
// The sheet's bases: for each key changed and not yet saved, its value when the
// change began. For attributes/skills, per stat.
// ---------------------------------------------------------------------------

export type SaveBase = Rec;

const isStatMap = (key: string): boolean => (STAT_MAPS as readonly string[]).includes(key);
const asRec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});

/** Records the base of every key (stat) the change touches for the first time, from the data before it. */
export function withBase(base: SaveBase, before: Rec, patch: Rec): SaveBase {
  const next: SaveBase = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (isStatMap(key)) {
      const known: Rec = { ...asRec(next[key]) };
      const beforeMap = asRec(before[key]);
      for (const stat of Object.keys(asRec(value))) if (!(stat in known)) known[stat] = beforeMap[stat] ?? 0;
      next[key] = known;
    } else if (!(key in next)) {
      next[key] = before[key];
    }
  }
  return next;
}

/** The base to send with a save of `patch`. */
export function baseFor(base: SaveBase, patch: Rec): Rec {
  const out: Rec = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in base)) continue;
    if (isStatMap(key)) {
      const known = asRec(base[key]);
      out[key] = Object.fromEntries(Object.keys(asRec(value)).filter((s) => s in known).map((s) => [s, known[s]]));
    } else {
      out[key] = base[key];
    }
  }
  return out;
}

/**
 * The bases after a save of `patch` answered with `saved`. A key changed again
 * while the save ran gets the saved value as its new base. A key not changed
 * again needs none: the sheet takes the stored value. A conflicted key changed
 * again keeps its old base, so a change made on the rejected state is rejected
 * too instead of overwriting what someone else wrote.
 */
export function baseAfterSave(base: SaveBase, patch: Rec, saved: Rec, touched: ReadonlySet<string>, conflicts: readonly string[]): SaveBase {
  const next: SaveBase = { ...base };
  for (const key of Object.keys(patch)) {
    if (!touched.has(key)) {
      delete next[key];
    } else if (conflicts.includes(key)) {
      // keep the old base
    } else if (isStatMap(key)) {
      const savedMap = asRec(saved[key]);
      next[key] = { ...asRec(next[key]), ...Object.fromEntries(Object.keys(asRec(patch[key])).map((s) => [s, savedMap[s] ?? 0])) };
    } else {
      next[key] = saved[key];
    }
  }
  return next;
}
