import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { ApiClient } from "../api/client.js";
import { text, withCharacter } from "./helpers.js";

// C2: the MCP's character writes carry the base (each changed key as read),
// so the app merges them with what the sheet or the DM wrote meanwhile; a
// list changed meanwhile comes back as a conflict, which the AI must hear.

let app: Server;
let client: ApiClient;
let puts: Record<string, unknown>[];
let reply: Record<string, unknown>;

async function bodyOf(req: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : null;
}

before(async () => {
  app = createServer(async (req, res) => {
    const body = await bodyOf(req);
    res.writeHead(200, { "content-type": "application/json" });
    if (req.method === "GET") {
      res.end(JSON.stringify({ id: 1, data: { gold: 4, food: 2, relationships: [{ name: "Bo" }] } }));
      return;
    }
    puts.push(body as Record<string, unknown>);
    res.end(JSON.stringify(reply));
  });
  await new Promise<void>((r) => app.listen(0, "127.0.0.1", r));
  client = new ApiClient(`http://127.0.0.1:${(app.address() as AddressInfo).port}`);
});

after(() => new Promise<void>((r) => app.close(() => r())));

beforeEach(() => {
  puts = [];
  reply = { id: 1, data: {} };
});

test("sends the changed keys with their values as read", async () => {
  const r = await withCharacter(client, "t", 1, (data) => {
    data.gold = 9;
    data.relationships = [{ name: "Bo" }, { name: "Ida" }];
    return text("ok");
  });
  assert.equal(r.isError, undefined);
  assert.deepEqual(puts, [
    { data: { gold: 9, relationships: [{ name: "Bo" }, { name: "Ida" }] }, base: { gold: 4, relationships: [{ name: "Bo" }] } },
  ]);
});

test("tells the AI what was not saved when the app reports a conflict", async () => {
  reply = { id: 1, data: {}, conflicts: ["relationships"] };
  const r = await withCharacter(client, "t", 1, (data) => {
    data.relationships = [];
    return text("ok");
  });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /Not saved: relationships changed elsewhere/);
});
