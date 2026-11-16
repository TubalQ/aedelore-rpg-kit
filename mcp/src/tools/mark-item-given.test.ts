import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../server/mcp-factory.js";
import { pickCharacter } from "./session/pick-character.js";

// Marking an item found and given to a character, through the real MCP server
// against a fake app: the character must get the item (handed over, so others
// lose it) BEFORE the session card says who has it, and nothing is written
// when the hand-over cannot happen.

type Call = { method: string; path: string; body: unknown };
let calls: Call[];
let controlStatus: number;
let app: Server;
let apiUrl: string;

const SESSION = {
  id: 1,
  campaignId: 9,
  sessionNumber: 4,
  data: {
    items: [{ name: "Map", description: "Old map", stashId: 7, found: false, givenTo: ["Arvid"], day: null, time: null, notes: "" }],
  },
};
const CHARACTERS = [{ id: 1, name: "Arvid" }, { id: 3, name: "Bo" }];

async function bodyOf(req: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : null;
}

before(async () => {
  app = createServer(async (req, res) => {
    const call = { method: req.method ?? "GET", path: req.url ?? "", body: await bodyOf(req) };
    calls.push(call);
    const json = (status: number, v: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(v));
    };
    if (call.method === "GET" && call.path === "/api/sessions/1") return json(200, SESSION);
    if (call.method === "GET" && call.path === "/api/campaigns/9/characters") return json(200, CHARACTERS);
    if (call.method === "POST" && call.path === "/api/campaigns/9/characters/control") {
      return controlStatus === 200 ? json(200, { id: 3 }) : json(controlStatus, { error: "Karaktären hittades inte" });
    }
    if (call.method === "PUT" && call.path === "/api/sessions/1") return json(200, SESSION);
    json(404, { error: "unexpected" });
  });
  await new Promise<void>((r) => app.listen(0, "127.0.0.1", r));
  apiUrl = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
});

after(() => new Promise<void>((r) => app.close(() => r())));

beforeEach(() => {
  calls = [];
  controlStatus = 200;
});

async function call(name: string, args: Record<string, unknown>): Promise<{ isError: boolean; text: string }> {
  const server = createMcpServer({ apiUrl, token: "t", userId: "u", isAdmin: false, profile: "full" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(b);
  const r = await client.callTool({ name, arguments: args });
  await client.close();
  return { isError: !!r.isError, text: (r.content as { text: string }[]).map((x) => x.text).join("") };
}

const controls = () => calls.filter((c) => c.path.endsWith("/characters/control"));
const puts = () => calls.filter((c) => c.method === "PUT");
const putItem = (): Record<string, unknown> => {
  const body = puts()[0].body as { data: { items: Record<string, unknown>[] } };
  return body.data.items[0];
};

test("an item given to a character is handed to them, then the card says so", async () => {
  const r = await call("mark", { session_id: 1, kind: "item", name: "Map", given_to: " bo " });
  assert.equal(r.isError, false, r.text);
  assert.deepEqual(controls().map((c) => c.body), [
    { action: "giveItem", characterId: 3, move: true, item: { name: "Map", description: "Old map", sessionName: "Session 4", stashId: 7 } },
  ]);
  const order = calls.map((c) => c.method + " " + c.path);
  assert.ok(order.indexOf("POST /api/campaigns/9/characters/control") < order.indexOf("PUT /api/sessions/1"), order.join(" | "));
  assert.deepEqual(putItem().givenTo, ["Bo"]);
  assert.equal(putItem().found, true);
  assert.match(r.text, /Given to Bo/);
});

test("a name no character has is an error that lists the characters, and nothing is written", async () => {
  const r = await call("mark", { session_id: 1, kind: "item", name: "Map", given_to: "Sigrun" });
  assert.equal(r.isError, true);
  assert.match(r.text, /No character in the campaign is called "Sigrun".*"Arvid", "Bo"/);
  assert.equal(controls().length, 0);
  assert.equal(puts().length, 0);
});

test("when the app refuses the hand-over, the card is not changed", async () => {
  controlStatus = 404;
  const r = await call("mark", { session_id: 1, kind: "item", name: "Map", given_to: "Bo" });
  assert.equal(r.isError, true);
  assert.equal(puts().length, 0);
});

test("found without given_to only marks it found and leaves who holds it alone", async () => {
  for (const args of [{}, { given_to: "" }]) {
    calls = [];
    const r = await call("mark", { session_id: 1, kind: "item", name: "Map", ...args });
    assert.equal(r.isError, false, r.text);
    assert.equal(controls().length, 0);
    assert.equal(calls.some((c) => c.path.endsWith("/characters")), false);
    assert.equal(putItem().found, true);
    assert.deepEqual(putItem().givenTo, ["Arvid"]);
  }
});

test("pickCharacter: exact first, then one loose match, otherwise an error", () => {
  const chars = [{ id: 1, name: "Arvid" }, { id: 2, name: "arvid" }, { id: 3, name: "Bo" }];
  assert.deepEqual(pickCharacter(chars, "arvid"), { ok: true, character: { id: 2, name: "arvid" } });
  assert.deepEqual(pickCharacter(chars, " BO"), { ok: true, character: { id: 3, name: "Bo" } });
  assert.match((pickCharacter(chars, "ARVID") as { message: string }).message, /More than one/);
  assert.match((pickCharacter([], "Bo") as { message: string }).message, /Characters: none/);
});
