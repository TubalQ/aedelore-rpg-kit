import { describe, expect, it } from "vitest";
import { contrastRatio, withOnAccent } from "./themes";

// Y17: text on purple buttons is chosen per palette, so it reaches 4.5:1
// where either white or near-black can.
describe("withOnAccent", () => {
  it("picks the text colour that reads best on each palette's purple", () => {
    const out = withOnAccent({
      necro: { colors: { "accent-purple": "#50a838" } },
      vellum: { colors: { "accent-purple": "#6a4bb0" } },
      bare: { colors: { "bg-base": "#000000" } },
    });
    expect(out.necro.colors["on-accent-purple"]).toBe("#0b0a10");
    expect(out.vellum.colors["on-accent-purple"]).toBe("#ffffff");
    expect(out.bare.colors["on-accent-purple"]).toBeUndefined();
    for (const p of [out.necro, out.vellum]) {
      expect(contrastRatio(p.colors["accent-purple"], p.colors["on-accent-purple"])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps a colour a palette sets itself", () => {
    const out = withOnAccent({ x: { colors: { "accent-purple": "#50a838", "on-accent-purple": "#ffffff" } } });
    expect(out.x.colors["on-accent-purple"]).toBe("#ffffff");
  });

  it("measures contrast like WCAG", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777", "#777777")).toBeCloseTo(1, 5);
  });
});
