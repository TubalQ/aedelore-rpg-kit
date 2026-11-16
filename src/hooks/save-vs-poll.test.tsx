// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSession, useUpdateSession } from "./useSessions";
import { useCharacter, useLockStep, useSpendXp, useUpdateCharacter } from "./useCharacters";

// A save must never be undone by a refetch that read the row before the save
// committed but resolves after it. The editors poll (session 10 s, sheet 30 s)
// and take server data into their local copy, so stale data in the cache would
// be written back by the next save.
//
// The fake server answers each request only when the test says so, which
// lets the test put a poll and a save in any order.

type Pending = { method: string; url: string; answer: (body: unknown) => void };
const pending: Pending[] = [];

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((resolve) => {
    pending.push({
      method: init?.method ?? "GET",
      url: String(input),
      answer: (body) => resolve(new Response(JSON.stringify(body), { status: 200 })),
    });
  });
}

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

async function flush(): Promise<void> {
  await act(() => new Promise((r) => setTimeout(r, 0)));
}

async function waitFor(check: () => boolean, ms = 2000): Promise<void> {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error("waitFor timed out");
    await act(() => new Promise((r) => setTimeout(r, 10)));
  }
}

/** Waits for the request, takes it off the queue and answers it. */
async function answer(method: string, url: string, body: unknown): Promise<void> {
  await waitFor(() => pending.some((p) => p.method === method && p.url === url)).catch((e) => { throw new Error(`${e} waiting ${method} ${url}; pending: ${JSON.stringify(pending.map((p) => [p.method, p.url]))}`); });
  const i = pending.findIndex((p) => p.method === method && p.url === url);
  const [req] = pending.splice(i, 1);
  await act(async () => req.answer(body));
}

/** Starts what the poll does, without answering it. */
async function startPoll(queryKey: readonly unknown[], url: string): Promise<void> {
  const before = pending.filter((p) => p.method === "GET" && p.url === url).length;
  // Not awaited: the poll stays in flight until the test answers it.
  void queryClient.refetchQueries({ queryKey }).catch(() => undefined);
  await waitFor(() => pending.filter((p) => p.method === "GET" && p.url === url).length > before);
}

type Save = () => void;
type HarnessProps = { onSave: (save: Save) => void };

type Case = {
  name: string;
  queryKey: readonly unknown[];
  getUrl: string;
  save: { method: string; url: string };
  Harness: (props: HarnessProps) => null;
};

function SessionSave({ onSave }: HarnessProps): null {
  useSession(1);
  const m = useUpdateSession(1, 9);
  onSave(() => m.mutate({ data: {} }));
  return null;
}

function CharacterSave({ onSave }: HarnessProps): null {
  useCharacter(1);
  const m = useUpdateCharacter(1);
  onSave(() => m.mutate({ data: {} }));
  return null;
}

function XpSpend({ onSave }: HarnessProps): null {
  useCharacter(1);
  const m = useSpendXp(1);
  onSave(() => m.mutate({ attributes: {} }));
  return null;
}

function StepLock({ onSave }: HarnessProps): null {
  useCharacter(1);
  const m = useLockStep(1);
  onSave(() => m.mutate({ step: "attributes", locked: true }));
  return null;
}

const CASES: Case[] = [
  { name: "session save", queryKey: ["sessions", 1], getUrl: "/api/sessions/1", save: { method: "PUT", url: "/api/sessions/1" }, Harness: SessionSave },
  { name: "character save", queryKey: ["characters", 1], getUrl: "/api/characters/1", save: { method: "PUT", url: "/api/characters/1" }, Harness: CharacterSave },
  { name: "spending XP", queryKey: ["characters", 1], getUrl: "/api/characters/1", save: { method: "POST", url: "/api/characters/1/xp" }, Harness: XpSpend },
  { name: "locking a step", queryKey: ["characters", 1], getUrl: "/api/characters/1", save: { method: "POST", url: "/api/characters/1/lock" }, Harness: StepLock },
];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  pending.length = 0;
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  queryClient.clear();
  vi.unstubAllGlobals();
});

async function mount(c: Case): Promise<Save> {
  let save: Save | undefined;
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <c.Harness onSave={(fn) => { save = fn; }} />
      </QueryClientProvider>,
    );
  });
  await answer("GET", c.getUrl, { id: 1, version: "before" });
  await waitFor(() => queryClient.getQueryData(c.queryKey) !== undefined);
  return save!;
}

const cached = (c: Case): unknown =>
  (queryClient.getQueryData(c.queryKey) as { version?: string } | undefined)?.version;

describe.each(CASES)("$name against a poll", (c) => {
  it("keeps the saved row when a poll started before the save resolves after it", async () => {
    const save = await mount(c);
    await startPoll(c.queryKey, c.getUrl);
    await act(async () => save());
    await answer(c.save.method, c.save.url, { id: 1, version: "saved" });
    await waitFor(() => cached(c) === "saved");
    // The poll read the row before the save committed.
    const stale = pending.find((p) => p.method === "GET");
    if (stale) await act(async () => stale.answer({ id: 1, version: "before" }));
    await flush();
    await flush();
    expect(cached(c)).toBe("saved");
  });

  it("keeps the saved row when a poll started during the save resolves after it", async () => {
    const save = await mount(c);
    await act(async () => save());
    await waitFor(() => pending.some((p) => p.method === c.save.method && p.url === c.save.url));
    await startPoll(c.queryKey, c.getUrl);
    await answer(c.save.method, c.save.url, { id: 1, version: "saved" });
    await waitFor(() => cached(c) === "saved");
    const stale = pending.find((p) => p.method === "GET");
    if (stale) await act(async () => stale.answer({ id: 1, version: "before" }));
    await flush();
    await flush();
    expect(cached(c)).toBe("saved");
  });
});
