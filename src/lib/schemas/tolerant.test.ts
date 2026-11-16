import { describe, expect, it } from "vitest";
import { SessionDataSchema, newEncounter, newSessionEquipment } from "./session";
import { CharacterDataSchema } from "./character";
import { sanitizeDataPatch } from "./tolerant";

describe("SessionDataSchema reads bad stored values without throwing", () => {
  it("heals poisoned fields instead of failing the whole session", () => {
    const parsed = SessionDataSchema.parse({
      places: [{ name: "Thir", visited: "yes", notes: null, day: 3 }],
      npcs: ["not an object", { name: "Aldric", status: "dead" }],
      encounters: [{ name: "Ambush", status: "defeated", enemies: [{ name: "Goblin", hp: "7" }] }],
      equipment: [{ name: "Ring", type: "ring", bonuses: ["+1 Intelligence", 5] }],
      sessionNotes: "oops",
    });
    expect(parsed.places[0]).toMatchObject({ name: "Thir", visited: false, notes: "", day: "3" });
    expect(parsed.npcs).toHaveLength(1);
    expect(parsed.npcs[0].status).toBe("unused");
    expect(parsed.encounters[0].status).toBe("completed");
    expect(parsed.encounters[0].enemies[0].hp).toBe(7);
    expect(parsed.equipment[0].type).toBe("misc");
    expect(parsed.equipment[0].bonuses).toEqual([{ stat: "Intelligence", value: 1 }]);
    expect(parsed.sessionNotes.summary).toBe("");
  });

  it("keeps the MCP enemy stats", () => {
    const parsed = SessionDataSchema.parse({
      encounters: [{ name: "E", enemies: [{ name: "Orc", hp: 9, role: "Warrior", dmg: "1d8", atkBonus: "+2" }] }],
    });
    expect(parsed.encounters[0].enemies[0]).toMatchObject({ role: "Warrior", dmg: "1d8", atkBonus: "+2" });
  });

  it("gives new entries the schema defaults", () => {
    expect(newEncounter().status).toBe("planned");
    expect(newSessionEquipment().visibleTo).toBe("dm");
  });
});

describe("CharacterDataSchema arrays are tolerant per element", () => {
  it("drops only the bad element", () => {
    const parsed = CharacterDataSchema.parse({
      relationships: [{ name: "Mira", relation: "Ally" }, { relation: "no name" }],
      dmEquipment: [{ name: "Axe", type: "axe" }],
    });
    expect(parsed.relationships.map((r) => r.name)).toEqual(["Mira"]);
    expect(parsed.dmEquipment[0].type).toBe("misc");
  });
});

describe("sanitizeDataPatch", () => {
  it("refuses unknown keys", () => {
    const result = sanitizeDataPatch(SessionDataSchema, { eventLog: [], event_log: [] });
    expect(result).toEqual({ ok: false, unknownKeys: ["event_log"] });
  });

  it("normalises values to their stored shape", () => {
    const result = sanitizeDataPatch(SessionDataSchema, { places: [{ name: "A", visited: "true" }] });
    expect(result.ok && (result.patch.places as Array<{ visited: boolean }>)[0].visited).toBe(true);
  });
});

describe("player visibility", () => {
  it("a player without a character only sees entries shared with everyone", async () => {
    const { isVisibleTo, isGivenTo } = await import("./session");
    expect(isVisibleTo("all", null)).toBe(true);
    expect(isVisibleTo("", null)).toBe(false);
    expect(isVisibleTo("dm", null)).toBe(false);
    expect(isGivenTo([], null)).toBe(false);
    expect(isGivenTo([""], "")).toBe(false);
    expect(isVisibleTo(["Mira"], "Mira")).toBe(true);
    expect(isGivenTo(["Mira"], "Mira")).toBe(true);
    // A list of holders, never a substring match.
    expect(isGivenTo(["Miranda"], "Mira")).toBe(false);
  });
});
