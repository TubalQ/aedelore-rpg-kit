import { describe, it, expect } from "vitest";
import { BODY_PARTS, ARMOR, getArmorBySlot, aggregateDisadvantages } from "./armor";

describe("feet-rustning är fullt inkopplad", () => {
  it("feet finns som slot i BODY_PARTS (sist)", () => {
    expect(BODY_PARTS).toContain("feet");
    expect(BODY_PARTS[BODY_PARTS.length - 1]).toBe("feet");
  });

  it("getArmorBySlot('feet') ger de fem skodonen", () => {
    const feet = getArmorBySlot("feet");
    expect(feet.map((a) => a.name)).toEqual([
      "Cloth Shoes",
      "Leather Boots",
      "Studded Boots",
      "Chain Sabatons",
      "Plate Sabatons",
    ]);
    // alla feet-poster har giltig bodypart/type/ac
    for (const a of feet) {
      expect(a.bodypart).toBe("feet");
      expect(a.ac).toBeGreaterThanOrEqual(0);
    }
  });

  it("tunga skodons Athletics-straff aggregeras (parsbart format)", () => {
    const plate = ARMOR.find((a) => a.name === "Plate Sabatons")!;
    expect(plate.disadvantage).toBe("-2 Ath");
    const pen = aggregateDisadvantages([{ hp: plate.hp, disadvantage: plate.disadvantage }], null);
    expect(pen["Ath"]).toBe(-2);
  });
});
