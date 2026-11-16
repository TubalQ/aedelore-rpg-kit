// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionDataSchema, SessionEquipmentSchema, SessionItemSchema, type SessionData } from "@/lib/schemas/session";
import { useGiveInPlay, type UpdateGiveList } from "./useGiveInPlay";

// The play view's give/take-back against a fake control endpoint: what is
// sent, and what the session card's holders become once the server answered.

type Lists = SessionData;
type Giving = ReturnType<typeof useGiveInPlay>;

const CONTROL = "/api/campaigns/9/characters/control";
let bodies: Record<string, unknown>[];
let status: number;
let gate: Promise<void> | null;

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (String(input) !== CONTROL) return new Response("{}", { status: 500 });
  bodies.push(JSON.parse(String(init?.body)));
  if (gate) await gate;
  return new Response(JSON.stringify(status === 200 ? { success: true } : { error: "nope" }), { status });
}

let container: HTMLDivElement;
let root: Root;
let lists: Lists;
let giving: Giving;
let setLists: (change: (prev: Lists) => Lists) => void;

type Exposed = { state: Lists; setState: typeof setLists; giving: Giving };

/** The editor's part: its session data, and a list update against the latest copy. */
function Harness({ initial, expose }: { initial: Lists; expose: (e: Exposed) => void }): null {
  const [state, setState] = useState(initial);
  const updateList: UpdateGiveList = (key, change) => setState((prev) => ({ ...prev, [key]: change(prev[key]) }));
  expose({ state, setState, giving: useGiveInPlay(9, 4, updateList) });
  return null;
}

async function mount(lists0: Pick<Lists, "items" | "equipment">): Promise<void> {
  const initial = SessionDataSchema.parse(lists0);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <Harness initial={initial} expose={(e) => { lists = e.state; setLists = e.setState; giving = e.giving; }} />
      </QueryClientProvider>,
    );
  });
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await act(() => new Promise((r) => setTimeout(r, 5)));
}

const item = (name: string, stashId: number | null, givenTo: string[]) => SessionItemSchema.parse({ name, stashId, givenTo });
const BO = { id: 3, name: "Bo", subtitle: "" };

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  bodies = [];
  status = 200;
  gate = null;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("giving in play", () => {
  it("moves an item: the server is asked to take it from the others, the card shows only the new holder", async () => {
    await mount({ items: [item("Map", 1, ["Arvid"])], equipment: [] });
    await act(async () => giving.give("items", 0, lists.items[0], BO, "move"));
    await settle();
    expect(bodies).toEqual([
      { action: "giveItem", characterId: 3, move: true, item: { name: "Map", description: "", sessionName: "Session 4", stashId: 1 } },
    ]);
    expect(lists.items[0].givenTo).toEqual(["Bo"]);
    expect(lists.items[0].found).toBe(true);
  });

  it("shares an item: the others keep it", async () => {
    await mount({ items: [item("Map", 1, ["Arvid"])], equipment: [] });
    await act(async () => giving.give("items", 0, lists.items[0], BO, "share"));
    await settle();
    expect(bodies[0]).toMatchObject({ action: "giveItem", move: false });
    expect(lists.items[0].givenTo).toEqual(["Arvid", "Bo"]);
  });

  it("gives equipment with its stash entry and content", async () => {
    const eq = SessionEquipmentSchema.parse({ name: "Frost Blade", stashId: 5, type: "weapon", damage: "1d8" });
    await mount({ items: [], equipment: [eq] });
    await act(async () => giving.give("equipment", 0, lists.equipment[0], BO, "move"));
    await settle();
    expect(bodies[0]).toMatchObject({ action: "giveEquipment", characterId: 3, move: true, equipment: { name: "Frost Blade", type: "weapon", damage: "1d8", stashId: 5 } });
    expect(lists.equipment[0].givenTo).toEqual(["Bo"]);
  });

  it("leaves the card as it was when the server refuses", async () => {
    status = 500;
    await mount({ items: [item("Map", 1, ["Arvid"])], equipment: [] });
    await act(async () => giving.give("items", 0, lists.items[0], BO, "move"));
    await settle();
    expect(lists.items[0].givenTo).toEqual(["Arvid"]);
  });

  it("updates the right entry when the list changed while the server answered", async () => {
    let open: () => void = () => {};
    gate = new Promise((r) => { open = r; });
    await mount({ items: [item("Map", 1, []), item("Key", 2, [])], equipment: [] });
    await act(async () => giving.give("items", 1, lists.items[1], BO, "move"));
    // The MCP adds an item at the top meanwhile.
    await act(async () => setLists((prev) => ({ ...prev, items: [item("Coin", 3, []), ...prev.items] })));
    await act(async () => open());
    await settle();
    expect(lists.items.map((i) => [i.name, i.givenTo])).toEqual([["Coin", []], ["Map", []], ["Key", ["Bo"]]]);
  });
});

describe("taking back in play", () => {
  it("asks the server to take it back by stash entry, then clears the holder", async () => {
    await mount({ items: [item("Map", 1, ["Arvid", "Bo"])], equipment: [] });
    await act(async () => giving.takeBack("items", 0, lists.items[0], { id: 1, name: "Arvid" }));
    await settle();
    expect(bodies).toEqual([{ action: "removeItem", characterId: 1, itemName: "Map", stashId: 1 }]);
    expect(lists.items[0].givenTo).toEqual(["Bo"]);
  });

  it("clears the holder when the character no longer has it (404)", async () => {
    status = 404;
    await mount({ items: [item("Map", 1, ["Arvid"])], equipment: [] });
    await act(async () => giving.takeBack("items", 0, lists.items[0], { id: 1, name: "Arvid" }));
    await settle();
    expect(lists.items[0].givenTo).toEqual([]);
  });

  it("keeps the holder when taking back fails for another reason", async () => {
    status = 500;
    await mount({ items: [item("Map", 1, ["Arvid"])], equipment: [] });
    await act(async () => giving.takeBack("items", 0, lists.items[0], { id: 1, name: "Arvid" }));
    await settle();
    expect(lists.items[0].givenTo).toEqual(["Arvid"]);
  });

  it("only corrects the card when nobody in the campaign has that name any more", async () => {
    await mount({ items: [item("Map", 1, ["Ghost"])], equipment: [] });
    await act(async () => giving.takeBack("items", 0, lists.items[0], { id: null, name: "Ghost" }));
    await settle();
    expect(bodies).toEqual([]);
    expect(lists.items[0].givenTo).toEqual([]);
  });
});
