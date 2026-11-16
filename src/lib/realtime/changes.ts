import postgres from "postgres";

// ---------------------------------------------------------------------------
// Live updates (#82). Postgres triggers (deploy/sql/20261115-change-notify.sql)
// NOTIFY "campaign X changed in table T" on aedelore_changes. One LISTEN
// connection per app process fans that out to the open SSE streams
// (/api/campaigns/[id]/events). Nothing but the table and campaign id travels:
// the browser refetches through the normal, authorized endpoints.
// ---------------------------------------------------------------------------

export const CHANGE_TABLES = ["game_sessions", "characters", "campaign_players", "campaign_items", "campaign_bans", "campaigns"] as const;
export type ChangeTable = (typeof CHANGE_TABLES)[number];
export interface CampaignChange {
  t: ChangeTable;
  c: number;
}

type Listener = (change: CampaignChange) => void;

interface Hub {
  listeners: Map<number, Set<Listener>>;
  started: Promise<void> | null;
}

// One hub per process, also across dev reloads.
const globalHub = globalThis as typeof globalThis & { __aedeloreChanges?: Hub };
const hub: Hub = (globalHub.__aedeloreChanges ??= { listeners: new Map(), started: null });

/** A NOTIFY payload, or null when it is not one of ours. */
export function parseChange(payload: string): CampaignChange | null {
  try {
    const v = JSON.parse(payload) as { t?: unknown; c?: unknown };
    if (typeof v.c !== "number" || !Number.isInteger(v.c)) return null;
    if (!(CHANGE_TABLES as readonly unknown[]).includes(v.t)) return null;
    return { t: v.t as ChangeTable, c: v.c };
  } catch {
    return null;
  }
}

function dispatch(change: CampaignChange): void {
  for (const listener of hub.listeners.get(change.c) ?? []) listener(change);
}

function start(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return Promise.reject(new Error("DATABASE_URL is required for live updates"));
  // Its own connection: LISTEN holds it. postgres-js reconnects and listens
  // again by itself after a drop.
  const sql = postgres(url, { max: 1, idle_timeout: 0 });
  return sql
    .listen("aedelore_changes", (payload) => {
      const change = parseChange(payload);
      if (change) dispatch(change);
    })
    .then(() => undefined);
}

/** Calls `listener` for each change to the campaign; returns the unsubscribe. */
export async function subscribeCampaign(campaignId: number, listener: Listener): Promise<() => void> {
  if (!hub.started) {
    hub.started = start().catch((err: unknown) => {
      hub.started = null; // the next stream tries again
      throw err;
    });
  }
  await hub.started;
  let set = hub.listeners.get(campaignId);
  if (!set) hub.listeners.set(campaignId, (set = new Set()));
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) hub.listeners.delete(campaignId);
  };
}
