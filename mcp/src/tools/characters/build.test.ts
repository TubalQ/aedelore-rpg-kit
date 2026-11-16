import { test } from "node:test";
import assert from "node:assert/strict";
import { abilitySlots } from "./build.js";

// C8: the slots come from spellSlots, like in the app.
test("ability slots follow the class's spellSlots", () => {
  assert.equal(abilitySlots({ spellSlots: 12, startingEquipment: {} }), 12);
  assert.equal(abilitySlots({ spellSlots: 3, startingEquipment: { abilities: 3 } }), 3);
});

test("a class without a usable spellSlots gets the default 3", () => {
  assert.equal(abilitySlots(undefined), 3);
  assert.equal(abilitySlots({ spellSlots: "12" }), 3);
});
