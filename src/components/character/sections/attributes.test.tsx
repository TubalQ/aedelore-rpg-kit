// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CharacterDataSchema, type CharacterData } from "@/lib/schemas/character";
import { ATTRIBUTE_NAMES } from "@/lib/domain/attributes";
import { AttributesSection } from "./attributes";

// C1 on the sheet: in DM mode the sheet was in creation mode, so a stat bought
// with XP was clamped to the creation cap (3) on "-" as well as "+". The DM now
// adjusts through the DM endpoint, and creation mode lowers from where the stat is.

const ATTR = ATTRIBUTE_NAMES[0];
const OTHER = ATTRIBUTE_NAMES[1];

let container: HTMLDivElement;
let root: Root;
let changes: Partial<CharacterData>[];
let adjusts: [string, string, number][];

async function render(opts: { dm: boolean; attrs: Record<string, number> }): Promise<void> {
  const data = CharacterDataSchema.parse({ attributes: opts.attrs });
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <AttributesSection
          characterId={1}
          data={data}
          locked={false}
          xpPointsAvailable={0}
          onChange={(p) => changes.push(p)}
          dmAdjust={opts.dm ? { onAdjust: (map, name, delta) => adjusts.push([map, name, delta]), pending: false } : undefined}
        />
      </QueryClientProvider>,
    ),
  );
}

const button = (label: string): HTMLButtonElement => {
  const b = Array.from(container.querySelectorAll("button")).find((el) => el.getAttribute("aria-label") === label);
  if (!b) throw new Error(`no button ${label}`);
  return b;
};
const click = (el: HTMLElement): Promise<void> => act(async () => el.click());

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  changes = [];
  adjusts = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("AttributesSection, DM mode", () => {
  it("adjusts by one through the DM endpoint, with no cap and no point budget", async () => {
    await render({ dm: true, attrs: { [ATTR]: 5 } });
    expect(button(`Increase ${ATTR}`).disabled).toBe(false);
    await click(button(`Increase ${ATTR}`));
    await click(button(`Decrease ${ATTR}`));
    expect(adjusts).toEqual([["attributes", ATTR, 1], ["attributes", ATTR, -1]]);
    expect(changes).toEqual([]);
  });
});

describe("AttributesSection, building the character", () => {
  it("lowers a stat above the cap by one, sending only that stat", async () => {
    await render({ dm: false, attrs: { [ATTR]: 5, [OTHER]: 1 } });
    await click(button(`Decrease ${ATTR}`));
    expect(changes).toEqual([{ attributes: { [ATTR]: 4 } }]);
  });

  it("still stops raising at the cap", async () => {
    await render({ dm: false, attrs: { [ATTR]: 3 } });
    expect(button(`Increase ${ATTR}`).disabled).toBe(true);
  });
});
