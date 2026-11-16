import { describe, expect, it } from "vitest";
import { ATTRIBUTE_NAMES, parseBonuses } from "./attributes";

// Y11: negative bonuses from the system editor apply too.
describe("parseBonuses", () => {
  const attr = ATTRIBUTE_NAMES[0];
  it("reads plus and minus bonuses", () => {
    expect(parseBonuses([`+2 ${attr}`, `-1 ${attr}`]).attributes[attr]).toBe(1);
    expect(parseBonuses([`${String.fromCharCode(0x2212)}3 ${attr}`]).attributes[attr]).toBe(-3);
  });

  it("ignores lines that are not bonuses", () => {
    expect(parseBonuses(["Starting Gold: 7", "HP Bonus: +0"])).toEqual({ attributes: {}, skills: {} });
  });
});
