import { enemyLine, names, preview, slotLabel, str, visibility } from "./format.js";

// Renders the app's table view (GET /api/sessions/:id/table) for an AI game
// master: the active scene first, then what comes next, the party and the
// last things that happened. Unread read-alouds are given in full because the
// GM is about to read them out.

type Rec = Record<string, unknown>;

function records(v: unknown): Rec[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Rec[]) : [];
}

const PICK_REASON: Record<string, string> = {
  requested: "the scene you asked for",
  started: "the scene in progress",
  planned: "no scene in progress; the next planned one",
  first: "every scene is completed; the first one",
};

function sceneHead(s: Rec): string {
  const slot = slotLabel(s);
  return `"${str(s.name)}" [${str(s.status) || "planned"}]${slot ? ` ${slot}` : ""}${str(s.location) ? ` at ${str(s.location)}` : ""}`;
}

function sceneBlock(scene: Rec): string {
  let out = "";
  const place = scene.place as Rec | null;
  if (place) {
    out += `Place "${str(place.name)}"${place.visited ? " (visited)" : " (not yet visited)"}${str(place.description) ? `: ${str(place.description)}` : ""}\n`;
  }
  const enemies = records(scene.enemies);
  if (enemies.length) out += `Enemies: ${enemies.map(enemyLine).join("; ")}\n`;
  if (str(scene.tactics)) out += `Tactics: ${str(scene.tactics)}\n`;
  if (str(scene.loot)) out += `Loot: ${str(scene.loot)}\n`;
  if (str(scene.notes)) out += `Notes: ${str(scene.notes)}\n`;

  const npcs = records(scene.npcs);
  if (npcs.length) {
    out += `People here:\n`;
    for (const n of npcs) {
      const meta = [str(n.role), str(n.disposition), str(n.status) === "used" ? "met" : "not met yet"].filter(Boolean).join(", ");
      out += `- NPC "${str(n.name)}" (${meta})${visibility(n)}${str(n.description) ? `: ${str(n.description)}` : ""}\n`;
    }
  }
  const things = [
    ...records(scene.items).map((i) => `- Item "${str(i.name)}"${i.found ? " (found)" : ""}${names(i.givenTo) ? ` (given to ${names(i.givenTo)})` : ""}${i.stashId ? ` [stash #${str(i.stashId)}]` : ""}${visibility(i)}${str(i.description) ? `: ${preview(str(i.description), 160)}` : ""}`),
    ...records(scene.equipment).map((q) => `- Equipment "${str(q.name)}" (${str(q.type) || "misc"})${names(q.givenTo) ? ` (given to ${names(q.givenTo)})` : ""}${q.stashId ? ` [stash #${str(q.stashId)}]` : ""}${visibility(q)}`),
  ];
  if (things.length) out += `Things here:\n${things.join("\n")}\n`;

  const reads = records(scene.readAloud);
  const unread = reads.filter((r) => !r.read);
  const done = reads.filter((r) => r.read);
  for (const r of unread) out += `Read-aloud "${str(r.title) || "Untitled"}" (unread):\n${str(r.text)}\n`;
  if (done.length) out += `Already read: ${done.map((r) => `"${str(r.title)}"`).join(", ")}\n`;
  return out;
}

export function formatTable(view: Rec): string {
  const session = (view.session ?? {}) as Rec;
  const title = str(session.title);
  let out = `# Table: session #${str(session.sessionNumber)}${title ? ` "${title}"` : ""} (session_id ${str(session.id)}, campaign_id ${str(session.campaignId)})\n`;

  const scene = view.scene as Rec | null;
  if (scene) {
    out += `\n## Now: ${sceneHead(scene)}\n(${PICK_REASON[str(view.pick)] ?? str(view.pick)})\n${sceneBlock(scene)}`;
  } else {
    out += `\nNo scenes (encounters) in this session yet. Plan one with add_to_session (kind encounter) or import_content.\n`;
  }

  const upcoming = records(view.upcoming);
  if (upcoming.length) out += `\n## Next\n${upcoming.map((s) => `- ${sceneHead(s)}`).join("\n")}\n`;

  const party = records(view.party);
  if (party.length) {
    out += `\n## Party\n`;
    for (const c of party) {
      const who = [str(c.race), str(c.class)].filter(Boolean).join(" ");
      const status = [
        `HP ${str(c.hp)}/${str(c.maxHp)}`,
        Number(c.maxArcana) > 0 && `Arcana ${str(c.arcana)}/${str(c.maxArcana)}`,
        Number(c.willpower) > 0 && `Willpower ${str(c.willpower)}`,
        Number(c.bleed) > 0 && `Bleed ${str(c.bleed)}`,
        Number(c.weakened) > 0 && `Weakened ${str(c.weakened)}`,
        `XP ${str(c.xp)}`,
      ].filter(Boolean);
      out += `- ${str(c.name)} (character_id ${str(c.id)}${str(c.player) ? `, player ${str(c.player)}` : ""})${who ? ` ${who}` : ""} | ${status.join(" | ")}\n`;
    }
  }

  const log = records(view.recentLog);
  if (log.length) {
    out += `\n## Recent log\n${log.map((e) => `- ${slotLabel(e) ? `${slotLabel(e)}: ` : ""}${str(e.linkedTo) ? `[${str(e.linkedTo)}] ` : ""}${str(e.text)}`).join("\n")}\n`;
  }
  const reminders = records(view.reminders);
  if (reminders.length) {
    out += `\n## Your reminders (private)\n${reminders.map((n) => `- [${str(n.category)}] ${str(n.text)}`).join("\n")}\n`;
  }

  const loose = (view.loose ?? {}) as Record<string, unknown>;
  const looseParts = [
    ["places", "places"],
    ["npcs", "NPCs"],
    ["items", "items"],
  ]
    .map(([key, label]) => {
      const names = Array.isArray(loose[key]) ? (loose[key] as unknown[]).map(String).filter(Boolean) : [];
      return names.length ? `${label}: ${names.map((n) => `"${n}"`).join(", ")}` : "";
    })
    .filter(Boolean);
  if (looseParts.length) out += `\n## Not tied to a scene\n${looseParts.join("; ")}\n`;

  out +=
    `\nAs play moves on: encounter (start, damage, complete), mark (place, npc, item, read_aloud), log (event, turning_point), update_character. ` +
    `Another scene: get_table(session_id, scene="<encounter name>").`;
  return out;
}
