import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../server/mcp-factory.js";

// M2: add_to_session keeps visibleTo (a hidden NPC stays hidden) and refuses
// unknown fields instead of dropping them and answering OK. Through the real
// MCP server against a fake app.

let puts: unknown[];
let app: Server;
let apiUrl: string;
const SESSION = { id: 1, campaignId: 9, sessionNumber: 1, data: { places: [{ name: "Kvarnen", day: 1, time: "noon" }] } };

async function bodyOf(req: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : null;
}

before(async () => {
  app = createServer(async (req, res) => {
    const body = await bodyOf(req);
    res.writeHead(200, { "content-type": "application/json" });
    if (req.method === "PUT") puts.push(body);
    res.end(JSON.stringify(SESSION));
  });
  await new Promise<void>((r) => app.listen(0, "127.0.0.1", r));
  apiUrl = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((r) => app.close(() => r())));
beforeEach(() => {
  puts = [];
});

async function add(kind: string, fields: Record<string, unknown>): Promise<{ isError: boolean; text: string }> {
  const server = createMcpServer({ apiUrl, token: "t", userId: "u", isAdmin: false, profile: "full" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(b);
  const r = await client.callTool({ name: "add_to_session", arguments: { session_id: 1, kind, fields } });
  await client.close();
  return { isError: !!r.isError, text: (r.content as { text: string }[]).map((x) => x.text).join("") };
}

test("an NPC added as dm-only is saved dm-only", async () => {
  const r = await add("npc", { name: "Spionen", day: 1, time: "noon", plannedLocation: "Kvarnen", visibleTo: "dm" });
  assert.equal(r.isError, false, r.text);
  const npcs = (puts[0] as { data: { npcs: Record<string, unknown>[] } }).data.npcs;
  assert.equal(npcs[0].visibleTo, "dm");
});

test("an unknown field is refused by name and nothing is saved", async () => {
  const r = await add("place", { name: "Bron", description: "", day: 1, time: "noon", hidden: true });
  assert.equal(r.isError, true);
  assert.match(r.text, /hidden/);
  assert.equal(puts.length, 0);
});

// M3: a second record with the same name, day and time could never be found again.
test("a duplicate of an existing record is refused and nothing is saved", async () => {
  const r = await add("place", { name: "Kvarnen", description: "", day: 1, time: "noon" });
  assert.equal(r.isError, true);
  assert.match(r.text, /already exists/);
  assert.equal(puts.length, 0);
});

test("the same name on another day is fine", async () => {
  const r = await add("place", { name: "Kvarnen", description: "", day: 2, time: "noon" });
  assert.equal(r.isError, false, r.text);
  assert.equal(puts.length, 1);
});
