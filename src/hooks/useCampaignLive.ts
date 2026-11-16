"use client";

import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Live updates (#82): one EventSource per open campaign, shared by every
// component that follows it. An event only says which table changed; the
// queries that show it are invalidated, so they refetch through their own
// endpoints right away instead of on the next poll. The polls stay as the
// fallback when the stream is down.
// ---------------------------------------------------------------------------

type Table = "game_sessions" | "characters" | "campaign_players" | "campaign_items" | "campaign_bans" | "campaigns";

interface Stream {
  source: EventSource;
  users: number;
  pending: Set<Table | "all">;
  timer: ReturnType<typeof setTimeout> | null;
}

const streams = new Map<number, Stream>();

// Several changes in a burst (an autosave touches a row once per save) become one refetch.
const DEBOUNCE_MS = 250;

/**
 * The query keys to refetch for changes to these tables in the campaign: only
 * what shows that table, so a burst of changes stays a few requests (a broad
 * refetch of everything hit the per-IP rate limit in testing).
 */
export function keysFor(campaignId: number, tables: Iterable<Table | "all">): (readonly unknown[])[] {
  const c = (...rest: string[]): readonly unknown[] => ["campaigns", campaignId, ...rest];
  const byTable: Record<Table, (readonly unknown[])[]> = {
    characters: [c("characters"), c("player-view"), ["characters"]],
    game_sessions: [c("sessions"), c("player-view"), ["sessions"]],
    campaign_players: [c("players"), c("characters"), c("player-view"), ["campaigns"]],
    campaign_bans: [c("excluded"), c("player-view")],
    campaign_items: [c("stash"), c("player-view"), ["sessions"], ["characters"]],
    campaigns: [c(), ["campaigns"]],
  };
  const set = new Set(tables);
  if (set.has("all")) return [c(), ["campaigns"], ["sessions"], ["characters"]];
  const seen = new Map<string, readonly unknown[]>();
  for (const t of set) for (const k of byTable[t as Table] ?? []) seen.set(JSON.stringify(k), k);
  return [...seen.values()];
}

function flush(qc: QueryClient, campaignId: number, stream: Stream): void {
  stream.timer = null;
  const tables = [...stream.pending];
  stream.pending.clear();
  for (const queryKey of keysFor(campaignId, tables)) {
    // ["campaigns"] and ["campaigns", id] mean exactly those (list, detail),
    // except on a (re)connect, which catches up on everything in the campaign.
    const exact = !tables.includes("all") && queryKey.length <= 2 && queryKey[0] === "campaigns";
    void qc.invalidateQueries({ queryKey, exact });
  }
}

function open(qc: QueryClient, campaignId: number): Stream {
  const source = new EventSource(`/api/campaigns/${campaignId}/events`);
  const stream: Stream = { source, users: 0, pending: new Set(), timer: null };
  const queue = (table: Table | "all"): void => {
    stream.pending.add(table);
    stream.timer ??= setTimeout(() => flush(qc, campaignId, stream), DEBOUNCE_MS);
  };
  source.onmessage = (e: MessageEvent<string>) => {
    try {
      const { t } = JSON.parse(e.data) as { t?: Table };
      queue(t ?? "all");
    } catch {
      queue("all");
    }
  };
  // On a reconnect: catch up on what changed while not listening. The first
  // "ready" comes right after the page loaded its data, so refetching then
  // only doubled the requests (429 when two tabs reloaded at once).
  let connected = false;
  source.addEventListener("ready", () => {
    if (connected) queue("all");
    connected = true;
  });
  // No longer allowed to follow (removed, campaign trashed): stop, refetch once.
  source.addEventListener("gone", () => {
    source.close();
    queue("all");
  });
  return stream;
}

/** Follow a campaign live while the component is mounted. 0 or less: nothing. */
export function useCampaignLive(campaignId: number | null | undefined): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!campaignId || campaignId <= 0 || typeof EventSource === "undefined") return;
    let stream = streams.get(campaignId);
    if (!stream || stream.source.readyState === EventSource.CLOSED) {
      stream = open(qc, campaignId);
      streams.set(campaignId, stream);
    }
    stream.users += 1;
    const mine = stream;
    return () => {
      mine.users -= 1;
      if (mine.users > 0) return;
      if (mine.timer) clearTimeout(mine.timer);
      mine.source.close();
      if (streams.get(campaignId) === mine) streams.delete(campaignId);
    };
  }, [campaignId, qc]);
}
