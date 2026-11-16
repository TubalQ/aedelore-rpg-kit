import { describe, expect, it } from "vitest";
import { holdsEntry, keepHeldQuestItems, matchesHeld, takeBackPatch } from "./holdings";

describe("matchesHeld", () => {
  it("matches on stash id, also after the entry was renamed in the stash", () => {
    expect(matchesHeld({ name: "Old name", stashId: 7 }, { stashId: 7, name: "New name" })).toBe(true);
  });

  it("does not match another stash entry with the same name", () => {
    expect(matchesHeld({ name: "Sword", stashId: 8 }, { stashId: 7, name: "Sword" })).toBe(false);
  });

  it("matches a row from before stash ids on its name", () => {
    expect(matchesHeld({ name: "Sword" }, { stashId: 7, name: "Sword" })).toBe(true);
    expect(matchesHeld({ name: "Sword" }, { name: "Sword" })).toBe(true);
    expect(matchesHeld({ name: "Shield" }, { name: "Sword" })).toBe(false);
  });
});

describe("takeBackPatch for quest items", () => {
  const data = {
    questItems: [{ name: "Map", stashId: 1 }, { name: "Key", stashId: 2 }],
    questItemsArchived: [{ name: "Map", stashId: 1 }, { name: "Letter", stashId: 3 }],
  };

  it("removes the entry from the active and the archived list", () => {
    expect(takeBackPatch(data, "quest", { stashId: 1, name: "Map" })).toEqual({
      questItems: [{ name: "Key", stashId: 2 }],
      questItemsArchived: [{ name: "Letter", stashId: 3 }],
    });
  });

  it("only patches the lists that change", () => {
    expect(takeBackPatch(data, "quest", { stashId: 3, name: "Letter" })).toEqual({
      questItemsArchived: [{ name: "Map", stashId: 1 }],
    });
  });

  it("is null when the character does not hold it", () => {
    expect(takeBackPatch(data, "quest", { stashId: 9, name: "Ring" })).toBeNull();
    expect(holdsEntry(data, "quest", { stashId: 9, name: "Ring" })).toBe(false);
    expect(holdsEntry(data, "quest", { stashId: 3, name: "Letter" })).toBe(true);
  });

  it("copes with missing or broken lists", () => {
    expect(takeBackPatch({ questItems: "nope" }, "quest", { name: "Map" })).toBeNull();
    expect(takeBackPatch({}, "quest", { name: "Map" })).toBeNull();
  });
});

describe("takeBackPatch for equipment", () => {
  const base = {
    dmEquipment: [{ name: "Frost Blade", stashId: 5 }, { name: "Plate", stashId: 6 }],
    equippedWeapons: [{ name: "Frost Blade (DM)" }, { name: "Dagger" }],
    equippedArmor: [{ name: "Plate (DM)", bodypart: "chest" }],
    equippedShield: null,
  };

  it("removes the equipment and the equipped copy, so its bonuses stop", () => {
    expect(takeBackPatch(base, "equipment", { stashId: 5, name: "Frost Blade" })).toEqual({
      dmEquipment: [{ name: "Plate", stashId: 6 }],
      equippedWeapons: [{ name: "Dagger" }],
    });
  });

  it("finds the equipped copy under the name the character's row had, after a rename in the stash", () => {
    expect(takeBackPatch(base, "equipment", { stashId: 6, name: "Mithril Plate" })).toEqual({
      dmEquipment: [{ name: "Frost Blade", stashId: 5 }],
      equippedArmor: [],
    });
  });

  it("empties the shield slot when the shield is taken back", () => {
    const data = { dmEquipment: [{ name: "Aegis", stashId: 9 }], equippedShield: { name: "Aegis (DM)" } };
    expect(takeBackPatch(data, "equipment", { stashId: 9, name: "Aegis" })).toEqual({
      dmEquipment: [],
      equippedShield: null,
    });
  });

  it("leaves the player's own gear with a similar name alone", () => {
    const data = { dmEquipment: [{ name: "Aegis", stashId: 9 }], equippedShield: { name: "Aegis" } };
    expect(takeBackPatch(data, "equipment", { stashId: 9, name: "Aegis" })).toEqual({ dmEquipment: [] });
  });

  it("is null when the character does not hold it, even if a copy is equipped", () => {
    expect(takeBackPatch({ equippedWeapons: [{ name: "Frost Blade (DM)" }] }, "equipment", { stashId: 5, name: "Frost Blade" })).toBeNull();
  });
});

describe("keepHeldQuestItems (a player's own save)", () => {
  const current = {
    questItems: [{ name: "Map", description: "", stashId: 1 }],
    questItemsArchived: [{ name: "Key", description: "", stashId: 2 }],
  };

  it("lets the player archive and restore what they hold", () => {
    const patch = {
      questItems: [{ name: "Key", description: "", stashId: 2 }],
      questItemsArchived: [{ name: "Map", description: "", stashId: 1 }],
    };
    expect(keepHeldQuestItems(current, patch)).toEqual({ patch, dropped: 0 });
  });

  it("drops a stash id the character does not hold, so the DM's prepared item never shows", () => {
    const out = keepHeldQuestItems(current, { questItems: [{ name: "Map", description: "", stashId: 1 }, { name: "x", description: "", stashId: 9 }] });
    expect(out.patch.questItems).toEqual([{ name: "Map", description: "", stashId: 1 }]);
    expect(out.dropped).toBe(1);
  });

  it("does not let a held name carry an unheld stash id in", () => {
    const legacy = { questItems: [{ name: "Letter", description: "" }] };
    const out = keepHeldQuestItems(legacy, { questItems: [{ name: "Letter", description: "", stashId: 9 }] });
    expect(out.patch.questItems).toEqual([]);
  });

  it("drops items the player made up, and items the DM has taken back", () => {
    const out = keepHeldQuestItems({ questItems: [] }, { questItems: [{ name: "Gold", description: "" }, { name: "Map", description: "", stashId: 1 }] });
    expect(out.patch.questItems).toEqual([]);
    expect(out.dropped).toBe(2);
  });

  it("leaves the rest of the save alone", () => {
    expect(keepHeldQuestItems(current, { hp: 3 })).toEqual({ patch: { hp: 3 }, dropped: 0 });
  });
});
