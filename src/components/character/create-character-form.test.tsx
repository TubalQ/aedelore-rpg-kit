// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The wizard's first step refuses a reserved name ("dm", "all") before the
// player picks race and class, with a message saying why.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
const mutate = vi.fn();
vi.mock("@/hooks/useCharacters", () => ({ useCreateCharacterWithSetup: () => ({ mutate, isPending: false }) }));
vi.mock("./avatar", () => ({
  Avatar: () => null,
  AvatarEditor: () => null,
  getInitialAvatarSeed: (name: string) => `seed-${name}`,
}));

const { CreateCharacterForm } = await import("./create-character-form");

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  mutate.mockClear();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<CreateCharacterForm />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function typeName(value: string): Promise<void> {
  const input = container.querySelector<HTMLInputElement>("#char-name")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function next(): Promise<void> {
  const button = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Next"));
  if (!button) throw new Error("no Next button");
  await act(async () => button.click());
}

const onNameStep = (): boolean => container.querySelector("#char-name") !== null;

describe("CreateCharacterForm name step", () => {
  it.each(["dm", " DM ", "All"])("refuses %j and stays on the name step", async (name) => {
    await typeName(name);
    await next();
    expect(onNameStep()).toBe(true);
    expect(container.textContent).toContain("reserved");
  });

  it("goes on with an ordinary name", async () => {
    await typeName("Dmitri");
    await next();
    expect(onNameStep()).toBe(false);
  });
});

describe("CreateCharacterForm race and class step (H1)", () => {
  async function select(index: number, value: string): Promise<void> {
    const el = container.querySelectorAll<HTMLSelectElement>("select")[index];
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(el, value);
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  async function create(): Promise<void> {
    const button = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Create"));
    if (!button) throw new Error("no Create button");
    await act(async () => button.click());
  }

  beforeEach(async () => {
    await typeName("Hero");
    await next();
  });

  it("does not create without a race and a class, and says why", async () => {
    await create();
    expect(mutate).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Choose a race and a class");

    const race = container.querySelectorAll<HTMLSelectElement>("select")[0].options[1].value;
    await select(0, race);
    await create();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("creates with both, religion optional", async () => {
    const [race, cls] = [0, 1].map((i) => container.querySelectorAll<HTMLSelectElement>("select")[i].options[1].value);
    await select(0, race);
    await select(1, cls);
    await create();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0].raceClass).toEqual({ race, class: cls });
  });
});
