import { describe, expect, it } from "vitest";
import { filterSessionForPlayer } from "./player-view";

// The real filter the player-view route applies: what reaches a player of
// a session with content hidden from players, shared with one character,
// and shared with everyone.

const session = {
  npcs: [
    { name: "Open Npc", status: "used", visibleTo: "all" },
    { name: "Secret Npc", status: "used", visibleTo: "dm" },
    { name: "Mira's Npc", status: "used", visibleTo: ["Mira"] },
    { name: "Mira's Old Npc", status: "used", visibleTo: "Mira" },
  ],
  items: [
    { name: "Open Item", found: true, visibleTo: "all" },
    { name: "Secret Item", found: true, visibleTo: "dm" },
  ],
  // Equipment is hidden from players by default.
  equipment: [{ name: "Planned Loot" }],
  eventLog: [
    { text: "Open event", visibleTo: "all" },
    { text: "Secret event", visibleTo: "dm" },
  ],
};

function seen(characterName: string | null): string[] {
  const out = filterSessionForPlayer(session, characterName) as Record<string, { name?: string; text?: string }[]>;
  return [...out.npcs, ...out.items, ...out.equipment, ...out.eventLog].map((e) => e.name ?? e.text ?? "");
}

const OPEN = ["Open Npc", "Open Item", "Open event"];

describe("filterSessionForPlayer", () => {
  it("a player sees what everyone sees and what is shared with their character", () => {
    expect(seen("Mira")).toEqual(["Open Npc", "Mira's Npc", "Mira's Old Npc", "Open Item", "Open event"]);
    expect(seen("Arvid")).toEqual(OPEN);
    expect(seen(null)).toEqual(OPEN);
  });

  it.each(["dm", "DM", " dm ", "all"])("a character called %j sees only what everyone sees (S1)", (name) => {
    expect(seen(name)).toEqual(OPEN);
  });
});

describe("filterSessionForPlayer sends only what the player is shown (S15)", () => {
  it("leaves out visibleTo, plannedLocation, linkedTo, stashId and notes", () => {
    const out = filterSessionForPlayer(
      {
        items: [{ name: "Ring", description: "Gold", found: true, plannedLocation: "Secret Vault", stashId: 7, visibleTo: ["Mira", "Bo"], notes: "cursed" }],
        readAloud: [{ title: "Door", text: "It creaks", read: true, linkedType: "npc", linkedTo: "Hidden Traitor", day: 1, time: "night" }],
        npcs: [{ name: "Guard", status: "used", plannedLocation: "Secret Vault", visibleTo: "all", day: 1, time: "night" }],
      },
      "Mira",
    );
    const json = JSON.stringify(out);
    for (const leak of ["Secret Vault", "Hidden Traitor", "stashId", "visibleTo", "cursed", "\"Bo\""]) expect(json).not.toContain(leak);
    expect(json).toContain("Ring");
    expect(json).toContain("It creaks");
  });
});
