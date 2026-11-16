import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake db whose select() returns whatever `rows` holds when it is awaited.
let rows: Array<{ kind: string; data: unknown }> = [];
let reads = 0;
vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => {
          reads += 1;
          return Promise.resolve(rows.map((r) => ({ ...r })));
        },
      }),
    }),
  },
}));

type SystemDataModule = typeof import("./system-data");

/** A fresh copy of the module, as Next bundles one per server layer. */
async function freshInstance(): Promise<SystemDataModule> {
  vi.resetModules();
  return import("./system-data");
}

describe("system data cache across module instances (#83)", () => {
  beforeEach(() => {
    delete (globalThis as { __aedeloreSystemData?: unknown }).__aedeloreSystemData;
    rows = [{ kind: "theme", data: { accentColor: "#c9a84c" } }];
    reads = 0;
  });

  it("a save in one instance (admin API) is seen by another (page render) on the next read", async () => {
    const pages = await freshInstance();
    const api = await freshInstance();
    expect(pages).not.toBe(api);

    expect((await pages.getStoredKinds()).get("theme")).toEqual({ accentColor: "#c9a84c" });

    rows = [{ kind: "theme", data: { accentColor: "#4a90d9" } }];
    api.invalidateSystemDataCache();

    expect((await pages.getStoredKinds()).get("theme")).toEqual({ accentColor: "#4a90d9" });
  });

  it("still serves repeated reads from the cache", async () => {
    const pages = await freshInstance();
    await pages.getStoredKinds();
    await pages.getStoredKinds();
    expect(reads).toBe(1);
  });
});
