import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api/client.js";
import * as campaignsApi from "../../api/campaigns.js";
import * as charactersApi from "../../api/characters.js";
import { safeTool } from "../safe-tool.js";
import { asArray, asRecord, text } from "../helpers.js";
import { renderCharacterSheet } from "./sheet.js";

const GM_SETUP_POINTER =
  "To run a session for one of these characters, FIRST call get_campaign_state(campaign_id) for that character's campaign. It carries the mandatory GM setup you must complete before you narrate anything (ask the player's play mode, ask what to load, never invent content). Do not start the story before that.";

export function registerCharacterReadTools(server: McpServer, client: ApiClient, token: string): void {
  safeTool(
    server,
    "create_my_character",
    "Create a new character with a name. Returns the new character ID.",
    {
      name: z.string().min(1).max(100).describe("Character name"),
      campaign_id: z.number().int().positive().optional().describe("Campaign ID to assign the character to"),
    },
    async ({ name, campaign_id }) => {
      const result = asRecord(await charactersApi.createCharacter(client, token, name, campaign_id));
      return text(`Character created! ID: ${result.id}, Name: "${name}"`);
    },
    { role: "player" },
  );

  safeTool(
    server,
    "list_my_characters",
    "List your own characters with ID, name, race, class, and campaign info",
    {},
    async () => {
      const chars = asArray(await charactersApi.listCharacters(client, token));
      if (!chars.length) return text("You have no characters yet.");

      const lines = [`# Your Characters (${chars.length})`, ""];
      for (const c of chars) {
        const d = (c.data ?? {}) as Record<string, unknown>;
        let line = `**${c.name || "Unnamed"}** (ID: ${c.id})`;
        if (d.race) line += ` -- ${d.race} ${d.class || ""}`;
        if (d.religion) line += ` (${d.religion})`;
        const campaign = c.campaign as Record<string, unknown> | undefined;
        if (campaign) line += ` | Campaign: ${campaign.name} (campaign_id: ${campaign.id})`;
        else if (c.campaignId) line += ` | campaign_id: ${c.campaignId}`;
        line += ` | XP: ${c.xp || 0}`;
        lines.push(line);
      }
      lines.push("", "---", GM_SETUP_POINTER);
      return text(lines.join("\n"));
    },
    { role: "player" },
  );

  safeTool(
    server,
    "get_my_character",
    "Get a character's full sheet: stats, equipment, abilities, relationships, quest items, lock status.",
    { character_id: z.number().int().positive().describe("Character ID") },
    async ({ character_id }) => {
      const char = asRecord(await charactersApi.getCharacter(client, token, character_id));
      return text(
        `${renderCharacterSheet(char)}\n\n---\nBEFORE YOU NARRATE: if you are running a session for this player, first call get_campaign_state for this character's campaign (the GM setup: ask the player's play mode) and then get_table for the current session. Look up gear, spells and rules when they come up (get_game_data, get_rules(section)); never guess spell costs, weapon stats or combat mechanics.`,
      );
    },
    { role: "player" },
  );

  safeTool(
    server,
    "get_party",
    "List the characters in a campaign with HP and XP (works for the DM and for players in the campaign)",
    { campaign_id: z.number().int().positive().describe("Campaign ID") },
    async ({ campaign_id }) => {
      let chars: Record<string, unknown>[];
      try {
        chars = asArray(await campaignsApi.listCampaignCharacters(client, token, campaign_id));
      } catch (err) {
        // Not the DM: a player sees the party through the player view (names,
        // race and class only; other players' HP/XP are the DM's business).
        if (!(err instanceof Error && err.message.startsWith("API 404"))) throw err;
        const view = asRecord(await campaignsApi.getPlayerView(client, token, campaign_id));
        const party = asArray(view.party ?? []);
        if (!party.length) return text("No characters in this campaign.");
        return text(
          [`# Party (${party.length} members)`, "", ...party.map((p) => `**${p.name}** -- ${p.race || "?"} ${p.class || "?"}`)].join("\n"),
        );
      }
      if (!chars.length) return text("No characters in this campaign.");

      const lines = [`# Party (${chars.length} members)`, ""];
      for (const c of chars) {
        const d = (c.data ?? {}) as Record<string, unknown>;
        let line = `**${c.name || "Unnamed"}** (ID: ${c.id})`;
        if (d.race) line += ` -- ${d.race} ${d.class || ""}`;
        line += ` | HP: ${d.hp ?? "?"}/${d.maxHp ?? "?"} | XP: ${c.xp || 0}`;
        lines.push(line);
      }
      return text(lines.join("\n"));
    },
    { role: "player" },
  );

  safeTool(
    server,
    "join_campaign",
    "Join a campaign using a share code",
    { share_code: z.string().min(1).describe("Campaign share code") },
    async ({ share_code }) => {
      const result = asRecord(await campaignsApi.joinCampaign(client, token, share_code));
      return text(
        result.campaignName
          ? `Joined campaign: ${result.campaignName} (campaign_id: ${result.campaignId})`
          : "Joined campaign successfully.",
      );
    },
    { role: "player" },
  );
}
