import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as campaignsApi from "../api/campaigns.js";
import { withSession, findByKey, appendNote, text, textError, asArray } from "./helpers.js";
import { str } from "./session/format.js";
import { pickCharacter } from "./session/pick-character.js";
import {
  dayOpt,
  timeOpt,
  placePatch,
  npcPatch,
  encounterPatch,
  itemPatch,
  readAloudPatch,
  equipmentPatch,
  ENCOUNTER_STATUSES,
  ENEMY_STATUSES,
} from "./session/schemas.js";
import { invalidBonusMessage, parseBonusStrings } from "./equipment-input.js";
import { safeTool } from "./safe-tool.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * M4: replacing the enemy list kept only what the model sent, so maxHp fell to
 * the current hp and the DM's notes on each enemy were lost. An enemy with the
 * same name as an existing one keeps that one's maxHp and notes unless they are
 * given; each existing enemy is matched once (two "Goblin"s stay two).
 */
export function mergeEnemies(
  existing: Record<string, unknown>[],
  incoming: Record<string, unknown>[],
): Record<string, unknown>[] {
  const unused = [...existing];
  return incoming.map((e) => {
    const i = unused.findIndex((old) => old.name === e.name);
    const old = i >= 0 ? unused.splice(i, 1)[0] : undefined;
    const hp = Number(e.hp) || 0;
    return {
      ...e,
      disposition: (e.disposition as string) || (old?.disposition as string) || "enemy",
      hp,
      maxHp: e.maxHp !== undefined ? Number(e.maxHp) || 0 : old ? Number(old.maxHp) || hp : hp,
      notes: e.notes !== undefined ? String(e.notes) : old ? String(old.notes ?? "") : "",
      status: e.status !== undefined ? String(e.status) : old ? String(old.status ?? "fighting") : "fighting",
    };
  });
}

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
      session_id: z.number().int().positive().describe("Session ID"),
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
      session_id: z.number().int().positive().describe("Session ID"),
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
      session_id: z.number().int().positive().describe("Session ID"),
      encounter_name: z.string().describe("Exact name of the encounter"),
      status: z.enum(ENCOUNTER_STATUSES).describe("New status"),
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
    "Mark a story item as found (sets found=true). If a character took it, set given_to to their character name: the item is handed to that character (it goes on their character sheet and is taken from anyone who had it). Fails, and changes nothing, if no character in the campaign has that name.",
    {
      session_id: z.number().int().positive().describe("Session ID"),
      item_name: z.string().describe("Exact name of the item"),
      day: dayOpt,
      time: timeOpt,
      given_to: z
        .string()
        .optional()
        .describe("Character name who received this item (omit, or leave empty, if no one took it yet)"),
      notes: z
        .string()
        .optional()
        .describe("Optional note appended to the item's notes"),
    },
    async ({ session_id, item_name, day, time, given_to, notes }) => {
      return withSession(client, token, session_id as number, async (data, session) => {
        const { x } = findByKey(data.items as unknown[], item_name as string, {
          day: day as number | undefined,
          time: time as string | undefined,
          kind: "item",
        });
        const wanted = typeof given_to === "string" ? given_to.trim() : "";
        let givenTo = "";
        if (wanted) {
          // Hand it over the way the play view does: the character gets it,
          // anyone else who held it loses it. Only then does the session card
          // say who has it, so the card never claims a hand-over that failed.
          const campaignId = Number(session.campaignId);
          const characters = asArray(await campaignsApi.listCampaignCharacters(client, token, campaignId))
            .map((c) => ({ id: Number(c.id), name: str(c.name) }))
            .filter((c) => Number.isInteger(c.id) && c.id > 0 && c.name);
          const picked = pickCharacter(characters, wanted);
          if (!picked.ok) return textError(picked.message);
          await campaignsApi.characterControl(client, token, campaignId, {
            action: "giveItem",
            characterId: picked.character.id,
            move: true,
            item: {
              name: str(x.name),
              description: str(x.description),
              sessionName: session.sessionNumber ? `Session ${str(session.sessionNumber)}` : "",
              stashId: typeof x.stashId === "number" ? x.stashId : undefined,
            },
          });
          givenTo = picked.character.name;
          x.givenTo = [givenTo];
        }
        x.found = true;
        appendNote(x, notes as string);
        return text(
          `Item "${x.name}" marked as found.${givenTo ? ` Given to ${givenTo}: it is on their character sheet now, and no one else holds it.` : ""}${notes ? " Note appended." : ""}`,
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
      session_id: z.number().int().positive().describe("Session ID"),
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
      session_id: z.number().int().positive().describe("Session ID"),
      encounter_name: z
        .string()
        .describe("Exact name of the encounter containing the enemy"),
      enemy_name: z.string().describe("Exact name of the enemy"),
      hp: z.number().int().min(0).describe("New current HP"),
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
        const newHp = hp;
        if (!Number(enemy.maxHp)) enemy.maxHp = Number(enemy.hp) || newHp;
        enemy.hp = newHp;
        return text(`${enemy.name} HP: ${newHp}/${enemy.maxHp ?? "?"}`);
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // set_enemy_status (#71)
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "set_enemy_status",
    "Set whether an enemy is still in the fight: fighting, fled, surrendered or captured. HP is kept; an enemy at 0 HP counts as defeated.",
    {
      session_id: z.number().int().positive().describe("Session ID"),
      encounter_name: z.string().describe("Exact name of the encounter containing the enemy"),
      enemy_name: z.string().describe("Exact name of the enemy"),
      status: z.enum(ENEMY_STATUSES).describe("The enemy's state"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, encounter_name, enemy_name, status, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const { x: enc } = findByKey(data.encounters as unknown[], encounter_name as string, {
          day: day as number | undefined,
          time: time as string | undefined,
          kind: "encounter",
        });
        const enemies = (enc.enemies || []) as Array<Record<string, unknown>>;
        const matches = enemies.filter((e) => e.name === enemy_name);
        if (matches.length === 0) {
          const avail = enemies.map((e) => e.name).join(", ");
          throw new Error(`Enemy "${enemy_name}" not found in encounter "${enc.name}". Available: ${avail || "(none)"}.`);
        }
        if (matches.length > 1) {
          throw new Error(`Multiple enemies named "${enemy_name}" in encounter "${enc.name}". Rename one to disambiguate.`);
        }
        matches[0].status = status;
        return text(`${matches[0].name}: ${status}.`);
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
      session_id: z.number().int().positive().describe("Session ID"),
      encounter_name: z
        .string()
        .describe("Exact name of the encounter containing the enemy"),
      enemy_name: z.string().describe("Exact name of the enemy"),
      damage: z.number().int().min(1).describe("Damage amount (subtracted from current HP). To heal, use update_enemy_hp."),
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
        if (!Number(enemy.maxHp)) enemy.maxHp = cur;
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
      session_id: z.number().int().positive().describe("Session ID"),
      place_name: z.string().describe("Exact name of the place"),
      fields: placePatch.describe("Fields to change (only these; unknown fields are rejected)"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, place_name, fields, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const f: Record<string, unknown> = fields;
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
      session_id: z.number().int().positive().describe("Session ID"),
      npc_name: z.string().describe("Exact name of the NPC"),
      fields: npcPatch.describe("Fields to change (only these; unknown fields are rejected)"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, npc_name, fields, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const f: Record<string, unknown> = fields;
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
      session_id: z.number().int().positive().describe("Session ID"),
      encounter_name: z.string().describe("Exact name of the encounter"),
      fields: encounterPatch.describe("Fields to change (only these; unknown fields are rejected)"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, encounter_name, fields, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const f: Record<string, unknown> = fields;
        const { x } = findByKey(
          data.encounters as unknown[],
          encounter_name as string,
          {
            day: day as number | undefined,
            time: time as string | undefined,
            kind: "encounter",
          },
        );
        if (Array.isArray(f.enemies)) {
          f.enemies = mergeEnemies((x.enemies ?? []) as Record<string, unknown>[], f.enemies as Record<string, unknown>[]);
        }
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
      session_id: z.number().int().positive().describe("Session ID"),
      item_name: z.string().describe("Exact name of the item"),
      fields: itemPatch.describe("Fields to change (only these; unknown fields are rejected)"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, item_name, fields, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const f: Record<string, unknown> = fields;
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
      session_id: z.number().int().positive().describe("Session ID"),
      title: z.string().describe("Exact title of the read-aloud"),
      fields: readAloudPatch.describe("Fields to change (only these; unknown fields are rejected)"),
      day: dayOpt,
      time: timeOpt,
    },
    async ({ session_id, title, fields, day, time }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const f: Record<string, unknown> = fields;
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
      session_id: z.number().int().positive().describe("Session ID"),
      equipment_name: z.string().describe("Exact name of the equipment"),
      fields: equipmentPatch.describe("Fields to change (only these; unknown fields are rejected)"),
    },
    async ({ session_id, equipment_name, fields }) => {
      return withSession(client, token, session_id as number, async (data) => {
        const f: Record<string, unknown> = fields;
        if (fields.bonuses) {
          const { bonuses, invalid } = parseBonusStrings(fields.bonuses);
          if (invalid.length) return textError(invalidBonusMessage(invalid));
          f.bonuses = bonuses;
        }
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
