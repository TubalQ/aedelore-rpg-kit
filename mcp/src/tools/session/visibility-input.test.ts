import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../../server/mcp-factory.js";
import { visibleToInput } from "./schemas.js";

// "all" and "dm" are visibility values, never character names. Inside a list
// they were ambiguous (["all"] showed the entry to everyone, ["dm"] only to a
// character called "dm"), so a list takes character names only.

test("visibleToInput takes all, dm, or a list of character names", () => {
  for (const ok of ["all", "dm", ["Mira"], ["Mira", "Arvid"], ["Dmitri"]]) {
    assert.equal(visibleToInput.safeParse(ok).success, true, JSON.stringify(ok));
  }
});

test("visibleToInput refuses all or dm inside a list, in any case", () => {
  for (const bad of [["dm"], ["all"], ["Mira", "DM"], [" All "], []]) {
    assert.equal(visibleToInput.safeParse(bad).success, false, JSON.stringify(bad));
  }
});

test("the AI is told why when it puts dm in a list", async () => {
  // No app is reachable: the call must stop at validation.
  const server = createMcpServer({ apiUrl: "http://127.0.0.1:9", token: "t", userId: "u", isAdmin: false, profile: "full" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(b);
  const r = await client.callTool({ name: "log", arguments: { session_id: 1, kind: "event", text: "x", visible_to: ["dm"] } });
  const text = (r.content as { text: string }[]).map((x) => x.text).join("");
  assert.equal(r.isError, true);
  assert.match(text, /character names only/);
  await client.close();
});
