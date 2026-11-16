import { describe, expect, it } from "vitest";
import { creationStatValue } from "./attributes";

describe("creationStatValue (building a character)", () => {
  it("raises up to the cap and no further", () => {
    expect(creationStatValue(2, 3, 3)).toBe(3);
    expect(creationStatValue(3, 4, 3)).toBeNull();
  });

  it("lowers one step from where the stat is, also above the cap (C1: '-' on 5 gave 3)", () => {
    expect(creationStatValue(5, 4, 3)).toBe(4);
    expect(creationStatValue(1, 0, 3)).toBe(0);
    expect(creationStatValue(0, -1, 3)).toBe(0);
  });
});
