import { describe, expect, it } from "vitest";
import { RACES } from "@/lib/domain/races";

// Y6: a name that is also an Object.prototype member is not a race.
describe("live records", () => {
  it("only answer with the system's own entries", () => {
    expect(RACES["constructor"]).toBeUndefined();
    expect(RACES["toString"]).toBeUndefined();
    expect("constructor" in RACES).toBe(false);
  });
});
