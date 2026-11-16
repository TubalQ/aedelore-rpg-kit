import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeEnemies } from "./session-state.js";

// M4: replacing the enemy list keeps maxHp and notes of the enemies that stay.
test("an existing enemy keeps its maxHp and notes when the list is replaced", () => {
  const existing = [{ name: "Goblin", hp: 3, maxHp: 7, notes: "flees at 2 hp", disposition: "enemy" }];
  const [g] = mergeEnemies(existing, [{ name: "Goblin", hp: 2 }]);
  assert.equal(g.hp, 2);
  assert.equal(g.maxHp, 7);
  assert.equal(g.notes, "flees at 2 hp");
});

test("each existing enemy is matched once, and a new one starts at full hp", () => {
  const existing = [{ name: "Goblin", hp: 1, maxHp: 7, notes: "a" }];
  const out = mergeEnemies(existing, [{ name: "Goblin", hp: 1 }, { name: "Goblin", hp: 7 }, { name: "Wolf", hp: 9 }]);
  assert.deepEqual(out.map((e) => [e.maxHp, e.notes]), [[7, "a"], [7, ""], [9, ""]]);
});

test("given maxHp and notes win", () => {
  const [g] = mergeEnemies([{ name: "Goblin", hp: 3, maxHp: 7, notes: "a" }], [{ name: "Goblin", hp: 3, maxHp: 10, notes: "b" }]);
  assert.deepEqual([g.maxHp, g.notes], [10, "b"]);
});

// #71: an enemy's status survives a replaced enemy list unless it is given.
test("status is kept when left out and defaults to fighting", () => {
  const out = mergeEnemies([{ name: "Goblin", hp: 3, maxHp: 7, status: "fled" }], [{ name: "Goblin", hp: 3 }, { name: "Orc", hp: 9 }]);
  assert.deepEqual(out.map((e) => e.status), ["fled", "fighting"]);
  const [g] = mergeEnemies([{ name: "Goblin", hp: 3, status: "fled" }], [{ name: "Goblin", hp: 3, status: "captured" }]);
  assert.equal(g.status, "captured");
});
