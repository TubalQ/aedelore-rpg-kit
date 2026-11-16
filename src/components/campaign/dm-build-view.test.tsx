// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CharacterDataSchema } from "@/lib/schemas/character";
import { ATTRIBUTE_NAMES, getSkillsForAttribute } from "@/lib/domain/attributes";
import type { CampaignCharacter } from "@/lib/db/queries/campaigns";
import { DmBuildView } from "./dm-build-view";

// C1: the DM's build view clamped "+" to the creation cap (lowering stats
// bought with XP) and saved every stat from its snapshot. It now saves only
// what the DM changed, as deltas.

const ATTR = ATTRIBUTE_NAMES[0];
const OTHER = ATTRIBUTE_NAMES[1];
const SKILL = getSkillsForAttribute(ATTR)[0];

let container: HTMLDivElement;
let root: Root;
let actions: Record<string, unknown>[];

function character(): CampaignCharacter {
  return {
    id: 7,
    name: "Mira",
    playerName: "Player",
    playerId: "p1",
    data: CharacterDataSchema.parse({ attributes: { [ATTR]: 5, [OTHER]: 2 }, skills: { [SKILL]: 4 } }),
    xp: 60,
    xpSpent: 20,
    raceClassLocked: true,
    attributesLocked: true,
    abilitiesLocked: true,
  };
}

const button = (label: string): HTMLButtonElement => {
  const b = Array.from(container.querySelectorAll("button")).find((el) => el.getAttribute("aria-label") === label || el.textContent?.trim() === label);
  if (!b) throw new Error(`no button ${label}`);
  return b;
};
const click = (el: HTMLElement): Promise<void> => act(async () => el.click());

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  actions = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<DmBuildView char={character()} onAction={(a) => actions.push(a)} isPending={false} />));
  await click(button("Edit"));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("DmBuildView", () => {
  it("raises a stat bought past the creation cap instead of lowering it, and saves only that change", async () => {
    await click(button(`Increase ${ATTR}`));
    await click(button("Save"));
    expect(actions).toEqual([{ action: "adjustStats", characterId: 7, attributes: { [ATTR]: 1 }, skills: {} }]);
  });

  it("lowers by one from the stored value", async () => {
    await click(button(`Decrease ${ATTR}`));
    await click(button(`Decrease ${SKILL}`));
    await click(button("Save"));
    expect(actions).toEqual([{ action: "adjustStats", characterId: 7, attributes: { [ATTR]: -1 }, skills: { [SKILL]: -1 } }]);
  });

  it("saves nothing when nothing changed, and nothing that was changed back", async () => {
    await click(button(`Increase ${OTHER}`));
    await click(button(`Decrease ${OTHER}`));
    await click(button("Save"));
    expect(actions).toEqual([]);
  });
});
