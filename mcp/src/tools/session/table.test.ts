import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTable } from "./table.js";

const view = {
  session: { id: 54, campaignId: 9, sessionNumber: 7, title: "The Drowned Road", status: "draft" },
  pick: "started",
  scene: {
    name: "Wolves at the Mill",
    status: "started",
    day: "2",
    time: "night",
    location: "Old Mill",
    place: { name: "Old Mill", description: "Rotten wheel.", visited: false },
    enemies: [{ name: "Dire Wolf", hp: 9, maxHp: 14, armor: "hide", dmg: "1D8" }],
    tactics: "Flank.",
    loot: "",
    notes: "",
    npcs: [{ name: "Old Miller", role: "miller", status: "unused", description: "Nervous." }],
    items: [{ name: "Wax seal", stashId: 12, visibleTo: "dm" }],
    equipment: [],
    readAloud: [
      { title: "Mill door", text: "The door hangs by one hinge.", read: false },
      { title: "Howl", text: "...", read: true },
    ],
  },
  upcoming: [{ name: "Miller's Secret", status: "planned", day: "3", time: "dawn", location: "Old Mill" }],
  loose: { places: ["Crossroads"], npcs: [], items: [] },
  party: [{ id: 3, name: "Ada", player: "tester", race: "Human", class: "Warrior", hp: 12, maxHp: 20, arcana: 0, maxArcana: 0, willpower: 1, bleed: 0, weakened: 0, xp: 40 }],
  recentLog: [{ text: "Heard howling.", day: "2", time: "dusk", linkedTo: "" }],
  reminders: [{ category: "plan", text: "Wolves flee at half." }],
};

test("the table leads with the active scene and why it was picked", () => {
  const out = formatTable(view);
  assert.match(out, /# Table: session #7 "The Drowned Road" \(session_id 54, campaign_id 9\)/);
  assert.match(out, /## Now: "Wolves at the Mill" \[started\] day 2, night at Old Mill\n\(the scene in progress\)/);
  assert.match(out, /Place "Old Mill" \(not yet visited\): Rotten wheel\./);
  assert.match(out, /Enemies: Dire Wolf \(HP 9\/14, armor hide, DMG 1D8\)/);
});

test("people, things and unread read-alouds in full; read ones by title", () => {
  const out = formatTable(view);
  assert.match(out, /NPC "Old Miller" \(miller, not met yet\): Nervous\./);
  assert.match(out, /Item "Wax seal" \[stash #12\] \[hidden from players\]/);
  assert.match(out, /Read-aloud "Mill door" \(unread\):\nThe door hangs by one hinge\./);
  assert.match(out, /Already read: "Howl"/);
});

test("next scenes, party, log, reminders and loose content follow", () => {
  const out = formatTable(view);
  assert.match(out, /## Next\n- "Miller's Secret" \[planned\] day 3, dawn at Old Mill/);
  assert.match(out, /- Ada \(character_id 3, player tester\) Human Warrior \| HP 12\/20 \| Willpower 1 \| XP 40/);
  assert.match(out, /- day 2, dusk: Heard howling\./);
  assert.match(out, /- \[plan\] Wolves flee at half\./);
  assert.match(out, /places: "Crossroads"/);
});

test("a session without scenes says how to add one", () => {
  const out = formatTable({ session: { id: 1, sessionNumber: 1, campaignId: 2 }, pick: "none", scene: null, upcoming: [], party: [], recentLog: [], reminders: [], loose: {} });
  assert.match(out, /No scenes \(encounters\) in this session yet/);
});
