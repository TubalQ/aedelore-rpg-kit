import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as campaignsApi from "../api/campaigns.js";
import * as sessionsApi from "../api/sessions.js";
import { safeTool } from "./safe-tool.js";
import { asRecord, asArray } from "./helpers.js";
import { logger } from "../logger.js";

// ---------------------------------------------------------------------------
// Format a full session object as readable text for AI consumption.
// Ported from v1 formatSessionForAI.
// ---------------------------------------------------------------------------
function formatSessionForAI(session: Record<string, unknown>): string {
  let output = "";
  const data = session.data as Record<string, unknown> | undefined;
  if (!data) return output;

  if (data.prolog) output += `\n**Prolog:** ${data.prolog}\n`;
  if (data.hook) output += `\n**Hook:** ${data.hook}\n`;

  const notes = data.sessionNotes as Record<string, unknown> | undefined;
  if (notes) {
    if (notes.summary) output += `\n**Summary:** ${notes.summary}\n`;
    if (notes.followUp) output += `\n**Follow-up:** ${notes.followUp}\n`;
  }

  const turningPoints = data.turningPoints as Array<Record<string, unknown>> | undefined;
  if (turningPoints?.length) {
    const items = turningPoints
      .map((tp) => (tp.linkedTo ? `[${tp.linkedTo}] ` : "") + tp.description)
      .filter(Boolean)
      .join("; ");
    output += `\n**Key Moments:** ${items}\n`;
  }

  const eventLog = data.eventLog as Array<Record<string, unknown>> | undefined;
  if (eventLog?.length) {
    const items = eventLog
      .map((e) => (e.linkedTo ? `[${e.linkedTo}] ` : "") + e.text)
      .filter(Boolean)
      .join("; ");
    output += `\n**Events:** ${items}\n`;
  }

  const dmNotes = data.dmNotes as Array<Record<string, unknown>> | undefined;
  if (dmNotes?.length) {
    output += `\n**DM Notes (private):**\n`;
    for (const n of dmNotes) {
      output += `- [${n.category || "reminder"}] ${n.text}\n`;
    }
  }

  const npcs = data.npcs as Array<Record<string, unknown>> | undefined;
  if (npcs?.length) {
    output += `\n**NPCs:**\n`;
    for (const npc of npcs) {
      let line = `- ${npc.name}`;
      if (npc.role) line += ` (${npc.role})`;
      if (npc.disposition) line += ` [${npc.disposition}]`;
      if (npc.description) line += `: ${npc.description}`;
      if (npc.plannedLocation) line += ` -- at ${npc.plannedLocation}`;
      output += line + "\n";
    }
  }

  const places = data.places as Array<Record<string, unknown>> | undefined;
  if (places?.length) {
    output += `\n**Places:**\n`;
    for (const p of places) {
      let line = `- ${p.name}${p.visited ? " (visited)" : ""}`;
      if (p.description) line += `: ${p.description}`;
      output += line + "\n";
    }
  }

  const encounters = data.encounters as Array<Record<string, unknown>> | undefined;
  if (encounters?.length) {
    output += `\n**Encounters:**\n`;
    for (const enc of encounters) {
      let line = `- ${enc.name} [${enc.status || "planned"}]`;
      if (enc.location) line += ` at ${enc.location}`;
      const enemies = enc.enemies as Array<Record<string, unknown>> | undefined;
      if (enemies?.length) {
        line += ` -- Enemies: ${enemies.map((e) => `${e.name} (HP:${e.hp || "?"})`).join(", ")}`;
      }
      if (enc.tactics) line += `\n  Tactics: ${enc.tactics}`;
      if (enc.loot) line += `\n  Loot: ${enc.loot}`;
      output += line + "\n";
    }
  }

  const readAloud = data.readAloud as Array<Record<string, unknown>> | undefined;
  if (readAloud?.length) {
    output += `\n**Read-Aloud:**\n`;
    for (const ra of readAloud) {
      const txt = (ra.text as string) || "";
      const preview = txt.length > 200 ? txt.substring(0, 200) + "..." : txt;
      output += `- "${ra.title || "Untitled"}": ${preview}\n`;
    }
  }

  const items = data.items as Array<Record<string, unknown>> | undefined;
  if (items?.length) {
    output += `\n**Items/Clues:**\n`;
    for (const item of items) {
      let line = `- ${item.name}${item.found ? " (found)" : ""}`;
      if (item.description) line += `: ${item.description}`;
      if (item.givenTo) line += ` (given to ${item.givenTo})`;
      output += line + "\n";
    }
  }

  const equipment = data.equipment as Array<Record<string, unknown>> | undefined;
  if (equipment?.length) {
    output += `\n**Equipment:**\n`;
    for (const eq of equipment) {
      let line = `- ${eq.name} [${eq.type}]`;
      if (eq.rarity && eq.rarity !== "common") line += ` (${eq.rarity})`;
      if (eq.description) line += `: ${eq.description}`;
      if (eq.givenTo) line += ` (given to ${eq.givenTo})`;
      output += line + "\n";
    }
  }

  return output;
}

export function registerSessionTools(
  server: McpServer,
  client: ApiClient,
  token: string,
): void {
  // -----------------------------------------------------------------------
  // get_session
  // -----------------------------------------------------------------------
  safeTool(
    server,
    "get_session",
    "Get full session data including NPCs, encounters, places, items, events",
    { session_id: z.number().describe("Session ID") },
    async ({ session_id }) => {
      const session = asRecord(await sessionsApi.getSession(
        client,
        token,
        session_id as number,
      ));

      const num = session.session_number ?? session.sessionNumber ?? "?";
      const date = (session.date as string) || "no date";
      const status = (session.status as string) || "draft";
      const location = session.location as string | undefined;

      let text = `Session #${num} (${date}) [${status}]`;
      if (location) text += ` -- Location: ${location}`;
      text += "\n";
      text += formatSessionForAI(session);

      return { content: [{ type: "text", text }] };
    },
    { role: "dm" },
  );

  // -----------------------------------------------------------------------
  // get_session_history
  // -----------------------------------------------------------------------
  safeTool(
    server,
    "get_session_history",
    "Get all sessions for a campaign formatted as readable context for AI planning",
    { campaign_id: z.number().describe("Campaign ID") },
    async ({ campaign_id }) => {
      const sessions = asArray(await campaignsApi.listCampaignSessions(
        client,
        token,
        campaign_id as number,
      ));

      if (!sessions?.length) {
        return { content: [{ type: "text", text: "No sessions found." }] };
      }

      // Sort by session number
      sessions.sort(
        (a, b) =>
          ((a.session_number as number) ?? 0) - ((b.session_number as number) ?? 0),
      );

      let output = "";
      for (const s of sessions) {
        try {
          const full = asRecord(await sessionsApi.getSession(
            client,
            token,
            s.id as number,
          ));
          const num = full.session_number ?? full.sessionNumber ?? "?";
          const date = (full.date as string) || "no date";
          const status = (full.status as string) || "draft";
          output += `\n---\n### Session #${num} (${date}) -- ${status}\n`;
          if (full.location) output += `Location: ${full.location}\n`;
          output += formatSessionForAI(full);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          logger.warn({ sessionId: s.id, error: msg }, "Failed to fetch session for history");
          const num = s.session_number ?? s.sessionNumber ?? "?";
          output += `\n---\n### Session #${num} -- (failed to load)\n`;
        }
      }

      return { content: [{ type: "text", text: output }] };
    },
    { role: "dm" },
  );

  // -----------------------------------------------------------------------
  // create_session
  // -----------------------------------------------------------------------
  safeTool(
    server,
    "create_session",
    "Create a new session in a campaign",
    {
      campaign_id: z.number().describe("Campaign ID"),
      title: z.string().optional().describe("Session title"),
      date: z.string().optional().describe("Session date (YYYY-MM-DD)"),
      location: z.string().optional().describe("Session location"),
    },
    async ({ campaign_id, title, date, location }) => {
      // CreateSessionSchema tar title/date/location på top-nivå (inte nästlat under `data`,
      // som tidigare tyst droppades → session utan titel).
      const body: Record<string, unknown> = {};
      if (title) body.title = title;
      if (date) body.date = date;
      if (location) body.location = location;

      const result = asRecord(await campaignsApi.createSession(
        client,
        token,
        campaign_id as number,
        body,
      ));

      const num = result.session_number ?? result.sessionNumber ?? result.id;
      return {
        content: [
          {
            type: "text",
            text: `Session created: #${num} [id=${result.id}]${date ? ` date=${date}` : ""}${location ? ` location=${location}` : ""}`,
          },
        ],
      };
    },
    { role: "dm" },
  );

  // -----------------------------------------------------------------------
  // lock_session
  // -----------------------------------------------------------------------
  safeTool(
    server,
    "lock_session",
    "Lock a session (prevents further editing)",
    { session_id: z.number().describe("Session ID") },
    async ({ session_id }) => {
      await sessionsApi.lockSession(client, token, session_id as number);
      return {
        content: [
          {
            type: "text",
            text: `Session ${session_id} is now locked. No further edits are allowed until it is unlocked.`,
          },
        ],
      };
    },
    { role: "dm" },
  );

  // -----------------------------------------------------------------------
  // unlock_session
  // -----------------------------------------------------------------------
  safeTool(
    server,
    "unlock_session",
    "Unlock a locked session for editing",
    { session_id: z.number().describe("Session ID") },
    async ({ session_id }) => {
      await sessionsApi.unlockSession(client, token, session_id as number);
      return {
        content: [
          {
            type: "text",
            text: `Session ${session_id} is now unlocked and can be edited again.`,
          },
        ],
      };
    },
    { role: "dm" },
  );
}
