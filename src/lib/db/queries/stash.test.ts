import { describe, expect, it, vi } from "vitest";

// The DB client is not needed for the pure hydration functions.
vi.mock("@/lib/db/client", () => ({ db: {} }));

import { hydrateCharacterData, hydrateSessionData, type StashMap } from "./stash";
import { SessionDataSchema } from "@/lib/schemas/session";
import { CharacterDataSchema } from "@/lib/schemas/character";
import { computeBonusSources } from "@/lib/domain/bonus-calc";

const stash: StashMap = new Map([
  [1, { id: 1, kind: "quest", data: { name: "Bothvars Flodkarta", description: "Ny beskrivning" } }],
  [2, { id: 2, kind: "equipment", data: { name: "Shadowblade", type: "weapon", damage: "2d6", bonuses: [{ stat: "Stealth", value: 2 }] } }],
]);

describe("stash hydration", () => {
  it("overlays stash content on session placements, keeps placement fields", () => {
    const data = SessionDataSchema.parse({
      items: [{ stashId: 1, name: "Gammalt namn", description: "gammal", found: true, givenTo: "Tor", plannedLocation: "Pråmen" }],
      equipment: [{ stashId: 2, name: "Shadowblade", damage: "1d4", visibleTo: "dm", notes: "under bänken" }],
    });
    const out = hydrateSessionData(data, stash);
    expect(out.items[0]).toMatchObject({ name: "Bothvars Flodkarta", description: "Ny beskrivning", found: true, givenTo: ["Tor"], plannedLocation: "Pråmen" });
    expect(out.equipment[0]).toMatchObject({ damage: "2d6", visibleTo: "dm", notes: "under bänken", stashId: 2 });
  });

  it("leaves unlinked entries and missing stash rows as they are", () => {
    const data = SessionDataSchema.parse({ items: [{ name: "Lös lapp" }, { stashId: 99, name: "Borttagen" }] });
    expect(hydrateSessionData(data, stash).items.map((i) => i.name)).toEqual(["Lös lapp", "Borttagen"]);
  });

  it("gives held equipment the current stash bonuses, even when equipped earlier", () => {
    const data = CharacterDataSchema.parse({
      dmEquipment: [{ stashId: 2, name: "Shadowblade", type: "weapon", bonuses: [{ stat: "Stealth", value: 1 }], hp: 3 }],
      equippedWeapons: [{ name: "Shadowblade", damage: "2d6", bonus: "+0", range: "1", break: 0, bonuses: [{ stat: "Stealth", value: 1 }] }],
    });
    const hydrated = hydrateCharacterData(data, stash);
    expect(hydrated.dmEquipment[0]).toMatchObject({ bonuses: [{ stat: "Stealth", value: 2 }], hp: 3, stashId: 2 });
    expect(computeBonusSources("Stealth", 0, hydrated).equipment).toBe(2);
  });
});
