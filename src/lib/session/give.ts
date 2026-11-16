import { toNameList } from "@/lib/schemas/tolerant";

// Who holds a session item or equipment (its `givenTo` list) when the DM
// hands it out or takes it back in play. The characters' own lists are
// changed by the server; this keeps the session card in step with them.

/** "move" hands it over (the others lose it), "share" gives one more character it too. */
export type GiveMode = "move" | "share";

/** The session lists an entry can be given from. */
export type GiveKind = "items" | "equipment";

export function givenAfterGive(current: readonly string[], name: string, mode: GiveMode): string[] {
  return mode === "move" ? toNameList([name]) : toNameList([...current, name]);
}

export function givenAfterTakeBack(current: readonly string[], name: string): string[] {
  return current.filter((n) => n !== name);
}

type Placed = { stashId: number | null; name: string; givenTo: string[] };

/**
 * Applies `change` to the entry's holders. The server answers after a round
 * trip, and by then the list may have changed (the MCP adds or removes during
 * play), so the entry is looked up again: at `index` if it is still the same
 * entry, otherwise by stash id or name. Returns the same list when the entry
 * is gone.
 */
export function withGivenTo<T extends Placed>(
  list: T[],
  index: number,
  ref: { stashId: number | null; name: string },
  change: (current: readonly string[]) => string[],
  extra: Partial<T> = {},
): T[] {
  const same = (e: T): boolean => (ref.stashId ? e.stashId === ref.stashId : e.name === ref.name);
  const at = list[index] && same(list[index]) ? index : list.findIndex(same);
  if (at < 0) return list;
  return list.map((e, i) => (i === at ? { ...e, ...extra, givenTo: change(e.givenTo) } : e));
}
