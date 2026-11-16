import { describe, expect, it } from "vitest";
import { computeStartingStats, WORTHINESS_MAX } from "./starting-data";
import { RACE_NAMES } from "./races";
import { CLASS_NAMES } from "./classes";
import { aedeloreActive } from "@/systems/aedelore-active";

// C9: the religion's worthiness counts, and the start stays on the -10..10 scale.

describe("starting worthiness (C9)", () => {
  it("never starts above the scale", () => {
    for (const r of RACE_NAMES) for (const c of CLASS_NAMES) {
      expect(computeStartingStats(r, c).worthiness ?? 0).toBeLessThanOrEqual(WORTHINESS_MAX);
    }
  });

  it.skipIf(!aedeloreActive)("takes the religion's -5 Worthiness into account", () => {
    const [r, c] = [RACE_NAMES[0], CLASS_NAMES[0]];
    const without = computeStartingStats(r, c).worthiness ?? 0;
    const withVeil = computeStartingStats(r, c, "The Abyssal Veil").worthiness ?? 0;
    expect(withVeil).toBeLessThan(without);
  });
});

describe.skipIf(!aedeloreActive)("starting weapons (C10)", () => {
  it("gives the race's weapon as well as the class's, once each", async () => {
    const { computeStartingEquipment } = await import("./starting-data");
    const names = (computeStartingEquipment("Warrior", "Dwarf").equippedWeapons ?? []).map((w) => w.name);
    expect(names).toContain("Warhammer");
    expect(new Set(names).size).toBe(names.length);
  });
});
