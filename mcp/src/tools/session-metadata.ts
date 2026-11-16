import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as sessionsApi from "../api/sessions.js";
import { withSession, text, textError, asRecord } from "./helpers.js";
import { safeTool } from "./safe-tool.js";

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerSessionMetadataTools(
  server: McpServer,
  client: ApiClient,
  token: string,
): void {
  // -------------------------------------------------------------------------
  // set_session_hook
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "set_session_hook",
    "Set the session hook (the central goal or premise shown to the DM at the top of the session).",
    {
      session_id: z.number().int().positive().describe("Session ID"),
      hook: z.string().describe("Hook text"),
    },
    async ({ session_id, hook }) => {
      return withSession(client, token, session_id as number, async (data) => {
        data.hook = hook;
        return text("Session hook set.");
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // set_session_prolog
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "set_session_prolog",
    "Set the session prolog (recap or opening narration shown before play begins).",
    {
      session_id: z.number().int().positive().describe("Session ID"),
      prolog: z.string().describe("Prolog text"),
    },
    async ({ session_id, prolog }) => {
      return withSession(client, token, session_id as number, async (data) => {
        data.prolog = prolog;
        return text("Session prolog set.");
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // set_session_summary
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "set_session_summary",
    "Set the post-session summary and follow-up notes (what happened, what is unresolved).",
    {
      session_id: z.number().int().positive().describe("Session ID"),
      summary: z.string().describe("Summary of what happened in the session"),
      follow_up: z
        .string()
        .optional()
        .describe("Open threads, unresolved questions, things to address next session"),
    },
    async ({ session_id, summary, follow_up }) => {
      return withSession(client, token, session_id as number, async (data) => {
        if (!data.sessionNotes) data.sessionNotes = {};
        const sessionNotes = asRecord(data.sessionNotes);
        sessionNotes.summary = summary;
        if (follow_up !== undefined) sessionNotes.followUp = follow_up;
        return text(
          `Session summary saved.${follow_up ? " Follow-up noted." : ""}`,
        );
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // update_session_meta
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "update_session_meta",
    "Update session metadata: title, date, real-world location, in-game location. Only the fields you pass change; session content is not touched.",
    {
      session_id: z.number().int().positive().describe("Session ID"),
      title: z.string().max(200).optional().describe("Session title"),
      date: z.string().max(50).optional().describe("Session date (YYYY-MM-DD)"),
      location: z.string().max(200).optional().describe("Where the group plays (real world)"),
      game_location: z.string().max(200).optional().describe("Where the session takes place in the game world"),
    },
    async ({ session_id, title, date, location, game_location }) => {
      const payload: Record<string, unknown> = {};
      if (title !== undefined) payload.title = title;
      if (date !== undefined) payload.date = date;
      if (location !== undefined) payload.location = location;
      if (game_location !== undefined) payload.gameLocation = game_location;
      if (Object.keys(payload).length === 0) return textError("No changes specified.");

      await sessionsApi.updateSession(client, token, session_id, payload);
      return text(
        `Session meta updated: ${Object.entries(payload).map(([k, v]) => `${k}=${v}`).join(", ")}`,
      );
    },
    { role: "dm" },
  );
}
