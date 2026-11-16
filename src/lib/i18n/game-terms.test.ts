import { describe, expect, it } from "vitest";
import { tBonus, tSkill } from "./game-terms";

describe("Swedish game terms (#83)", () => {
  it("has natural Swedish names for the skills that were left in English", () => {
    expect(["Insight", "Medicine", "Perception", "Survival"].map((s) => tSkill(s, "sv"))).toEqual([
      "Människokännedom",
      "Läkekonst",
      "Uppmärksamhet",
      "Vildmarksvana",
    ]);
  });

  it("translates the stat in a bonus line and keeps the rest", () => {
    expect(tBonus("+1 Strength", "sv")).toBe("+1 Styrka");
    expect(tBonus("-2 Stealth", "sv")).toBe("-2 Smyg");
    expect(tBonus("+1 Insight", "en")).toBe("+1 Insight");
    expect(tBonus("Darkvision", "sv")).toBe("Darkvision");
  });
});
