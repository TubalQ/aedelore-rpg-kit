import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as sessionsApi from "../api/sessions.js";
import { withSession, text, asRecord } from "./helpers.js";
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
      session_id: z.number().describe("Session ID"),
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
      session_id: z.number().describe("Session ID"),
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
      session_id: z.number().describe("Session ID"),
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
    "Update top-level session metadata (date, location, session_number, title). Does NOT touch session content.",
    {
      session_id: z.number().describe("Session ID"),
      date: z.string().optional().describe("Session date (YYYY-MM-DD)"),
      location: z.string().optional().describe("Session location"),
      title: z.string().optional().describe("Session title"),
    },
    async ({ session_id, date, location, title }) => {
      const session = asRecord(await sessionsApi.getSession(
        client,
        token,
        session_id as number,
      ));

      const payload: Record<string, unknown> = {
        date: date !== undefined ? date : session.date,
        location: location !== undefined ? location : session.location,
        data: session.data || {},
      };
      if (title !== undefined) payload.title = title;

      await sessionsApi.updateSession(client, token, session_id as number, payload);

      const changed: string[] = [];
      if (date !== undefined) changed.push(`date=${date}`);
      if (location !== undefined) changed.push(`location=${location}`);
      if (title !== undefined) changed.push(`title=${title}`);

      return text(
        `Session meta updated: ${changed.join(", ") || "(no changes)"}`,
      );
    },
    { role: "dm" },
  );
}
