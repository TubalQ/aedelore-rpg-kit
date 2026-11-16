import type { StashEntry } from "@/lib/schemas/stash";

export type StashStatusKind = "stash" | "placed" | "given";
export const STASH_FILTERS = ["all", "stash", "placed", "given"] as const;
export type StashFilter = (typeof STASH_FILTERS)[number];

/**
 * Where an entry is, most "final" first: held by a character, else placed in a
 * session, else only in the stash. One source for the list, filters and detail.
 */
export function stashStatus(entry: StashEntry): StashStatusKind {
  if (entry.holders.some((h) => !h.archived)) return "given";
  if (entry.placements.length > 0) return "placed";
  return "stash";
}

export function matchesFilter(entry: StashEntry, filter: StashFilter): boolean {
  return filter === "all" || stashStatus(entry) === filter;
}

export function stashName(entry: StashEntry): string {
  return typeof entry.data.name === "string" ? entry.data.name : "";
}
