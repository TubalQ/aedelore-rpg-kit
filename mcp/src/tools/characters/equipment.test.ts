import { test } from "node:test";
import assert from "node:assert/strict";
import { armorBodyPart } from "./equipment.js";

const PARTS = ["head", "shoulders", "chest", "hands", "legs", "feet"];
const cap = { name: "Leather Cap", bodypart: "head" };

// C7: armor goes on its own body part only.
test("armor defaults to its own body part", () => {
  assert.deepEqual(armorBodyPart(cap, undefined, PARTS), { part: "head" });
  assert.deepEqual(armorBodyPart(cap, "Head", PARTS), { part: "head" });
});

test("armor on another body part is refused", () => {
  const out = armorBodyPart(cap, "chest", PARTS);
  assert.ok("error" in out);
  assert.match(out.error, /worn on head/);
});

test("an unknown body part is reported as such", () => {
  assert.deepEqual(armorBodyPart(cap, "tail", PARTS), { error: "unknown part", part: "tail" });
});
