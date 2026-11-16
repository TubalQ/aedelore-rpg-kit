// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionDataSchema, newNpc, type SessionData } from "@/lib/schemas/session";

// The real SessionEditor, autosave and React Query hooks against an in-memory
// server. Only the heavy child views are stubbed: the stub lists the npcs and
// the event log and has buttons that edit them the way the real views do
// (a whole-list patch through onDataChange).
//
// Regression guard for changes made elsewhere while the editor is open (the
// MCP during play): they must reach the editor, and the editor's next save of
// the same list must not write them away.

type DataChange = (patch: Partial<SessionData>, immediate?: boolean) => void;

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/useCampaigns", () => ({
  useCampaignCharacters: () => ({ data: [] }),
  useCampaigns: () => ({ data: [] }),
  useDmCharacterControl: () => ({ mutate: vi.fn() }),
}));
vi.mock("./play/play-view", () => ({ PlayView: () => null }));
vi.mock("./plan/session-panel", () => ({ SessionPanel: () => null }));
vi.mock("./plan/plan-view", () => ({
  PlanView: ({ data, onDataChange }: { data: SessionData; onDataChange: DataChange }) => (
    <div>
      <ul data-testid="npcs">{data.npcs.map((n, i) => <li key={i}>{n.name}</li>)}</ul>
      <ul data-testid="events">{data.eventLog.map((e, i) => <li key={i}>{e.text}</li>)}</ul>
      <button
        data-testid="rename-first-npc"
        onClick={() => onDataChange({ npcs: data.npcs.map((n, i) => (i === 0 ? { ...n, name: `${n.name}!` } : n)) })}
      />
    </div>
  ),
}));

const { SessionEditor } = await import("./session-editor");

// ---------------------------------------------------------------------------
// In-memory server: GET returns the row, PUT merges data per top-level key
// (what updateSession does with `data || patch`).
// ---------------------------------------------------------------------------

let row: { id: number; campaignId: number; sessionNumber: number; title: string; date: null; location: null; gameLocation: null; status: string; data: SessionData };
const puts: Record<string, unknown>[] = [];

function serverWrite(patch: Partial<SessionData>): void {
  row = { ...row, data: SessionDataSchema.parse({ ...row.data, ...patch }) };
}

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (url === "/api/sessions/1" && (!init?.method || init.method === "GET")) {
    return new Response(JSON.stringify(row), { status: 200 });
  }
  if (url === "/api/sessions/1" && init?.method === "PUT") {
    const body = JSON.parse(String(init.body)) as { data?: Partial<SessionData> };
    puts.push(body);
    if (body.data) serverWrite(body.data);
    return new Response(JSON.stringify(row), { status: 200 });
  }
  return new Response(JSON.stringify({ error: `unexpected ${init?.method ?? "GET"} ${url}` }), { status: 500 });
}

// The editor takes server data into its local copy in a render of its own
// after the refetch, so assertions on the DOM wait for it.

// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

const texts = (testId: string): string[] =>
  Array.from(container.querySelectorAll(`[data-testid="${testId}"] li`)).map((li) => li.textContent ?? "");

async function waitFor(check: () => boolean, ms = 4000): Promise<void> {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error("waitFor timed out");
    await act(() => new Promise((r) => setTimeout(r, 25)));
  }
}

/** What the 10 s poll does, without waiting 10 s. */
const poll = (): Promise<void> => act(() => queryClient.refetchQueries({ queryKey: ["sessions", 1] }));

const click = (testId: string): Promise<void> =>
  act(async () => {
    container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click();
  });

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  puts.length = 0;
  row = {
    id: 1, campaignId: 9, sessionNumber: 1, title: "Test", date: null, location: null, gameLocation: null, status: "active",
    data: SessionDataSchema.parse({ npcs: [newNpc({ name: "Arvid" })] }),
  };
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <SessionEditor sessionId={1} />
      </QueryClientProvider>,
    );
  });
  await waitFor(() => texts("npcs").length > 0);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  queryClient.clear();
  vi.unstubAllGlobals();
});

describe("SessionEditor with changes made elsewhere", () => {
  it("polls the session while it is open", () => {
    const query = queryClient.getQueryCache().find({ queryKey: ["sessions", 1] });
    expect(query?.options).toMatchObject({ refetchInterval: 10_000 });
  });

  it("shows an npc the MCP added, and keeps it when the user then edits the npc list", async () => {
    serverWrite({ npcs: [...row.data.npcs, newNpc({ name: "Sigrun" })] });
    await poll();
    await waitFor(() => texts("npcs").length === 2);
    expect(texts("npcs")).toEqual(["Arvid", "Sigrun"]);

    await click("rename-first-npc");
    await waitFor(() => puts.length > 0);

    expect(row.data.npcs.map((n) => n.name)).toEqual(["Arvid!", "Sigrun"]);
  });

  it("keeps an unsaved npc edit through a poll and still takes the event the MCP logged", async () => {
    await click("rename-first-npc"); // queued, not yet saved (1.5 s debounce)
    serverWrite({ eventLog: SessionDataSchema.parse({ eventLog: [{ text: "Logged by the MCP" }] }).eventLog });
    await poll();
    await waitFor(() => texts("events").length === 1);

    expect(texts("npcs")).toEqual(["Arvid!"]);
    expect(texts("events")).toEqual(["Logged by the MCP"]);

    await waitFor(() => puts.length > 0);
    expect(puts[0]).toEqual({ data: { npcs: expect.any(Array) } });
    expect(row.data.npcs.map((n) => n.name)).toEqual(["Arvid!"]);
    expect(row.data.eventLog.map((e) => e.text)).toEqual(["Logged by the MCP"]);
  });
});
