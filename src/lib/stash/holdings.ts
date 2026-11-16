// What a character holds of a stash entry, and what taking it back removes.
//
// A character holds a quest item in `questItems` (or `questItemsArchived`
// once the player archived it) and equipment in `dmEquipment`. Equipping DM
// equipment puts a copy named "<name> (DM)" in a weapon/armor/shield slot, so
// taking the equipment back also empties those slots; otherwise the copy keeps
// giving its bonuses.
//
// An entry is matched on its stash id. Rows given before every item was a
// stash entry have no stash id, and those are matched on name.

export type HeldKind = "quest" | "equipment";

/** The stash entry to look for: its id when known, and its current name. */
export type HeldEntry = { stashId?: number; name: string };

type Row = Record<string, unknown>;

export const DM_COPY_SUFFIX = " (DM)";

function isRow(v: unknown): v is Row {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function rows(v: unknown): Row[] {
  return Array.isArray(v) ? v.filter(isRow) : [];
}

export function matchesHeld(row: Row, entry: HeldEntry): boolean {
  const name = typeof row.name === "string" ? row.name : "";
  if (entry.stashId) {
    if (row.stashId === entry.stashId) return true;
    return typeof row.stashId !== "number" && name === entry.name;
  }
  return name === entry.name;
}

/** Whether the character's data holds the entry (active or archived). */
export function holdsEntry(data: Row, kind: HeldKind, entry: HeldEntry): boolean {
  const keys = kind === "quest" ? ["questItems", "questItemsArchived"] : ["dmEquipment"];
  return keys.some((k) => rows(data[k]).some((r) => matchesHeld(r, entry)));
}

/**
 * The data patch that takes the entry away from a character, or null when the
 * character does not hold it. Only the lists that change are in the patch.
 */
export function takeBackPatch(data: Row, kind: HeldKind, entry: HeldEntry): Row | null {
  const patch: Row = {};

  if (kind === "quest") {
    for (const key of ["questItems", "questItemsArchived"] as const) {
      const list = rows(data[key]);
      const kept = list.filter((r) => !matchesHeld(r, entry));
      if (kept.length !== list.length) patch[key] = kept;
    }
    return Object.keys(patch).length > 0 ? patch : null;
  }

  const held = rows(data.dmEquipment);
  const kept = held.filter((r) => !matchesHeld(r, entry));
  if (kept.length === held.length) return null;
  patch.dmEquipment = kept;

  // The stored name can be older than the stash entry's current name, and the
  // copy got whichever name the player saw when equipping it.
  const names = new Set<string>([entry.name]);
  for (const r of held) if (matchesHeld(r, entry) && typeof r.name === "string") names.add(r.name);
  const copies = new Set([...names].map((n) => `${n}${DM_COPY_SUFFIX}`));
  const isCopy = (r: Row): boolean => typeof r.name === "string" && copies.has(r.name);

  for (const key of ["equippedWeapons", "equippedArmor"] as const) {
    const list = rows(data[key]);
    const left = list.filter((r) => !isCopy(r));
    if (left.length !== list.length) patch[key] = left;
  }
  if (isRow(data.equippedShield) && isCopy(data.equippedShield)) patch.equippedShield = null;

  return patch;
}

/**
 * A player's own write of their quest item lists. The sheet only moves items
 * between active and archived (and sends both lists whole); a player never
 * adds quest items, the DM hands them out. So every element must be one the
 * character already holds. An element with a stash id must match a held stash
 * id: the read lays that stash entry's name and description over it, so an
 * unheld id would show the player a DM's prepared item. Anything else is
 * dropped (a stale tab can also send an item the DM has since taken back).
 */
export function keepHeldQuestItems(current: Row, patch: Row): { patch: Row; dropped: number } {
  const held = [...rows(current.questItems), ...rows(current.questItemsArchived)];
  const ids = new Set(held.map((r) => r.stashId).filter((id): id is number => typeof id === "number"));
  const names = new Set(held.map((r) => r.name).filter((n): n is string => typeof n === "string"));
  const isHeld = (e: unknown): boolean =>
    isRow(e) && (typeof e.stashId === "number" ? ids.has(e.stashId) : typeof e.name === "string" && names.has(e.name));

  const out: Row = { ...patch };
  let dropped = 0;
  for (const key of ["questItems", "questItemsArchived"] as const) {
    if (!(key in patch)) continue;
    const list = Array.isArray(patch[key]) ? (patch[key] as unknown[]) : [];
    const kept = list.filter(isHeld);
    dropped += list.length - kept.length;
    out[key] = kept;
  }
  return { patch: out, dropped };
}
