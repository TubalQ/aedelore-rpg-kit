// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useAutosave, type Autosave } from "./useAutosave";
import { useToastStore } from "@/stores/toast-store";

// F2: leaving the page while the last save fails must not lose the change
// without a word. The save is retried after the unmount, and if it never
// lands an error toast says so.

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type Patch = Record<string, unknown>;

function Editor({ save, onReady }: { save: (p: Patch) => Promise<unknown>; onReady: (a: Autosave<Patch>) => void }) {
  const autosave = useAutosave<Patch>({
    save,
    merge: (a, b) => ({ ...a, ...b }),
    keysOf: (p) => Object.keys(p),
    lostMessage: "lost",
  });
  useEffect(() => {
    onReady(autosave);
  });
  return null;
}

describe("useAutosave after leaving the page (F2)", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    root = createRoot(container);
    useToastStore.setState({ toasts: [] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function mountAndQueue(save: (p: Patch) => Promise<unknown>) {
    let autosave: Autosave<Patch> | null = null;
    await act(async () => root.render(<Editor save={save} onReady={(a) => (autosave = a)} />));
    act(() => autosave!.schedule({ name: "Kvarnen" }));
    await act(async () => root.unmount());
  }

  it("retries a failed save after the unmount and stays quiet when it lands", async () => {
    let calls = 0;
    const save = vi.fn(async (_p: Patch) => {
      calls += 1;
      if (calls < 3) throw new Error("502");
    });
    await mountAndQueue(save);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(save).toHaveBeenCalledTimes(3);
    expect(save.mock.calls[2][0]).toEqual({ name: "Kvarnen" });
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("shows an error toast when the change never lands", async () => {
    const save = vi.fn(async (_p: Patch) => {
      throw new Error("offline");
    });
    await mountAndQueue(save);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000);
    });
    expect(save).toHaveBeenCalledTimes(5);
    expect(useToastStore.getState().toasts.map((t) => [t.message, t.variant])).toEqual([["lost", "error"]]);
  });

  it("retries a failed save by itself while the page is open (F3)", async () => {
    let calls = 0;
    const save = vi.fn(async (_p: Patch) => {
      calls += 1;
      if (calls === 1) throw new Error("502");
    });
    let autosave: Autosave<Patch> | null = null;
    await act(async () => root.render(<Editor save={save} onReady={(a) => (autosave = a)} />));
    act(() => autosave!.schedule({ name: "Kvarnen" }));
    // The debounced save fails; the commit of "error" schedules the retry.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(autosave!.status).toBe("error");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100);
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(autosave!.status).toBe("saved");
    await act(async () => root.unmount());
  });
});

describe("useAutosave flush (F11)", () => {
  it("does not answer saved while the save another waiting flush started is running", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const releases: (() => void)[] = [];
    const save = vi.fn(() => new Promise<void>((resolve) => releases.push(resolve)));
    let autosave: Autosave<Patch> | null = null;
    await act(async () => root.render(<Editor save={save} onReady={(a) => (autosave = a)} />));

    // X in flight, a newer change queued, then two flushes both waiting on X.
    act(() => autosave!.schedule({ a: 1 }, true));
    act(() => autosave!.schedule({ c: 1 }));
    let aDone: boolean | null = null;
    let bDone: boolean | null = null;
    const a = autosave!.flush().then((ok) => (aDone = ok));
    const b = autosave!.flush().then((ok) => (bDone = ok));
    // X lands: the first waiter starts Y with the queued change.
    await act(async () => {
      releases[0]();
      for (let i = 0; i < 5; i++) await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(aDone).toBeNull();
    expect(bDone).toBeNull();
    await act(async () => {
      releases[1]();
      await Promise.all([a, b]);
    });
    expect([aDone, bDone]).toEqual([true, true]);
    await act(async () => root.unmount());
  });
});
