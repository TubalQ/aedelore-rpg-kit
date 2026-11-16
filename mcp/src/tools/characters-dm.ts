import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as campaignsApi from "../api/campaigns.js";
import * as charactersApi from "../api/characters.js";
import { getGameData } from "../game-data/loader.js";
import { safeTool } from "./safe-tool.js";
import { buildEquipment, equipmentToolShape, invalidBonusMessage } from "./equipment-input.js";
import { text, textError, asRecord, asArray } from "./helpers.js";
import { renderCharacterSheet } from "./characters/sheet.js";

export function registerDmCharacterTools(
  server: McpServer,
  client: ApiClient,
  token: string,
): void {
  safeTool(
    server,
    "list_campaign_characters",
    "List all player characters in a campaign with XP and lock status",
    { campaign_id: z.number().int().positive().describe("Campaign ID") },
    async ({ campaign_id }) => {
      const chars = asArray(await campaignsApi.listCampaignCharacters(
        client,
        token,
        campaign_id as number,
      ));

      if (!chars.length) return text("No characters in this campaign.");

      let output = `# Campaign Characters (${chars.length})\n\n`;
      for (const c of chars) {
        const d = asRecord(c.data ?? {});
        output += `**${c.name || "Unnamed"}** (ID: ${c.id})`;
        if (d.race) output += ` -- ${d.race} ${d.class || ""}`;
        if (d.religion) output += ` (${d.religion})`;
        output += `\n  XP: ${c.xp || 0}`;
        output += ` | Locks: race/class=${c.raceClassLocked ? "LOCKED" : "open"}, attributes=${c.attributesLocked ? "LOCKED" : "open"}, abilities=${c.abilitiesLocked ? "LOCKED" : "open"}`;
        output += "\n\n";
      }
      return text(output.trim());
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "get_character_build",
    "Get a character's full sheet (stats, equipment, abilities, relationships, quest items, DM equipment).",
    { character_id: z.number().int().positive().describe("Character ID") },
    async ({ character_id }) => {
      const char = asRecord(await charactersApi.getCharacter(
        client,
        token,
        character_id as number,
      ));
      return text(renderCharacterSheet(char));
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "give_xp",
    "Award XP to a character",
    {
      campaign_id: z.number().int().positive().describe("Campaign ID"),
      character_id: z.number().int().positive().describe("Character ID"),
      amount: z.number().int().min(1).max(10000).describe("XP amount (1-10000)"),
    },
    async ({ campaign_id, character_id, amount }) => {
      const result = asRecord(await campaignsApi.characterControl(
        client,
        token,
        campaign_id as number,
        { action: "giveXp", characterId: character_id, amount },
      ));
      return text(
        (result.message as string) || `Gave ${amount} XP to character ${character_id}.`,
      );
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "give_item",
    "Give a quest item to a character",
    {
      campaign_id: z.number().int().positive().describe("Campaign ID"),
      character_id: z.number().int().positive().describe("Character ID"),
      name: z.string().describe("Item name"),
      description: z.string().optional().describe("Item description"),
    },
    async ({ campaign_id, character_id, name, description }) => {
      // DmGiveItemSchema (QuestItemSchema) kräver description (icke-valfri) → default till "".
      const item: Record<string, unknown> = { name, description: description ?? "" };
      const result = asRecord(await campaignsApi.characterControl(
        client,
        token,
        campaign_id as number,
        { action: "giveItem", characterId: character_id, item },
      ));
      return text(
        (result.message as string) || `Gave item "${name}" to character ${character_id}.`,
      );
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "remove_item",
    "Remove a quest item from a character",
    {
      campaign_id: z.number().int().positive().describe("Campaign ID"),
      character_id: z.number().int().positive().describe("Character ID"),
      name: z.string().describe("Item name to remove"),
    },
    async ({ campaign_id, character_id, name }) => {
      const result = asRecord(await campaignsApi.characterControl(
        client,
        token,
        campaign_id as number,
        { action: "removeItem", characterId: character_id, itemName: name },
      ));
      return text(
        (result.message as string) ||
          `Removed item "${name}" from character ${character_id}.`,
      );
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "give_equipment",
    "Give DM special equipment (weapon, armor, shield or misc) straight to a character. Supports rarity, stat bonuses and special effects. To prepare items for later hand-out, use add_box_equipment.",
    {
      campaign_id: z.number().int().positive().describe("Campaign ID"),
      character_id: z.number().int().positive().describe("Character ID"),
      ...equipmentToolShape,
    },
    async ({ campaign_id, character_id, ...args }) => {
      const built = buildEquipment(args);
      if (!built.ok) return textError(invalidBonusMessage(built.invalidBonuses));
      const result = asRecord(
        await campaignsApi.characterControl(client, token, campaign_id, {
          action: "giveEquipment",
          characterId: character_id,
          equipment: built.equipment,
        }),
      );
      return text(
        (result.message as string) ||
          `Gave ${args.rarity || "common"} ${args.type} "${args.name}" to character ${character_id}.`,
      );
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "remove_equipment",
    "Remove DM Special Equipment from a character by name",
    {
      campaign_id: z.number().int().positive().describe("Campaign ID"),
      character_id: z.number().int().positive().describe("Character ID"),
      name: z.string().describe("Equipment name to remove"),
    },
    async ({ campaign_id, character_id, name }) => {
      const result = asRecord(await campaignsApi.characterControl(
        client,
        token,
        campaign_id as number,
        { action: "removeEquipment", characterId: character_id, equipmentName: name },
      ));
      return text(
        (result.message as string) ||
          `Removed equipment "${name}" from character ${character_id}.`,
      );
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "set_character_locks",
    "Lock or unlock character sheet sections",
    {
      campaign_id: z.number().int().positive().describe("Campaign ID"),
      character_id: z.number().int().positive().describe("Character ID"),
      race_class_locked: z.boolean().optional().describe("Lock race/class section"),
      attributes_locked: z.boolean().optional().describe("Lock attributes section"),
      abilities_locked: z.boolean().optional().describe("Lock abilities section"),
    },
    async ({
      campaign_id,
      character_id,
      race_class_locked,
      attributes_locked,
      abilities_locked,
    }) => {
      const locks: Record<string, unknown> = {};
      if (race_class_locked !== undefined) locks.raceClassLocked = race_class_locked;
      if (attributes_locked !== undefined) locks.attributesLocked = attributes_locked;
      if (abilities_locked !== undefined) locks.abilitiesLocked = abilities_locked;

      const result = asRecord(await campaignsApi.characterControl(
        client,
        token,
        campaign_id as number,
        { action: "setLocks", characterId: character_id, ...locks },
      ));

      const changes: string[] = [];
      if (race_class_locked !== undefined)
        changes.push(`race/class=${race_class_locked ? "LOCKED" : "unlocked"}`);
      if (attributes_locked !== undefined)
        changes.push(`attributes=${attributes_locked ? "LOCKED" : "unlocked"}`);
      if (abilities_locked !== undefined)
        changes.push(`abilities=${abilities_locked ? "LOCKED" : "unlocked"}`);

      return text(
        (result.message as string) ||
          `Character ${character_id} locks updated: ${changes.join(", ") || "(no changes)"}`,
      );
    },
    { role: "dm" },
  );
}
