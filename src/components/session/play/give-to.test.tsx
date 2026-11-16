// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GiveMode } from "@/lib/session/give";

vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => true }));

const { GiveToButton } = await import("./give-to");

const TARGETS = [
  { id: 1, name: "Arvid", subtitle: "" },
  { id: 2, name: "Sigrun", subtitle: "" },
  { id: 3, name: "Bo", subtitle: "" },
];

let container: HTMLDivElement;
let root: Root;
let gives: [string, GiveMode][];
let takenBack: string[];

async function render(holders: string[]): Promise<void> {
  await act(async () => {
    root.render(
      <GiveToButton what="Map" holders={holders} disabled={false} targets={TARGETS}
        onGive={(target, mode) => gives.push([target.name, mode])} onTakeBack={(name) => takenBack.push(name)} />,
    );
  });
}

const button = (label: string): HTMLButtonElement => {
  const b = Array.from(container.querySelectorAll("button")).find((el) => el.textContent?.trim() === label || el.getAttribute("aria-label") === label);
  if (!b) throw new Error(`no button "${label}"`);
  return b;
};
const menuItem = (name: string): HTMLButtonElement => {
  const b = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find((el) => el.textContent?.includes(name));
  if (!b) throw new Error(`no menu item "${name}"`);
  return b;
};
const shareToggle = (): HTMLInputElement | null => container.querySelector('input[type="checkbox"]');
const click = (el: HTMLElement): Promise<void> => act(async () => el.click());
const openMenu = (): Promise<void> => click(button("Give to"));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  gives = [];
  takenBack = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("GiveToButton", () => {
  it("hands it to the picked character; with nobody holding it there is nothing to share", async () => {
    await render([]);
    await openMenu();
    expect(shareToggle()).toBeNull();
    await click(menuItem("Bo"));
    expect(gives).toEqual([["Bo", "move"]]);
  });

  it("moves by default when someone holds it, and shares when that is switched on", async () => {
    await render(["Arvid"]);
    await openMenu();
    await click(menuItem("Bo"));
    expect(gives).toEqual([["Bo", "move"]]);

    await openMenu();
    await click(shareToggle()!);
    await click(menuItem("Sigrun"));
    expect(gives).toEqual([["Bo", "move"], ["Sigrun", "share"]]);
  });

  it("starts every hand-out as a move, even after sharing last time", async () => {
    await render(["Arvid"]);
    await openMenu();
    await click(shareToggle()!);
    await click(menuItem("Bo"));
    await openMenu();
    expect(shareToggle()!.checked).toBe(false);
  });

  it("marks the holders, and offers nothing that would change nothing", async () => {
    await render(["Arvid"]);
    await openMenu();
    expect(menuItem("Arvid").querySelector('[aria-label="Has it"]')).not.toBeNull();
    expect(menuItem("Sigrun").querySelector('[aria-label="Has it"]')).toBeNull();
    // Moving it to the only holder changes nothing.
    expect(menuItem("Arvid").disabled).toBe(true);

    await render(["Arvid", "Sigrun"]);
    // Moving to one of two holders takes it from the other.
    expect(menuItem("Arvid").disabled).toBe(false);
    await click(shareToggle()!);
    // Sharing with someone who has it changes nothing.
    expect(menuItem("Arvid").disabled).toBe(true);
    expect(menuItem("Bo").disabled).toBe(false);
  });

  it("shows every holder with a take-back of its own", async () => {
    await render(["Arvid", "Sigrun"]);
    expect(container.textContent).toContain("With Arvid");
    expect(container.textContent).toContain("With Sigrun");
    await click(button("Take Map back from Sigrun"));
    expect(takenBack).toEqual(["Sigrun"]);
  });
});
