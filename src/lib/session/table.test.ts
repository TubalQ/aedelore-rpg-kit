import { describe, expect, it } from "vitest";
import {
  SessionDataSchema,
  newEncounter,
  newEnemy,
  newItem,
  newNpc,
  newPlace,
  newReadAloud,
} from "@/lib/schemas/session";
import { CharacterDataSchema } from "@/lib/schemas/character";
import type { CampaignCharacter } from "@/lib/db/queries/campaigns";
import { buildTableView } from "./table";

const data = SessionDataSchema.parse({
  places: [newPlace({ name: "Old Mill", description: "Rotten wheel.", day: "2" }), newPlace({ name: "Crossroads" })],
  encounters: [
    newEncounter({ name: "Toll Gate", location: "Gate", day: "1", time: "morning", status: "completed" }),
    newEncounter({
      name: "Wolves at the Mill",
      location: "Old Mill",
      day: "2",
      time: "night",
      status: "planned",
      enemies: [newEnemy({ name: "Dire Wolf", hp: 9, maxHp: 14 })],
      tactics: "Flank.",
    }),
    newEncounter({ name: "Miller's Secret", location: "Old Mill", day: "3", time: "dawn", status: "planned" }),
    newEncounter({ name: "Ambush", location: "Road", day: "2", time: "dusk", status: "started" }),
  ],
  npcs: [
    newNpc({ name: "Old Miller", plannedLocation: "Old Mill", day: "2", time: "night" }),
    newNpc({ name: "Wanderer", plannedLocation: "Nowhere" }),
  ],
  items: [newItem({ name: "Wax seal", plannedLocation: "Wolves at the Mill" })],
  readAloud: [
    newReadAloud({ title: "Howl", linkedType: "encounter", linkedTo: "Wolves at the Mill", read: true }),
    newReadAloud({ title: "Mill door", linkedType: "place", linkedTo: "Old Mill", day: "2", time: "night" }),
  ],
  eventLog: Array.from({ length: 7 }, (_, i) => ({ text: `e${i}`, day: "2", time: "dusk" })),
  dmNotes: [
    { text: "miller lies", category: "npc", timestamp: "" },
    { text: "wolves flee at half", category: "plan", timestamp: "" },
    { text: "give xp", category: "reminder", timestamp: "" },
  ],
});

const hero: CampaignCharacter = {
  id: 3,
  name: "Ada",
  playerName: "tester",
  playerId: "u1",
  data: CharacterDataSchema.parse({ race: null, class: null, hp: 12, maxHp: 20, arcana: 2, maxArcana: 5 }),
  xp: 40,
  xpSpent: 0,
  raceClassLocked: false,
  attributesLocked: false,
  abilitiesLocked: false,
};

describe("buildTableView", () => {
  it("picks the started scene first, like the play view", () => {
    const view = buildTableView(data, [hero]);
    expect(view.pick).toBe("started");
    expect(view.scene?.name).toBe("Ambush");
  });

  it("lists upcoming scenes in play order and skips completed ones", () => {
    const view = buildTableView(data, [hero]);
    expect(view.upcoming.map((s) => s.name)).toEqual(["Wolves at the Mill", "Miller's Secret"]);
  });

  it("gathers the requested scene's place, enemies, people, items and read-alouds (unread first)", () => {
    const view = buildTableView(data, [hero], "wolves at the mill");
    expect(view.pick).toBe("requested");
    expect(view.scene?.place).toEqual({ name: "Old Mill", description: "Rotten wheel.", visited: false });
    expect(view.scene?.enemies[0]).toMatchObject({ name: "Dire Wolf", hp: 9, maxHp: 14 });
    expect(view.scene?.npcs.map((n) => n.name)).toEqual(["Old Miller"]);
    expect(view.scene?.items.map((i) => i.name)).toEqual(["Wax seal"]);
    expect(view.scene?.readAloud.map((r) => r.title)).toEqual(["Mill door", "Howl"]);
  });

  it("falls back to the default pick for an unknown scene name", () => {
    expect(buildTableView(data, [hero], "Nope").pick).toBe("started");
  });

  it("carries the party, the last log entries, reminders and loose content", () => {
    const view = buildTableView(data, [hero]);
    expect(view.party[0]).toMatchObject({ name: "Ada", hp: 12, maxHp: 20, arcana: 2, xp: 40 });
    expect(view.recentLog.map((e) => e.text)).toEqual(["e2", "e3", "e4", "e5", "e6"]);
    expect(view.reminders.map((n) => n.text)).toEqual(["wolves flee at half", "give xp"]);
    expect(view.loose.npcs).toEqual(["Wanderer"]);
    expect(view.loose.places).toEqual(["Crossroads"]);
  });

  it("is empty but valid for a session without encounters", () => {
    const view = buildTableView(SessionDataSchema.parse({}), []);
    expect(view).toMatchObject({ pick: "none", scene: null, upcoming: [], party: [] });
  });
});
