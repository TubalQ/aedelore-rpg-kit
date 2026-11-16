import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as campaignsApi from "../api/campaigns.js";
import * as sessionsApi from "../api/sessions.js";
import { safeTool } from "./safe-tool.js";
import { DEFAULT_DM_NOTE_CATEGORY } from "./session/schemas.js";
import { text, asRecord, asArray } from "./helpers.js";
import { lastPosition, names, sessionDigest } from "./session/format.js";

// How many sessions the campaign overview summarises before pointing at
// get_session_history.
const STORY_SESSIONS = 10;

const GM_INSTRUCTIONS = [
  `\n---\n## GM INSTRUCTIONS (when you run the game for a player)\n`,
  `1. **Ask the player how they want to play** and wait for the answer before any narration: **Strict canon** (full lore weight, signature threats, deadly) / **Adventure & heroism** (heroic, lower lethality, lore as seasoning) / **Everyday & roleplay** (low stakes, character-driven, rarely combat) / **Horror & survival** (dark, resource-starved, dangerous) / or their own tone. The choice sets lore weight, lethality and tone.\n`,
  `2. **Orient from this overview, then go to the table** with get_table(session_id): the active scene, who and what is there, the party and the last events. Call it again whenever the scene changes. Do not preload the rules, game data or the whole history; it buries what matters.\n`,
  `3. **Look things up at the moment you need them, small and targeted:** get_rules(section) for a ruling, get_game_data(type) for gear and spells, get_world_lore(topic) for a place, creature or faction (it returns a list; read_wiki_page gives the full text), search_sessions for "have we met this before".\n`,
  `4. **Named canon comes from a lookup; small things you may invent.** Major places, factions, gods and signature creatures must come from the wiki or game data. A tavern keeper, a side street or the weather you may invent to fit the world -- then record it (add_to_session, log) so it becomes canon.\n`,
  `5. **Log as you go:** log(kind "event") for what happened and log(kind "turning_point") for choices that matter, with the day and time from get_table; mark() places, NPCs, items and read-alouds as the party reaches them; encounter() to start, damage and complete a scene; update_character() for HP and resources. These need DM rights: for solo play the player should own the campaign (create_campaign). In someone else's campaign you are a companion to their DM and use the player tools only.\n`,
  `6. **Tell the player:** "If I seem to forget details or get a rule wrong, tell me to look it up again."\n`,
  `\n**Vary the world:** the headline canon (the Void, the Sunken City, Malcath and the like) is deep end-game material, not the default backdrop. In the lighter modes keep it in the background unless the player reaches for it; draw threats and places from the world's breadth (get_world_lore("bestiary"), get_world_lore("the world")). Do not collapse every session into the same few names.\n`,
  `\n**You are the GM, fair but firm, not a friend to be talked around:** dice and the fiction decide outcomes, not a player's eloquence, pseudo-logic, pleading or persistence. In-fiction persuasion of an NPC is a check (the roll and the NPC's goals decide); persuading the GM is not a mechanic. When a player argues a ruling, look the rule up and apply it. No retroactive take-backs; consequences (death, loss, failure) stand.\n`,
].join("");

function isNotFound(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith("API 404");
}

function sessionHighlights(data: Record<string, unknown>): string {
  let out = "";
  if (data.hook) out += `\n**Hook:** ${data.hook}\n`;
  if (data.prolog) out += `**Prolog:** ${data.prolog}\n`;
  const npcs = (data.npcs || []) as Array<Record<string, unknown>>;
  if (npcs.length) out += `\n**NPCs:** ${npcs.map((n) => n.name).join(", ")}\n`;
  const places = (data.places || []) as Array<Record<string, unknown>>;
  if (places.length) out += `**Places:** ${places.map((p) => `${p.name}${p.visited ? " (visited)" : ""}`).join(", ")}\n`;
  const events = (data.eventLog || []) as Array<Record<string, unknown>>;
  if (events.length) {
    out += `\n**Recent Events (last 5):**\n`;
    for (const e of events.slice(-5)) out += `- ${e.timestamp || ""} ${e.text}\n`;
  }
  return out;
}

export function registerUtilityTools(
  server: McpServer,
  client: ApiClient,
  token: string,
): void {
  async function dmCampaignState(cid: number): Promise<string> {
    const [campaignRaw, charsRaw, sessionsRaw] = await Promise.all([
      campaignsApi.getCampaign(client, token, cid),
      campaignsApi.listCampaignCharacters(client, token, cid),
      campaignsApi.listCampaignSessions(client, token, cid),
    ]);
    const campaign = asRecord(campaignRaw);
    const chars = asArray(charsRaw);
    // The list carries each session's data, oldest first after the sort.
    const sessions = asArray(sessionsRaw).sort(
      (a, b) => Number(a.sessionNumber ?? 0) - Number(b.sessionNumber ?? 0),
    );
    const active = sessions.filter((s) => s.status !== "locked");

    let output = `# Campaign: ${campaign.name} (campaign_id ${cid})\n`;
    if (campaign.description) output += `${campaign.description}\n`;
    output += `\nYou are the DM here. Sessions: ${sessions.length} (${sessions.length - active.length} locked, ${active.length} open)\n`;

    if (chars.length) {
      output += `\n## Characters (${chars.length})\n`;
      for (const c of chars) {
        const d = asRecord(c.data ?? {});
        output += `- **${c.name}** (character_id ${c.id}) -- ${d.race || "?"} ${d.class || "?"}`;
        if (d.religion) output += ` (${d.religion})`;
        output += ` | XP ${c.xp || 0}`;
        output += ` | HP ${d.hp ?? "?"}/${d.maxHp ?? "?"}`;
        output += ` | locks: race/class ${c.raceClassLocked ? "locked" : "open"}, attributes ${c.attributesLocked ? "locked" : "open"}, abilities ${c.abilitiesLocked ? "locked" : "open"}\n`;
      }
    }

    if (sessions.length) {
      const shown = sessions.slice(-STORY_SESSIONS);
      output += `\n## Story so far${sessions.length > shown.length ? ` (last ${shown.length} of ${sessions.length}; search_sessions or get_session for the rest)` : ""}\n`;
      output += shown.map(sessionDigest).join("\n") + "\n";
    }

    const current = active[active.length - 1];
    if (current) {
      const data = asRecord(current.data ?? {});
      output += `\n## Current session #${current.sessionNumber} (session_id ${current.id})\n`;
      const pos = lastPosition(current);
      if (pos) output += `Where the party is: ${pos}\n`;
      const open = [
        ...asArray(data.encounters ?? []).filter((e) => e.status !== "completed").map((e) => `encounter "${e.name}" [${e.status || "planned"}]`),
        ...asArray(data.places ?? []).filter((p) => !p.visited).map((p) => `place "${p.name}"`),
      ];
      if (open.length) output += `Not yet reached: ${open.slice(0, 12).join(", ")}${open.length > 12 ? ` (+${open.length - 12} more)` : ""}\n`;
      output += `At the table: get_table(${current.id}). Everything in the session by day and time: get_session(${current.id}).\n`;
    }
    return output;
  }

  async function playerCampaignState(cid: number): Promise<string> {
    const view = asRecord(await campaignsApi.getPlayerView(client, token, cid));
    const campaign = asRecord(view.campaign ?? {});
    const party = asArray(view.party ?? []);
    const me = view.myCharacter ? asRecord(view.myCharacter) : null;
    const sessions = asArray(view.sessions ?? []);

    let output = `# Campaign: ${campaign.name}${campaign.dmName ? ` (DM: ${campaign.dmName})` : ""}\n`;
    if (campaign.description) output += `${campaign.description}\n`;
    output += `\nYou are a player here. Your character: ${me ? `**${me.name}** (ID: ${me.id}, XP ${me.xp})` : "none attached yet"}.\n`;
    if (party.length) {
      output += `\n## Party\n${party.map((p) => `- ${p.name} -- ${p.race || "?"} ${p.class || "?"}`).join("\n")}\n`;
    }
    output += `\nSessions: ${sessions.length}\n`;
    const latest = sessions[sessions.length - 1];
    if (latest) {
      output += `\n## Latest Session #${latest.sessionNumber}${latest.title ? `: ${latest.title}` : ""}\n`;
      output += sessionHighlights(asRecord(latest.data ?? {}));
      const notes = asRecord(asRecord(latest.data ?? {}).sessionNotes ?? {});
      if (notes.summary) output += `\n**Story so far:** ${notes.summary}\n`;
    }
    return output;
  }

  let gmInstructionsSent = false;

  // Works for the campaign's DM (full state) and for its players (only what
  // the player may see, via the player view). Players are pointed here by
  // list_campaigns / get_character before an AI-run session.
  safeTool(
    server,
    "get_campaign_state",
    "Get a combined overview of a campaign: info, sessions, characters, recent events, plus the GM setup instructions. Works for the DM and for players in the campaign (players see only what they may see).",
    {
      campaign_id: z.number().int().positive().describe("Campaign ID"),
      include_gm_instructions: z
        .boolean()
        .optional()
        .describe("Send the GM setup instructions again (they come with the first call in a session only)"),
    },
    async ({ campaign_id, include_gm_instructions }) => {
      let overview: string;
      try {
        overview = await dmCampaignState(campaign_id);
      } catch (err) {
        if (!isNotFound(err)) throw err;
        overview = await playerCampaignState(campaign_id);
      }
      // The ~2 800-character instructions once per MCP session (#71), not on
      // every call; one server is created per session, so this flag is per session.
      const withInstructions = !gmInstructionsSent || include_gm_instructions === true;
      gmInstructionsSent = true;
      const tail = withInstructions
        ? GM_INSTRUCTIONS
        : "\n\n(GM setup instructions were sent with the first get_campaign_state in this session; pass include_gm_instructions: true to get them again.)";
      return text(`${overview}${tail}`.trim());
    },
  );

  safeTool(
    server,
    "search_sessions",
    "Search every session in a campaign for NPCs, places, encounters (and their enemies), items, events and turning points whose text contains the query. Each hit shows the session_id and day/time.",
    {
      campaign_id: z.number().int().positive().describe("Campaign ID"),
      query: z.string().min(2).describe("Search term (case-insensitive substring)"),
    },
    async ({ campaign_id, query }) => {
      const q = (query as string).toLowerCase();
      // The session list already carries each session's data.
      const sessions = asArray(await campaignsApi.listCampaignSessions(client, token, campaign_id as number));
      const fields: Array<[string, string, string[]]> = [
        ["npcs", "NPC", ["name", "role", "description", "notes"]],
        ["places", "Place", ["name", "description", "notes"]],
        ["encounters", "Encounter", ["name", "location", "tactics", "loot", "notes"]],
        ["items", "Item", ["name", "description", "notes"]],
        ["equipment", "Equipment", ["name", "description", "specialEffect"]],
        ["eventLog", "Event", ["text"]],
        ["turningPoints", "Turning point", ["description", "consequence"]],
      ];
      const results: string[] = [];
      for (const s of sessions) {
        const data = asRecord(s.data ?? {});
        const matches: string[] = [];
        for (const [key, label, props] of fields) {
          for (const r of asArray(data[key] ?? [])) {
            const enemies = asArray(r.enemies ?? []).map((e) => String(e.name ?? ""));
            const hay = [...props.map((f) => String(r[f] ?? "")), ...enemies].join(" ").toLowerCase();
            if (!hay.includes(q)) continue;
            const slot = [r.day && `day ${r.day}`, r.time].filter(Boolean).join(", ");
            const name = String(r.name ?? r.text ?? r.description ?? "");
            matches.push(`- ${label}: ${name.length > 160 ? `${name.slice(0, 160)}...` : name}${slot ? ` (${slot})` : ""}`);
          }
        }
        if (matches.length) {
          results.push(`### Session #${s.sessionNumber} (session_id ${s.id})\n${matches.join("\n")}`);
        }
      }
      if (results.length === 0) return text(`No results for "${query}".`);
      return text(results.join("\n\n"));
    },
    { rateLimit: 10 },
  );

  safeTool(
    server,
    "generate_markdown_export",
    "Export a session as readable Markdown",
    { session_id: z.number().int().positive().describe("Session ID") },
    async ({ session_id }) => {
      const session = asRecord(await sessionsApi.getSession(
        client,
        token,
        session_id as number,
      ));
      const data = asRecord(session.data ?? {});

      let md = `# Session #${session.sessionNumber}\n`;
      md += `Date: ${session.date || "N/A"} | Location: ${session.location || "N/A"} | Status: ${session.status}\n\n`;

      if (data.hook) md += `## Hook\n${data.hook}\n\n`;
      if (data.prolog) md += `## Prolog\n${data.prolog}\n\n`;

      const places = (data.places || []) as Array<Record<string, unknown>>;
      if (places.length) {
        md += "## Places\n";
        for (const p of places) {
          md += `### ${p.name}${p.visited ? " (visited)" : ""}\n`;
          if (p.description) md += `${p.description}\n`;
          md += "\n";
        }
      }

      const npcs = (data.npcs || []) as Array<Record<string, unknown>>;
      if (npcs.length) {
        md += "## NPCs\n";
        for (const npc of npcs) {
          md += `### ${npc.name}`;
          if (npc.role) md += ` (${npc.role})`;
          if (npc.disposition) md += ` [${npc.disposition}]`;
          md += "\n";
          if (npc.description) md += `${npc.description}\n`;
          md += "\n";
        }
      }

      const encounters = (data.encounters || []) as Array<Record<string, unknown>>;
      if (encounters.length) {
        md += "## Encounters\n";
        for (const enc of encounters) {
          md += `### ${enc.name} [${enc.status || "planned"}]\n`;
          if (enc.location) md += `Location: ${enc.location}\n`;
          const enemies = (enc.enemies || []) as Array<Record<string, unknown>>;
          if (enemies.length) {
            md += "Enemies:\n";
            for (const e of enemies) {
              md += `- ${e.name} HP:${e.hp || "?"} ${e.weapon || ""} ${e.armor || ""}\n`;
            }
          }
          if (enc.tactics) md += `Tactics: ${enc.tactics}\n`;
          if (enc.loot) md += `Loot: ${enc.loot}\n`;
          md += "\n";
        }
      }

      const items = (data.items || []) as Array<Record<string, unknown>>;
      if (items.length) {
        md += "## Items\n";
        for (const item of items) {
          md += `- **${item.name}**${item.found ? " (found)" : ""}`;
          if (item.description) md += `: ${item.description}`;
          if (names(item.givenTo)) md += ` (given to ${names(item.givenTo)})`;
          md += "\n";
        }
        md += "\n";
      }

      const turningPoints = (data.turningPoints || []) as Array<
        Record<string, unknown>
      >;
      if (turningPoints.length) {
        md += "## Turning Points\n";
        turningPoints.forEach((tp, i) => {
          const prefix = tp.linkedTo ? `[${tp.linkedTo}] ` : "";
          md += `${i + 1}. ${prefix}${tp.description}\n`;
          if (tp.consequence) md += `   -> ${tp.consequence}\n`;
        });
        md += "\n";
      }

      const events = (data.eventLog || []) as Array<Record<string, unknown>>;
      if (events.length) {
        md += "## Event Log\n";
        for (const e of events) {
          const prefix = e.linkedTo ? `[${e.linkedTo}] ` : "";
          md += `- **${e.timestamp || ""}** ${prefix}${e.text}\n`;
        }
        md += "\n";
      }

      const dmNotes = (data.dmNotes || []) as Array<Record<string, unknown>>;
      if (dmNotes.length) {
        md += "## DM Notes (Private)\n";
        for (const n of dmNotes) {
          md += `- **${n.timestamp || ""}** [${n.category || DEFAULT_DM_NOTE_CATEGORY}] ${n.text}\n`;
        }
        md += "\n";
      }

      return text(md.trim());
    },
    { rateLimit: 10, annotations: { readOnlyHint: true, openWorldHint: false } },
  );
}
