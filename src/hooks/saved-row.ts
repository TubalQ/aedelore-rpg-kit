import type { QueryClient, QueryKey, Updater } from "@tanstack/react-query";

// The editors poll their row and take server data into their local copy. A
// poll that read the row before a save committed can resolve after the save,
// and React Query then writes its stale result over the saved one. The editor
// takes the stale value in, and its next save writes the change away.
//
// So: stop any refetch of the row when a save starts (no stale flicker while
// it runs), and again right before the saved row goes into the cache (a poll
// may have started during the save). Polls after that read the committed row.

export function cancelRowRefetch(qc: QueryClient, queryKey: QueryKey): Promise<void> {
  return qc.cancelQueries({ queryKey, exact: true });
}

export async function writeSavedRow<T>(
  qc: QueryClient,
  queryKey: QueryKey,
  updater: Updater<T | undefined, T | undefined>,
): Promise<void> {
  await cancelRowRefetch(qc, queryKey);
  qc.setQueryData<T>(queryKey, updater);
}
