import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import { withSession, findByKey, appendNote, text } from "./helpers.js";
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
// Helpers
// ---------------------------------------------------------------------------

function rejectKeyRename(fields: Record<string, unknown>, keyField: string): void {
  if (fields && Object.prototype.hasOwnProperty.call(fields, keyField)) {
    throw new Error(
      `Cannot rename ${keyField} via update_*. Delete the record and re-import with the new ${keyField}.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerSessionStateTools(
  server: McpServer,
  client: ApiClient,
  token: string,
): void {
  // =========================================================================
  // Marking tools (5)
  // =========================================================================

  // -------------------------------------------------------------------------
  // mark_place_visited
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "mark_place_visited",
    "Mark a place as visited (sets visited=true). Call this when the party arrives at the location during play. Optionally append a note about what happened there.",
    {
      session_id: z.number().describe("Session ID"),
      place_name: z.string().describe("Exact name of the place"),
      day: dayOpt,
      time: timeOpt,
      notes: z.string().optional().describe("Optional note appended to the place's notes field"),
    },
    async ({ session_id, place_name, day, time, notes }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const { x } = findByKey(data.places as unknown[], place_name as string, {
          day: day as number | undefined,
          time: time as string | undefined,
          kind: "place",
        });
        x.visited = true;
        appendNote(x, notes as string);
        return text(
          `Marked place "${x.name}" (day ${x.day} ${x.time}) as visited.${notes ? " Note appended." : ""}`,
        );
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // mark_npc_met
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "mark_npc_met",
    'Mark an NPC as met/used (sets status="used"). Call this when the party encounters the NPC. Optionally record where they actually appeared (if different from plannedLocation) and a note about the interaction.',
    {
      session_id: z.number().describe("Session ID"),
      npc_name: z.string().describe("Exact name of the NPC"),
      day: dayOpt,
      time: timeOpt,
      actual_location: z
        .string()
        .optional()
        .describe("Where the NPC actually appeared (if different from plannedLocation)"),
      notes: z.string().optional().describe("Optional note about the interaction"),
    },
    async ({ session_id, npc_name, day, time, actual_location, notes }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const { x } = findByKey(data.npcs as unknown[], npc_name as string, {
          day: day as number | undefined,
          time: time as string | undefined,
          kind: "NPC",
        });
        x.status = "used";
        if (actual_location !== undefined) x.actualLocation = actual_location;
        appendNote(x, notes as string);
        return text(
          `Marked NPC "${x.name}" (day ${x.day} ${x.time}) as met.${actual_location ? ` Actual location: ${actual_location}.` : ""}${notes ? " Note appended." : ""}`,
        );
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // set_encounter_status
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "set_encounter_status",
    'Set an encounter\'s status. Use "started" when combat begins, "completed" when it resolves. Status values: planned (default before play), started (in progress), completed (resolved).',
    {
      session_id: z.number().describe("Session ID"),
      encounter_name: z.string().describe("Exact name of the encounter"),
      status: z.enum(["planned", "started", "completed"]).describe("New status"),
      day: dayOpt,
      time: timeOpt,
      notes: z
        .string()
        .optional()
        .describe("Optional note appended to the encounter's notes"),
    },
    async ({ session_id, encounter_name, status, day, time, notes }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const { x } = findByKey(data.encounters as unknown[], encounter_name as string, {
          day: day as number | undefined,
          time: time as string | undefined,
          kind: "encounter",
        });
        x.status = status;
        appendNote(x, notes as string);
        return text(
          `Encounter "${x.name}" (day ${x.day} ${x.time}) status -> ${status}.`,
        );
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // mark_item_found
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "mark_item_found",
    "Mark a story item as found (sets found=true). If given to a specific player, set given_to to their character name (this makes the item appear in that player's quest items).",
    {
      session_id: z.number().describe("Session ID"),
      item_name: z.string().describe("Exact name of the item"),
      day: dayOpt,
      time: timeOpt,
      given_to: z
        .string()
        .optional()
        .describe("Character name who received this item (omit if no one took it yet)"),
      notes: z
        .string()
        .optional()
        .describe("Optional note appended to the item's notes"),
    },
    async ({ session_id, item_name, day, time, given_to, notes }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const { x } = findByKey(data.items as unknown[], item_name as string, {
          day: day as number | undefined,
          time: time as string | undefined,
          kind: "item",
        });
        x.found = true;
        if (given_to !== undefined) x.givenTo = given_to;
        appendNote(x, notes as string);
        return text(
          `Item "${x.name}" marked as found.${given_to ? ` Given to ${given_to}.` : ""}${notes ? " Note appended." : ""}`,
        );
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // mark_readaloud_read
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "mark_readaloud_read",
    "Mark a read-aloud text as already read (sets read=true). Use after reading the passage to the players.",
    {
      session_id: z.number().describe("Session ID"),
      title: z.string().describe("Exact title of the read-aloud"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, title, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const { x } = findByKey(data.readAloud as unknown[], title as string, {
          day: day as number | undefined,
          time: time as string | undefined,
          kind: "read-aloud",
          keyField: "title",
        });
        x.read = true;
        return text(`Read-aloud "${x.title}" marked as read.`);
      });
    },
    { role: "dm" },
  );

  // =========================================================================
  // Combat tools (2)
  // =========================================================================

  // -------------------------------------------------------------------------
  // update_enemy_hp
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "update_enemy_hp",
    "Set a specific enemy's current HP inside an encounter. Use this when an enemy takes damage or is healed.",
    {
      session_id: z.number().describe("Session ID"),
      encounter_name: z
        .string()
        .describe("Exact name of the encounter containing the enemy"),
      enemy_name: z.string().describe("Exact name of the enemy"),
      hp: z.union([z.number(), z.string()]).describe("New HP value (string or number)"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, encounter_name, enemy_name, hp, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const { x: enc } = findByKey(
          data.encounters as unknown[],
          encounter_name as string,
          {
            day: day as number | undefined,
            time: time as string | undefined,
            kind: "encounter",
          },
        );
        const enemies = (enc.enemies || []) as Array<Record<string, unknown>>;
        const matches = enemies.filter((e) => e.name === enemy_name);
        if (matches.length === 0) {
          const avail = enemies.map((e) => e.name).join(", ");
          throw new Error(
            `Enemy "${enemy_name}" not found in encounter "${enc.name}". Available: ${avail || "(none)"}.`,
          );
        }
        if (matches.length > 1) {
          throw new Error(
            `Multiple enemies named "${enemy_name}" in encounter "${enc.name}". Rename one to disambiguate.`,
          );
        }
        const enemy = matches[0];
        const newHp = Number(hp);
        if (enemy.maxHp == null || enemy.maxHp === "") enemy.maxHp = Number(enemy.hp) || newHp;
        enemy.hp = newHp;
        return text(`${enemy.name} HP: ${newHp}/${enemy.maxHp ?? "?"}`);
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // damage_enemy
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "damage_enemy",
    "Apply damage to a specific enemy (subtracts from current HP). Use this in combat when the party hits an enemy.",
    {
      session_id: z.number().describe("Session ID"),
      encounter_name: z
        .string()
        .describe("Exact name of the encounter containing the enemy"),
      enemy_name: z.string().describe("Exact name of the enemy"),
      damage: z.number().int().describe("Damage amount (subtracted from current HP)"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, encounter_name, enemy_name, damage, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const { x: enc } = findByKey(
          data.encounters as unknown[],
          encounter_name as string,
          {
            day: day as number | undefined,
            time: time as string | undefined,
            kind: "encounter",
          },
        );
        const enemies = (enc.enemies || []) as Array<Record<string, unknown>>;
        const matches = enemies.filter((e) => e.name === enemy_name);
        if (matches.length === 0) {
          const avail = enemies.map((e) => e.name).join(", ");
          throw new Error(
            `Enemy "${enemy_name}" not found in encounter "${enc.name}". Available: ${avail || "(none)"}.`,
          );
        }
        if (matches.length > 1) {
          throw new Error(
            `Multiple enemies named "${enemy_name}" in encounter "${enc.name}". Rename one to disambiguate.`,
          );
        }
        const enemy = matches[0];
        const cur = Number(enemy.hp) || 0;
        const newHp = Math.max(0, cur - (damage as number));
        if (enemy.maxHp == null || enemy.maxHp === "") enemy.maxHp = Number(enemy.hp) || cur;
        enemy.hp = newHp;
        const note = newHp === 0 ? " -- defeated." : "";
        return text(
          `${enemy.name} takes ${damage} damage. HP: ${cur} -> ${newHp}/${enemy.maxHp}${note}`,
        );
      });
    },
    { role: "dm" },
  );

  // =========================================================================
  // Patch tools (6)
  // =========================================================================

  // -------------------------------------------------------------------------
  // update_place
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "update_place",
    "Patch fields on an existing place. Cannot change name (delete + reimport instead). Common fields: description, notes.",
    {
      session_id: z.number().describe("Session ID"),
      place_name: z.string().describe("Exact name of the place"),
      fields: z
        .record(z.string(), z.unknown())
        .describe("Fields to merge into the place (e.g. {description, notes, day, time})"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, place_name, fields, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const f = fields as Record<string, unknown>;
        rejectKeyRename(f, "name");
        const { x } = findByKey(data.places as unknown[], place_name as string, {
          day: day as number | undefined,
          time: time as string | undefined,
          kind: "place",
        });
        Object.assign(x, f);
        return text(
          `Updated place "${x.name}". Fields: ${Object.keys(f).join(", ")}`,
        );
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // update_npc
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "update_npc",
    "Patch fields on an existing NPC. Cannot change name. Common fields: role, description, disposition, plannedLocation, actualLocation, notes.",
    {
      session_id: z.number().describe("Session ID"),
      npc_name: z.string().describe("Exact name of the NPC"),
      fields: z
        .record(z.string(), z.unknown())
        .describe("Fields to merge into the NPC"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, npc_name, fields, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const f = fields as Record<string, unknown>;
        rejectKeyRename(f, "name");
        const { x } = findByKey(data.npcs as unknown[], npc_name as string, {
          day: day as number | undefined,
          time: time as string | undefined,
          kind: "NPC",
        });
        Object.assign(x, f);
        return text(
          `Updated NPC "${x.name}". Fields: ${Object.keys(f).join(", ")}`,
        );
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // update_encounter
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "update_encounter",
    "Patch fields on an existing encounter. Cannot change name. Common fields: tactics, loot, location, notes. To edit enemies use update_enemy_hp / damage_enemy or replace with delete + reimport.",
    {
      session_id: z.number().describe("Session ID"),
      encounter_name: z.string().describe("Exact name of the encounter"),
      fields: z
        .record(z.string(), z.unknown())
        .describe("Fields to merge into the encounter"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, encounter_name, fields, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const f = fields as Record<string, unknown>;
        rejectKeyRename(f, "name");
        const { x } = findByKey(
          data.encounters as unknown[],
          encounter_name as string,
          {
            day: day as number | undefined,
            time: time as string | undefined,
            kind: "encounter",
          },
        );
        Object.assign(x, f);
        return text(
          `Updated encounter "${x.name}". Fields: ${Object.keys(f).join(", ")}`,
        );
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // update_item
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "update_item",
    "Patch fields on an existing item. Cannot change name. Common fields: description, plannedLocation, actualLocation, givenTo, notes.",
    {
      session_id: z.number().describe("Session ID"),
      item_name: z.string().describe("Exact name of the item"),
      fields: z
        .record(z.string(), z.unknown())
        .describe("Fields to merge into the item"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, item_name, fields, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const f = fields as Record<string, unknown>;
        rejectKeyRename(f, "name");
        const { x } = findByKey(data.items as unknown[], item_name as string, {
          day: day as number | undefined,
          time: time as string | undefined,
          kind: "item",
        });
        Object.assign(x, f);
        return text(
          `Updated item "${x.name}". Fields: ${Object.keys(f).join(", ")}`,
        );
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // update_readaloud
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "update_readaloud",
    "Patch fields on an existing read-aloud. Cannot change title. Common fields: text, linkedType, linkedTo.",
    {
      session_id: z.number().describe("Session ID"),
      title: z.string().describe("Exact title of the read-aloud"),
      fields: z
        .record(z.string(), z.unknown())
        .describe("Fields to merge into the read-aloud"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, title, fields, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const f = fields as Record<string, unknown>;
        rejectKeyRename(f, "title");
        const { x } = findByKey(data.readAloud as unknown[], title as string, {
          day: day as number | undefined,
          time: time as string | undefined,
          kind: "read-aloud",
          keyField: "title",
        });
        Object.assign(x, f);
        return text(
          `Updated read-aloud "${x.title}". Fields: ${Object.keys(f).join(", ")}`,
        );
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // update_equipment_item
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "update_equipment_item",
    "Patch fields on an existing equipment item. Cannot change name. Common fields: description, specialEffect, bonuses, givenTo.",
    {
      session_id: z.number().describe("Session ID"),
      equipment_name: z.string().describe("Exact name of the equipment"),
      fields: z
        .record(z.string(), z.unknown())
        .describe("Fields to merge into the equipment item"),
    },
    async ({ session_id, equipment_name, fields }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const f = fields as Record<string, unknown>;
        rejectKeyRename(f, "name");
        const { x } = findByKey(data.equipment as unknown[], equipment_name as string, {
          kind: "equipment",
        });
        Object.assign(x, f);
        return text(
          `Updated equipment "${x.name}". Fields: ${Object.keys(f).join(", ")}`,
        );
      });
    },
    { role: "dm" },
  );
}
