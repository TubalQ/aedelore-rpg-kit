import { describe, expect, it } from "vitest";
import { SessionDataSchema, newEncounter, newItem, newNpc, newPlace, newReadAloud } from "@/lib/schemas/session";
import { buildScenePlan, scenesOnDay } from "./scenes";

// Shapes taken from a real session: one place (the barge deck) hosts scenes on
// several nights, items link either to a place or to an encounter by name.
const data = SessionDataSchema.parse({
  encounters: [
    newEncounter({ name: "Malcathir Talar", location: "Pråmen — nattdäck", day: "5", time: "night" }),
    newEncounter({ name: "Priset för Passagen", location: "Pråmen — nattdäck", day: "11", time: "night" }),
    newEncounter({ name: "Passet", location: "Bergspasset", day: "2", time: "afternoon" }),
    newEncounter({ name: "Tidigt", location: "Bergspasset", day: "2", time: "morning" }),
  ],
  places: [newPlace({ name: "Pråmen — nattdäck" }), newPlace({ name: "Tornet", day: "3" })],
  npcs: [
    newNpc({ name: "Malcathirs Röst", plannedLocation: "Pråmen — nattdäck", day: "5", time: "night" }),
    newNpc({ name: "Vandraren", plannedLocation: "Ingenstans" }),
  ],
  items: [newItem({ name: "Bothvars Flodkarta", plannedLocation: "Priset för Passagen", day: "17" })],
  readAloud: [
    newReadAloud({ title: "Han är inte arg", linkedType: "encounter", linkedTo: "Malcathir Talar" }),
    newReadAloud({ title: "Rösten", linkedType: "npc", linkedTo: "Malcathirs Röst" }),
    newReadAloud({ title: "Fritt", linkedType: null, linkedTo: "" }),
  ],
});

describe("buildScenePlan", () => {
  const plan = buildScenePlan(data);

  it("places a place-linked NPC in the scene on the same day", () => {
    expect(plan.scenes[0].npcs).toEqual([0]);
    expect(plan.scenes[1].npcs).toEqual([]);
  });

  it("links an item to an encounter by name, whatever its day", () => {
    expect(plan.scenes[1].items).toEqual([0]);
  });

  it("follows encounter and npc links for read-alouds", () => {
    expect(plan.scenes[0].readAloud).toEqual([0, 1]);
    expect(plan.loose.readAloud).toEqual([2]);
  });

  it("keeps unmatched content and scene-less places loose", () => {
    expect(plan.loose.npcs).toEqual([1]);
    expect(plan.loose.places).toEqual([1]);
  });

  it("lists days ascending with no-day last, and sorts a day's scenes by time", () => {
    expect(plan.days).toEqual([2, 3, 5, 11, null]);
    expect(scenesOnDay(plan, data, 2).map((s) => s.index)).toEqual([3, 2]);
  });
});
