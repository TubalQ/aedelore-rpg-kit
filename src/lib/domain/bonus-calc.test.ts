import { describe, expect, it } from "vitest";
import { CharacterDataSchema } from "@/lib/schemas/character";
import { computeBonusSources } from "./bonus-calc";

// C6: a piece of DM equipment gives its bonuses to one equipped copy only.

const base = (extra: Record<string, unknown>) =>
  CharacterDataSchema.parse({
    dmEquipment: [{ name: "Flame Blade", type: "weapon", bonuses: [{ stat: "Strength", value: 2 }] }],
    ...extra,
  });

const weapon = (name: string) => ({ name, type: "Sword", ability: "Strength", bonus: "+0", damage: "1d6", range: "1", break: "0" });

describe("DM equipment bonuses (C6)", () => {
  it("counts once for one copy", () => {
    const data = base({ equippedWeapons: [weapon("Flame Blade")] });
    expect(computeBonusSources("Strength", 0, data).equipment).toBe(2);
  });

  it("does not count again for copies the player named after it", () => {
    const data = base({ equippedWeapons: [weapon("Flame Blade"), weapon("Flame Blade"), weapon("Flame Blade (DM)")] });
    expect(computeBonusSources("Strength", 0, data).equipment).toBe(2);
  });

  it("counts twice when the DM handed out two", () => {
    const data = CharacterDataSchema.parse({
      dmEquipment: [
        { name: "Dagger", type: "weapon", bonuses: [{ stat: "Dexterity", value: 1 }] },
        { name: "Dagger", type: "weapon", bonuses: [{ stat: "Dexterity", value: 1 }] },
      ],
      equippedWeapons: [weapon("Dagger"), weapon("Dagger")],
    });
    expect(computeBonusSources("Dexterity", 0, data).equipment).toBe(2);
  });

  it("C5: follows a renamed DM item by its stash id", () => {
    const data = CharacterDataSchema.parse({
      dmEquipment: [{ name: "Ember Blade", type: "weapon", stashId: 12, bonuses: [{ stat: "Strength", value: 2 }] }],
      equippedWeapons: [{ ...weapon("Flame Blade (DM)"), stashId: 12 }],
    });
    expect(computeBonusSources("Strength", 0, data).equipment).toBe(2);
  });
});
