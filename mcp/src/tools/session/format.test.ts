import { test } from "node:test";
import assert from "node:assert/strict";
import { formatSession, lastPosition, sessionDigest } from "./format.js";

const session = {
  id: 54,
  sessionNumber: 7,
  title: "The Drowned Road",
  status: "draft",
  data: {
    hook: "A courier never arrived.",
    sessionNotes: { summary: "The party reached Avenstoff.", followUp: "" },
    places: [
      { name: "Avenstoff Gate", day: "1", time: "morning", visited: true, description: "Wet stone." },
      { name: "Old Mill", day: "2", time: "night", visited: false },
    ],
    npcs: [{ name: "Tessa", role: "guard", status: "used", day: "1", time: "morning", plannedLocation: "Avenstoff Gate" }],
    encounters: [
      {
        name: "Wolves at the Mill",
        status: "planned",
        day: "2",
        time: "night",
        location: "Old Mill",
        enemies: [{ name: "Dire Wolf", hp: 9, maxHp: 14, armor: "hide", weapon: "bite", atkBonus: "+3", dmg: "1D8" }],
        tactics: "Flank.",
      },
    ],
    items: [{ name: "Wax seal", stashId: 12, found: false, day: "2", time: "night", visibleTo: "dm" }],
    eventLog: [
      { text: "Paid the toll.", day: "1", time: "morning" },
      { text: "Heard howling.", day: "1", time: "dusk" },
    ],
    turningPoints: [],
    dmNotes: [{ text: "Tessa is a spy.", category: "npc" }],
    readAloud: [],
    equipment: [],
  },
};

test("full view groups records by day and time in play order", () => {
  const out = formatSession(session, "full");
  const order = ["## day 1, morning", "## day 1, dusk", "## day 2, night"].map((h) => out.indexOf(h));
  assert.ok(order.every((i) => i >= 0), out);
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("records show the exact quoted name the write tools match on", () => {
  const out = formatSession(session, "full");
  assert.match(out, /Place "Avenstoff Gate" \(visited\)/);
  assert.match(out, /NPC "Tessa" \(guard, met\) at Avenstoff Gate/);
  assert.match(out, /Item "Wax seal" .*\[stash #12\] \[hidden from players\]/);
});

test("enemies carry their stats", () => {
  const out = formatSession(session, "full");
  assert.match(out, /Dire Wolf \(HP 9\/14, armor hide, weapon bite, ATK \+3, DMG 1D8\)/);
  assert.match(out, /Tactics: Flank\./);
});

test("summary view drops tactics and private DM notes", () => {
  const out = formatSession(session, "summary");
  assert.doesNotMatch(out, /Tactics/);
  assert.doesNotMatch(out, /Tessa is a spy/);
  assert.match(out, /Summary: The party reached Avenstoff\./);
});

test("digest and last position summarise the session", () => {
  assert.match(sessionDigest(session), /#7 The Drowned Road \(session_id 54, draft\): The party reached Avenstoff\./);
  assert.match(lastPosition(session), /last logged day 1, dusk: Heard howling\./);
  const sameSlot = { data: { eventLog: [{ text: "first", day: "1", time: "dusk" }, { text: "second", day: "1", time: "dusk" }] } };
  assert.match(lastPosition(sameSlot), /last logged day 1, dusk: second/);
  const withNext = { ...session, data: { ...session.data, sessionNotes: { summary: "Done.", followUp: "Find Lisbet." } } };
  assert.match(sessionDigest(withNext), /Done\. Next: Find Lisbet\./);
  assert.match(lastPosition(session), /last visited place "Avenstoff Gate" \(day 1, morning\)/);
});
