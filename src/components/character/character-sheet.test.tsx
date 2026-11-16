// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useToastStore } from "@/stores/toast-store";

// C2 on the real sheet: a save carries the base of what it changed, so the
// server can merge it with what the DM or the AI wrote meanwhile; a conflict
// in the answer is shown to the player.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }), usePathname: () => "/characters/1" }));

const { CharacterSheet } = await import("./character-sheet");

let container: HTMLDivElement;
let root: Root;
let puts: Record<string, unknown>[];
let putReply: (body: Record<string, unknown>) => Record<string, unknown>;

const ROW = {
  id: 1, userId: "u", campaignId: null, name: "Mira", xp: 0, xpSpent: 0,
  raceClassLocked: false, attributesLocked: false, abilitiesLocked: false,
  createdAt: "2026-11-11T00:00:00Z", updatedAt: "2026-11-11T00:00:00Z", deletedAt: null, viewerIsDm: false,
  data: { hp: 10, maxHp: 20 },
};

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (url === "/api/characters/1" && (!init?.method || init.method === "GET")) return new Response(JSON.stringify(ROW), { status: 200 });
  if (url === "/api/characters/1" && init?.method === "PUT") {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    puts.push(body);
    return new Response(JSON.stringify(putReply(body)), { status: 200 });
  }
  return new Response(JSON.stringify({}), { status: 200 });
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await act(() => new Promise((r) => setTimeout(r, 10)));
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  puts = [];
  useToastStore.setState({ toasts: [] });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <CharacterSheet id={1} />
      </QueryClientProvider>,
    ),
  );
  await settle();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const heal = (): Promise<void> =>
  act(async () => {
    container.querySelector<HTMLButtonElement>('button[aria-label="Increase HP"]')!.click();
  });

describe("CharacterSheet saves against its base", () => {
  it("sends the value the change started from", async () => {
    // The DM dealt 5 damage meanwhile: the server merges and answers 6.
    putReply = () => ({ ...ROW, data: { ...ROW.data, hp: 6 } });
    await heal();
    await settle();
    expect(puts).toEqual([{ data: { hp: 11 }, base: { hp: 10 } }]);
  });

  it("tells the player when part of a save was not written", async () => {
    putReply = () => ({ ...ROW, conflicts: ["questItems"] });
    await heal();
    await settle();
    const messages = useToastStore.getState().toasts.map((t) => t.message);
    expect(messages.some((m) => m.includes("was not saved") || m.includes("sparades inte"))).toBe(true);
  });
});
