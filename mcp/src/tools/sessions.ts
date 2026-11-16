import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as campaignsApi from "../api/campaigns.js";
import * as sessionsApi from "../api/sessions.js";
import { safeTool } from "./safe-tool.js";
import { formatSession } from "./session/format.js";
import { formatTable } from "./session/table.js";
import { asRecord, asArray } from "./helpers.js";

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
    "Get one session laid out by day and time: places, NPCs, encounters (enemies with HP and stats), items, read-alouds, events, turning points and private DM notes. Each record shows the exact name and day/time the write tools match on. Use when running or prepping this session.",
    { session_id: z.number().int().positive().describe("Session ID") },
    async ({ session_id }) => {
      const session = asRecord(await sessionsApi.getSession(client, token, session_id as number));
      return { content: [{ type: "text", text: formatSession(session, "full") }] };
    },
    { role: "dm" },
  );

  // -----------------------------------------------------------------------
  // get_table
  // -----------------------------------------------------------------------
  safeTool(
    server,
    "get_table",
    "What is in front of the GM right now, in one call: the active scene (the one in progress, else the next planned) with its place, enemies and their stats, the NPCs and things there and unread read-aloud text; the next scenes; the party's HP and resources; the last log entries and your reminders. Call it when play starts and whenever the scene changes. Pass `scene` (an encounter name) to look at another scene.",
    {
      session_id: z.number().int().positive().describe("Session ID"),
      scene: z.string().optional().describe("Encounter name of the scene to show instead of the active one"),
    },
    async ({ session_id, scene }) => {
      const view = asRecord(await sessionsApi.getTable(client, token, session_id as number, scene as string | undefined));
      return { content: [{ type: "text", text: formatTable(view) }] };
    },
    { role: "dm" },
  );

  // -----------------------------------------------------------------------
  // get_session_history
  // -----------------------------------------------------------------------
  safeTool(
    server,
    "get_session_history",
    "The campaign's story so far, oldest first. detail=\"summary\" (default) gives each session's summary, hook and records in short form; detail=\"full\" gives everything and can be long. For one session use get_session.",
    {
      campaign_id: z.number().int().positive().describe("Campaign ID"),
      detail: z.enum(["summary", "full"]).optional().describe('"summary" (default) or "full"'),
      from_session: z.number().int().positive().optional().describe("Only sessions with this session number or later"),
    },
    async ({ campaign_id, detail, from_session }) => {
      // The list already carries each session's data; no per-session fetch.
      const sessions = asArray(await campaignsApi.listCampaignSessions(client, token, campaign_id as number))
        .filter((s) => !from_session || Number(s.sessionNumber ?? 0) >= (from_session as number))
        .sort((a, b) => Number(a.sessionNumber ?? 0) - Number(b.sessionNumber ?? 0));
      if (!sessions.length) return { content: [{ type: "text", text: "No sessions found." }] };
      const level = (detail as "summary" | "full" | undefined) ?? "summary";
      const output = sessions.map((s) => formatSession(s, level)).join("\n---\n");
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
      campaign_id: z.number().int().positive().describe("Campaign ID"),
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

      const num = result.sessionNumber ?? result.id;
      return {
        content: [
          {
            type: "text",
            text: `Session created: #${num} (session_id ${result.id})${date ? ` date=${date}` : ""}${location ? ` location=${location}` : ""}`,
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
    { session_id: z.number().int().positive().describe("Session ID") },
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
    { session_id: z.number().int().positive().describe("Session ID") },
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
