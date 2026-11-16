import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer, type ServerProfile } from "../server/mcp-factory.js";

// No app is reachable here: every call below must stop at validation, which
// proves each branch maps onto an operation that exists.
async function connect(profile: ServerProfile): Promise<Client> {
  const server = createMcpServer({ apiUrl: "http://127.0.0.1:9", token: "t", userId: "u", isAdmin: false, profile });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(b);
  return client;
}

test("profiles expose 33 and 17 tools", async () => {
  const counts = await Promise.all((["full", "play"] as const).map(async (p) => (await (await connect(p)).listTools()).tools.length));
  assert.deepEqual(counts, [33, 17]);
});

test("every broad-tool branch reaches an existing operation", async () => {
  const c = await connect("full");
  const calls: Array<[string, Record<string, unknown>]> = [
    ["mark", { session_id: 1, kind: "place", name: "" }],
    ["mark", { session_id: 1, kind: "npc", name: "" }],
    ["mark", { session_id: 1, kind: "item", name: "" }],
    ["mark", { session_id: 1, kind: "read_aloud", name: "" }],
    ["encounter", { session_id: 1, encounter_name: "x", action: "damage" }],
    ["encounter", { session_id: 1, encounter_name: "x", action: "set_hp" }],
    ["give", { campaign_id: 1, character_id: 1, what: "xp" }],
    ["give", { campaign_id: 1, character_id: 1, what: "stash_item" }],
    ["stash", { campaign_id: 1, action: "remove" }],
    ["stash", { campaign_id: 1, action: "add_equipment", name: "x" }],
    ["add_to_session", { session_id: 1, kind: "place", fields: {} }],
    ["add_to_session", { session_id: 1, kind: "npc", fields: {} }],
    ["add_to_session", { session_id: 1, kind: "encounter", fields: {} }],
    ["add_to_session", { session_id: 1, kind: "item", fields: {} }],
    ["add_to_session", { session_id: 1, kind: "read_aloud", fields: {} }],
    ["add_to_session", { session_id: 1, kind: "equipment", fields: {} }],
    ["edit_record", { session_id: 1, kind: "place", name: "x", fields: "no" }],
    ["trash", { action: "restore" }],
    ["build_character", { character_id: 1, race: "x" }],
    ["equip", { character_id: 1, weapon_name: "x" }],
    ["update_character", { character_id: 1, armor_hp: 1 }],
  ];
  for (const [name, args] of calls) {
    const r = await c.callTool({ name, arguments: args });
    const text = (r.content as { text: string }[]).map((x) => x.text).join("");
    assert.ok(r.isError, `${name} ${JSON.stringify(args)} should fail validation`);
    assert.doesNotMatch(text, /Internal: operation/, `${name}: ${text}`);
    assert.match(text, /Invalid arguments|Input validation error|Nothing to do/, `${name}: ${text}`);
  }
});

// M5: a pass-through tool counts each call once against its rate limit
// (going through execute twice used to halve the limit to 30 a minute).
test("a pass-through tool is rate limited per call, not per call twice", async () => {
  const c = await connect("full");
  const texts: string[] = [];
  for (let i = 0; i < 45; i++) {
    const r = await c.callTool({ name: "get_session", arguments: { session_id: 1 } });
    texts.push((r.content as { text: string }[]).map((x) => x.text).join(""));
  }
  assert.equal(texts.filter((t) => /Rate limit/.test(t)).length, 0);
});

// #75: /mcp/play pointed to tools it does not have (import_content, edit_record,
// prep prompts). Every tool name in a profile's tool descriptions, server
// instructions and prompts must be a tool that profile offers.
test("a profile's texts only name tools that profile offers", async () => {
  const allNames = (await (await connect("full")).listTools()).tools.map((t) => t.name);
  for (const profile of ["full", "play"] as const) {
    const c = await connect(profile);
    const tools = (await c.listTools()).tools;
    const offered = new Set(tools.map((t) => t.name));
    const texts: Array<[string, string]> = tools.map((t) => [`tool ${t.name}`, t.description ?? ""]);
    texts.push(["instructions", c.getInstructions() ?? ""]);
    for (const p of (await c.listPrompts()).prompts) {
      const args = Object.fromEntries((p.arguments ?? []).map((a) => [a.name, "1"]));
      const r = await c.getPrompt({ name: p.name, arguments: args });
      texts.push([`prompt ${p.name}`, r.messages.map((m) => (m.content as { text: string }).text).join(" ")]);
    }
    for (const [where, text] of texts) {
      const missing = allNames.filter((n) => !offered.has(n) && new RegExp(`\\b${n}\\b`).test(text));
      assert.deepEqual(missing, [], `${profile} ${where} names tools it lacks`);
    }
  }
});

test("play offers only the live-play prompts", async () => {
  const names = (await (await connect("play")).listPrompts()).prompts.map((p) => p.name).sort();
  assert.deepEqual(names, ["player_play_session", "run_session"]);
});

// #75: role tags were set on 78 operations but never reached the client.
test("a pass-through tool shows its operation's role tag", async () => {
  const tools = (await (await connect("full")).listTools()).tools;
  const desc = (name: string): string => tools.find((t) => t.name === name)?.description ?? "";
  assert.match(desc("create_session"), /^\[DM only\] /);
  assert.match(desc("join_campaign"), /^\[Player\] /);
  assert.doesNotMatch(desc("get_campaign_state"), /^\[/);
});
