// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StashEntry } from "@/lib/schemas/stash";

// Placing from the stash: planned equipment starts hidden from players (S4),
// an item starts visible (players see items only once found), and the DM's
// choice is what is sent.

const placed: Record<string, unknown>[] = [];

vi.mock("@/hooks/useSessions", () => ({
  useCampaignSessions: () => ({ data: [{ id: 5, sessionNumber: 1, title: "One", status: "active", data: { encounters: [] } }] }),
}));
vi.mock("@/hooks/useCampaigns", () => ({ useCampaignCharacters: () => ({ data: [] }) }));
vi.mock("@/hooks/useStash", () => ({
  usePlaceStashEntry: () => ({ mutate: (v: { placement: Record<string, unknown> }) => placed.push(v.placement), isPending: false }),
  useGiveStashEntry: () => ({ mutate: vi.fn(), isPending: false }),
}));

const { StashPlaceDialog } = await import("./stash-place-dialog");

const entry = (kind: "quest" | "equipment"): StashEntry => ({
  id: 7, kind, data: { name: kind === "quest" ? "Map" : "Frost Blade" }, sortOrder: 0, createdAt: "", updatedAt: "", placements: [], holders: [],
});

let container: HTMLDivElement;
let root: Root;

async function open(kind: "quest" | "equipment"): Promise<void> {
  await act(async () => root.render(<StashPlaceDialog campaignId={1} entry={entry(kind)} mode="place" onModeChange={() => {}} onClose={() => {}} />));
}
const checked = (): string | undefined => container.querySelector<HTMLInputElement>('input[name="vis"]:checked')?.value;
const submit = (): Promise<void> => act(async () => container.querySelector<HTMLFormElement>("form")!.requestSubmit());

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  placed.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("StashPlaceDialog visibility", () => {
  it("starts equipment hidden from players, and sends that", async () => {
    await open("equipment");
    expect(checked()).toBe("dm");
    await submit();
    expect(placed[0]).toMatchObject({ sessionId: 5, visibleTo: "dm" });
  });

  it("starts an item visible (players see it once found)", async () => {
    await open("quest");
    expect(checked()).toBe("all");
  });

  it("sends what the DM picks", async () => {
    await open("equipment");
    await act(async () => container.querySelector<HTMLInputElement>('input[name="vis"][value="all"]')!.click());
    await submit();
    expect(placed[0]).toMatchObject({ visibleTo: "all" });
  });
});
