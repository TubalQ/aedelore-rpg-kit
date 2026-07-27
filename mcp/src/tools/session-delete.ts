import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import { withSession, findByKey, text, asRecord } from "./helpers.js";
import { safeTool } from "./safe-tool.js";

const timeEnum = z.enum(["dawn", "morning", "noon", "afternoon", "dusk", "evening", "night"]);

const dayOpt = z
  .number()
  .int()
  .optional()
  .describe("Day number (only needed if multiple records share this name)");
const timeOpt = timeEnum
  .optional()
  .describe("Time of day (only needed if multiple records share this name)");

// ---------------------------------------------------------------------------
// Helper: find + splice from array
// ---------------------------------------------------------------------------
function deleteFromArray(
  arr: unknown[],
  value: string,
  opts: { day?: number; time?: string; kind: string; keyField?: string },
): Record<string, unknown> {
  const { i } = findByKey(arr, value, opts);
  const removed = asRecord(arr.splice(i, 1)[0]);
  return removed;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerSessionDeleteTools(
  server: McpServer,
  client: ApiClient,
  token: string,
): void {
  // -------------------------------------------------------------------------
  // delete_place
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "delete_place",
    "Remove a place from the session. Warning: this does not unlink NPCs/encounters/items that referenced it -- they will appear unlinked.",
    {
      session_id: z.number().describe("Session ID"),
      place_name: z.string().describe("Exact name of the place"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, place_name, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const removed = deleteFromArray(data.places as unknown[] || [], place_name as string, {
          day: day as number | undefined,
          time: time as string | undefined,
          kind: "place",
        });
        return text(
          `Deleted place "${removed.name}" (day ${removed.day} ${removed.time}).`,
        );
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // delete_npc
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "delete_npc",
    "Remove an NPC from the session.",
    {
      session_id: z.number().describe("Session ID"),
      npc_name: z.string().describe("Exact name of the NPC"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, npc_name, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const removed = deleteFromArray(data.npcs as unknown[] || [], npc_name as string, {
          day: day as number | undefined,
          time: time as string | undefined,
          kind: "NPC",
        });
        return text(`Deleted NPC "${removed.name}".`);
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // delete_encounter
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "delete_encounter",
    "Remove an encounter from the session.",
    {
      session_id: z.number().describe("Session ID"),
      encounter_name: z.string().describe("Exact name of the encounter"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, encounter_name, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const removed = deleteFromArray(
          data.encounters as unknown[] || [],
          encounter_name as string,
          {
            day: day as number | undefined,
            time: time as string | undefined,
            kind: "encounter",
          },
        );
        return text(`Deleted encounter "${removed.name}".`);
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // delete_item
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "delete_item",
    "Remove an item from the session.",
    {
      session_id: z.number().describe("Session ID"),
      item_name: z.string().describe("Exact name of the item"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, item_name, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const removed = deleteFromArray(data.items as unknown[] || [], item_name as string, {
          day: day as number | undefined,
          time: time as string | undefined,
          kind: "item",
        });
        return text(`Deleted item "${removed.name}".`);
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // delete_readaloud
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "delete_readaloud",
    "Remove a read-aloud text from the session.",
    {
      session_id: z.number().describe("Session ID"),
      title: z.string().describe("Exact title of the read-aloud"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, title, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const removed = deleteFromArray(
          data.readAloud as unknown[] || [],
          title as string,
          {
            day: day as number | undefined,
            time: time as string | undefined,
            kind: "read-aloud",
            keyField: "title",
          },
        );
        return text(`Deleted read-aloud "${removed.title}".`);
      });
    },
    { role: "dm" },
  );
}
