import { describe, expect, it } from "vitest";
import { SessionDataSchema, newItem, newNpc } from "@/lib/schemas/session";
import { reconcileSessionData, reconcileSessionMeta, sessionPatchKeys } from "./reconcile";

const data = (init: Record<string, unknown>) => SessionDataSchema.parse(init);
const meta = { title: "Natten", date: "", location: "", gameLocation: "" };

describe("sessionPatchKeys", () => {
  it("names each data key separately and meta fields by name", () => {
    expect(sessionPatchKeys({ data: { npcs: [], eventLog: [] }, title: "x" })).toEqual(["data.npcs", "data.eventLog", "title"]);
  });
});

describe("reconcileSessionData", () => {
  it("takes an npc the MCP added while the editor had nothing unsaved", () => {
    const local = data({ npcs: [newNpc({ name: "Arvid" })] });
    const server = data({ npcs: [newNpc({ name: "Arvid" }), newNpc({ name: "Sigrun" })] });
    const out = reconcileSessionData(local, server, new Set());
    expect(out.npcs.map((n) => n.name)).toEqual(["Arvid", "Sigrun"]);
  });

  it("keeps a key with unsaved local edits and still takes the other keys", () => {
    const local = data({ npcs: [newNpc({ name: "Arvid (typing)" })], eventLog: [] });
    const server = data({ npcs: [newNpc({ name: "Arvid" })], eventLog: [{ text: "Logged by the MCP" }] });
    const out = reconcileSessionData(local, server, new Set(["data.npcs"]));
    expect(out.npcs[0].name).toBe("Arvid (typing)");
    expect(out.eventLog.map((e) => e.text)).toEqual(["Logged by the MCP"]);
  });

  it("takes stash content edited elsewhere on a clean key", () => {
    const local = data({ items: [newItem({ stashId: 4, name: "Brev", description: "old" })] });
    const server = data({ items: [newItem({ stashId: 4, name: "Brev", description: "new" })] });
    expect(reconcileSessionData(local, server, new Set()).items[0].description).toBe("new");
  });

  it("returns the local object itself when nothing differs", () => {
    const local = data({ npcs: [newNpc({ name: "Arvid" })] });
    expect(reconcileSessionData(local, data({ npcs: [newNpc({ name: "Arvid" })] }), new Set())).toBe(local);
  });
});

describe("reconcileSessionMeta", () => {
  it("takes a changed title unless the title is being edited", () => {
    const server = { ...meta, title: "Gryningen" };
    expect(reconcileSessionMeta(meta, server, new Set()).title).toBe("Gryningen");
    expect(reconcileSessionMeta(meta, server, new Set(["title"])).title).toBe("Natten");
  });

  it("returns the local object itself when nothing differs", () => {
    expect(reconcileSessionMeta(meta, { ...meta }, new Set())).toBe(meta);
  });
});
