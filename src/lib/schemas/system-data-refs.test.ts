import { describe, expect, it } from "vitest";
import { crossRefErrors, type CrossRefs } from "./system-data";

// Y5: removing something another kind still uses is refused.

const refs: CrossRefs = {
  attributeNames: ["Strength"],
  skillNames: [],
  weaponNames: ["Longsword", "Club"],
  classNames: ["Warrior", "Mage"],
  shieldNames: ["Buckler"],
  armorNames: ["Leather Cap"],
  bodyParts: ["head"],
  usedBy: {
    weapons: [{ name: "Longsword", by: 'race "Human"' }],
    armor: [{ name: "Leather Cap", by: 'class "Warrior"' }],
    shields: [{ name: "Buckler", by: 'class "Warrior"' }],
    bodyParts: [{ name: "head", by: 'class "Warrior"' }],
    spellClasses: ["Mage"],
  },
};

describe("cross references both ways (Y5)", () => {
  it("refuses a weapons list without a starting weapon", () => {
    const { errors } = crossRefErrors("weapons", { weapons: [{ name: "Club", ability: "Strength" }] }, refs);
    expect(errors.join()).toContain('weapon "Longsword" is still the starting weapon of race "Human"');
  });

  it("refuses armor data without used armor, shield or body part", () => {
    const { errors } = crossRefErrors("armor", { armor: [], shields: [], bodyParts: [] }, refs);
    expect(errors).toHaveLength(3);
  });

  it("warns when a class with spells is removed", () => {
    const { warnings } = crossRefErrors("classes", { names: ["Warrior"], data: { Warrior: {} } }, refs);
    expect(warnings.join()).toContain('"Mage"');
  });

  it("lets a save that keeps everything through", () => {
    const { errors } = crossRefErrors("weapons", { weapons: [{ name: "Longsword", ability: "Strength" }] }, refs);
    expect(errors).toEqual([]);
  });
});
