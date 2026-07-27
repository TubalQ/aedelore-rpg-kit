import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as campaignsApi from "../api/campaigns.js";
import * as sessionsApi from "../api/sessions.js";
import { safeTool } from "./safe-tool.js";
import { text, asRecord, asArray } from "./helpers.js";

export function registerUtilityTools(
  server: McpServer,
  client: ApiClient,
  token: string,
): void {
  safeTool(
    server,
    "get_campaign_state",
    "Get a combined overview of a campaign: info, active session, characters, recent events",
    { campaign_id: z.number().describe("Campaign ID") },
    async ({ campaign_id }) => {
      const cid = campaign_id as number;
      const [campaignRaw, charsRaw, sessionsRaw] = await Promise.all([
        campaignsApi.getCampaign(client, token, cid),
        campaignsApi.listCampaignCharacters(client, token, cid),
        campaignsApi.listCampaignSessions(client, token, cid),
      ]);
      const campaign = asRecord(campaignRaw);
      const chars = asArray(charsRaw);

      // getCampaign returnerar ingen sessions-array - hämta dem separat.
      const sessions = asArray(sessionsRaw);
      const activeSessions = sessions.filter((s) => s.status !== "locked");
      const lockedSessions = sessions.filter((s) => s.status === "locked");

      let output = `# Campaign: ${campaign.name}\n`;
      if (campaign.description) output += `${campaign.description}\n`;
      output += `\nSessions: ${sessions.length} total (${lockedSessions.length} completed, ${activeSessions.length} active)\n`;

      // Characters
      if (chars?.length) {
        output += `\n## Characters (${chars.length})\n`;
        for (const c of chars) {
          const d = asRecord(c.data ?? {});
          output += `- **${d.character_name || c.name}** -- ${d.race || "?"} ${d.class || "?"}`;
          if (d.religion) output += ` (${d.religion})`;
          output += ` | XP: ${c.xp || 0}`;
          output += ` | Locks: race/class=${c.race_class_locked ? "LOCKED" : "open"}, attributes=${c.attributes_locked ? "LOCKED" : "open"}, abilities=${c.abilities_locked ? "LOCKED" : "open"}`;
          output += "\n";
        }
      }

      // Latest active session summary
      if (activeSessions.length > 0) {
        const latest = activeSessions[activeSessions.length - 1];
        const full = asRecord(await sessionsApi.getSession(
          client,
          token,
          latest.id as number,
        ));
        const data = asRecord(full.data ?? {});

        output += `\n## Active Session #${full.session_number}\n`;
        output += `Date: ${full.date || "N/A"} | Location: ${full.location || "N/A"}\n`;

        if (data.hook) output += `\n**Hook:** ${data.hook}\n`;
        if (data.prolog) output += `**Prolog:** ${data.prolog}\n`;

        const npcs = (data.npcs || []) as Array<Record<string, unknown>>;
        if (npcs.length) {
          output += `\n**NPCs:** ${npcs.map((n) => n.name).join(", ")}\n`;
        }

        const places = (data.places || []) as Array<Record<string, unknown>>;
        if (places.length) {
          output += `**Places:** ${places.map((p) => `${p.name}${p.visited ? " (visited)" : ""}`).join(", ")}\n`;
        }

        const events = (data.eventLog || []) as Array<Record<string, unknown>>;
        if (events.length) {
          output += `\n**Recent Events (last 5):**\n`;
          for (const e of events.slice(-5)) {
            output += `- ${e.timestamp || ""} ${e.text}\n`;
          }
        }
      }

      output += `\n---\n## GM INSTRUCTIONS (if you are running a game for this player)\n`;
      output += `Before you start playing, you MUST:\n`;
      output += `1. **Ask the player what to load:** "Should I load game rules, game data (weapons/armor/spells), world lore, campaign history (which sessions?), or everything?"\n`;
      output += `2. **Load what they choose** using get_rules, get_game_data, get_world_lore, get_session / search_sessions.\n`;
      output += `3. **Confirm what you loaded** ("I have loaded the game rules, your spells, and sessions 1-3. Ready to begin.")\n`;
      output += `4. **Tell the player:** "If I ever seem to forget details, make things up, or get rules wrong, just tell me to reload."\n`;
      output += `5. **NEVER invent locations, creatures, or NPCs.** Only use content from Aedelore game data and lore.\n`;
      output += `6. **Log everything** with add_event and add_turning_point as the adventure progresses.\n`;

      return text(output.trim());
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "search_sessions",
    "Search across all sessions in a campaign for NPCs, places, items, or text",
    {
      campaign_id: z.number().describe("Campaign ID"),
      query: z.string().describe("Search term"),
    },
    async ({ campaign_id, query }) => {
      const cid = campaign_id as number;
      const q = (query as string).toLowerCase();

      const sessionList = asArray(await campaignsApi.listCampaignSessions(
        client,
        token,
        cid,
      ));

      const results: string[] = [];

      for (const s of sessionList) {
        const full = asRecord(await sessionsApi.getSession(
          client,
          token,
          s.id as number,
        ));
        const data = asRecord(full.data ?? {});
        const matches: string[] = [];

        // Search NPCs
        const npcs = (data.npcs || []) as Array<Record<string, unknown>>;
        for (const npc of npcs) {
          if (
            [npc.name, npc.role, npc.description]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q)
          ) {
            matches.push(`NPC: ${npc.name} (${npc.role || "no role"})`);
          }
        }

        // Search places
        const places = (data.places || []) as Array<Record<string, unknown>>;
        for (const p of places) {
          if (
            [p.name, p.description]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q)
          ) {
            matches.push(`Place: ${p.name}`);
          }
        }

        // Search encounters
        const encounters = (data.encounters || []) as Array<Record<string, unknown>>;
        for (const enc of encounters) {
          if (
            [enc.name, enc.description, enc.tactics, enc.loot]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q)
          ) {
            matches.push(`Encounter: ${enc.name}`);
          }
        }

        // Search items
        const items = (data.items || []) as Array<Record<string, unknown>>;
        for (const item of items) {
          if (
            [item.name, item.description]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q)
          ) {
            matches.push(`Item: ${item.name}`);
          }
        }

        // Search events
        const events = (data.eventLog || []) as Array<Record<string, unknown>>;
        for (const e of events) {
          if (((e.text as string) || "").toLowerCase().includes(q)) {
            matches.push(`Event: ${e.text}`);
          }
        }

        // Search turning points
        const turningPoints = (data.turningPoints || []) as Array<
          Record<string, unknown>
        >;
        for (const tp of turningPoints) {
          if (
            [tp.description, tp.consequence]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q)
          ) {
            matches.push(`Turning Point: ${tp.description}`);
          }
        }

        if (matches.length > 0) {
          results.push(
            `### Session #${full.session_number} (${full.date || ""})\n${matches.map((m) => `- ${m}`).join("\n")}`,
          );
        }
      }

      if (results.length === 0) return text(`No results for "${query}"`);
      return text(results.join("\n\n"));
    },
    { rateLimit: 10 },
  );

  safeTool(
    server,
    "generate_markdown_export",
    "Export a session as readable Markdown",
    { session_id: z.number().describe("Session ID") },
    async ({ session_id }) => {
      const session = asRecord(await sessionsApi.getSession(
        client,
        token,
        session_id as number,
      ));
      const data = asRecord(session.data ?? {});

      let md = `# Session #${session.session_number}\n`;
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
          if (item.givenTo) md += ` (given to ${item.givenTo})`;
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
          md += `- **${n.timestamp || ""}** [${n.category || "reminder"}] ${n.text}\n`;
        }
        md += "\n";
      }

      return text(md.trim());
    },
    { rateLimit: 10 },
  );
}
