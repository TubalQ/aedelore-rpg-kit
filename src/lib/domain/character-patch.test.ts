import { describe, expect, it } from "vitest";
import { CharacterDataSchema } from "@/lib/schemas/character";
import { applyCharacterPatch, baseAfterSave, baseFor, mergeAgainstBase, mergeCharacterPatch, withBase } from "./character-patch";

describe("character patches with one stat at a time", () => {
  it("two quick edits to different stats both reach the save", () => {
    expect(mergeCharacterPatch({ attributes: { Strength: 4 } }, { attributes: { Agility: 2 }, hp: 3 })).toEqual({
      attributes: { Strength: 4, Agility: 2 },
      hp: 3,
    });
  });

  it("the sheet keeps the other stats when one changes", () => {
    const data = CharacterDataSchema.parse({ attributes: { Strength: 5, Agility: 2 }, skills: { Athletics: 4 } });
    const next = applyCharacterPatch(data, { attributes: { Strength: 4 } });
    expect(next.attributes).toEqual({ Strength: 4, Agility: 2 });
    expect(next.skills).toEqual({ Athletics: 4 });
  });

  it("other keys are replaced as before", () => {
    const data = CharacterDataSchema.parse({ background: "old" });
    expect(applyCharacterPatch(data, { background: "new" }).background).toBe("new");
  });
});

describe("mergeAgainstBase (C2)", () => {
  it("writes a value the store has not changed since the sheet's base", () => {
    expect(mergeAgainstBase({ hp: 10, gold: 3 }, { hp: 11 }, { hp: 10 })).toEqual({ patch: { hp: 11 }, conflicts: [] });
  });

  it("applies a number as a change on top of what is stored now: DM damage is kept", () => {
    // Sheet saw 10 and healed to 11; the DM had dealt 5 meanwhile (stored 5).
    expect(mergeAgainstBase({ hp: 5 }, { hp: 11 }, { hp: 10 })).toEqual({ patch: { hp: 6 }, conflicts: [] });
    expect(mergeAgainstBase({ gold: 1 }, { gold: 0 }, { gold: 4 })).toEqual({ patch: { gold: 0 }, conflicts: [] });
  });

  it("does not write a list changed meanwhile, and reports it", () => {
    // The player archived Map from a sheet that had not seen the DM hand out Key.
    const stored = { questItems: [{ name: "Map", stashId: 1 }, { name: "Key", stashId: 2 }], questItemsArchived: [] };
    const base = { questItems: [{ name: "Map", stashId: 1 }], questItemsArchived: [] };
    const patch = { questItems: [], questItemsArchived: [{ name: "Map", stashId: 1 }] };
    // Neither list is written: Key is kept, and Map is not left in both lists.
    expect(mergeAgainstBase(stored, patch, base)).toEqual({ patch: {}, conflicts: ["questItems", "questItemsArchived"] });
  });

  it("writes a list whose stored value is still the base, whatever the key order", () => {
    const stored = { relationships: [{ name: "Bo", relation: "friend" }] };
    const base = { relationships: [{ relation: "friend", name: "Bo" }] };
    expect(mergeAgainstBase(stored, { relationships: [] }, base)).toEqual({ patch: { relationships: [] }, conflicts: [] });
  });

  it("merges attributes and skills stat by stat", () => {
    // Strength: sheet 5 -> 4, an XP purchase made it 6 meanwhile -> 5. Agility unchanged -> written.
    expect(
      mergeAgainstBase({ attributes: { Strength: 6, Agility: 2 } }, { attributes: { Strength: 4, Agility: 3 } }, { attributes: { Strength: 5, Agility: 2 } }),
    ).toEqual({ patch: { attributes: { Strength: 5, Agility: 3 } }, conflicts: [] });
  });

  it("writes keys without a base as before", () => {
    expect(mergeAgainstBase({ hp: 5 }, { hp: 11, notes: "x" }, {})).toEqual({ patch: { hp: 11, notes: "x" }, conflicts: [] });
  });
});

describe("the sheet's bases", () => {
  it("records the value before the first change of a key, and of each stat", () => {
    const before = { hp: 10, attributes: { Strength: 5, Agility: 2 } };
    let base = withBase({}, before, { hp: 11 });
    base = withBase(base, { ...before, hp: 11 }, { hp: 12, attributes: { Strength: 4 } });
    expect(base).toEqual({ hp: 10, attributes: { Strength: 5 } });
    expect(baseFor(base, { hp: 12, attributes: { Strength: 4 } })).toEqual({ hp: 10, attributes: { Strength: 5 } });
    expect(baseFor(base, { gold: 1 })).toEqual({});
  });

  it("after a save: dropped when not changed again, the saved value when changed again", () => {
    const base = { hp: 10, gold: 3 };
    const after = baseAfterSave(base, { hp: 11, gold: 4 }, { hp: 6, gold: 4 }, new Set(["hp"]), []);
    expect(after).toEqual({ hp: 6 });
  });

  it("after a conflict: a key changed again keeps the old base, so that change is rejected too", () => {
    const base = { relationships: [{ name: "Bo" }] };
    expect(baseAfterSave(base, { relationships: [] }, { relationships: [{ name: "Bo" }, { name: "Ida" }] }, new Set(["relationships"]), ["relationships"])).toEqual(base);
    expect(baseAfterSave(base, { relationships: [] }, {}, new Set(), ["relationships"])).toEqual({});
  });
});
