import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as campaignsApi from "../api/campaigns.js";
import { safeTool } from "./safe-tool.js";
import { text, asRecord, asArray } from "./helpers.js";

export function registerPlayerManagementTools(
  server: McpServer,
  client: ApiClient,
  token: string,
): void {
  safeTool(
    server,
    "list_players",
    "List all players in a campaign with their roles",
    { campaign_id: z.number().int().positive().describe("Campaign ID") },
    async ({ campaign_id }) => {
      const players = asArray(await campaignsApi.listPlayers(
        client,
        token,
        campaign_id as number,
      ));

      if (!players || players.length === 0) {
        return text("No players in this campaign.");
      }

      let output = `# Campaign Players (${players.length})\n\n`;
      for (const p of players) {
        output += `**${p.name || p.username || "Unknown"}**`;
        if (p.id || p.userId) output += ` (ID: ${p.id || p.userId})`;
        if (p.role) output += ` -- ${p.role}`;
        if (p.joinedAt) output += ` | Joined: ${p.joinedAt}`;
        output += "\n";
      }

      return text(output.trim());
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "kick_player",
    "Remove a player from a campaign (DM only). The player is excluded: the share code no longer lets them back in until the DM lifts it in the app.",
    {
      campaign_id: z.number().int().positive().describe("Campaign ID"),
      // A user id is a UUID. Anything else (e.g. "../../9" from a prompt
      // injection) would otherwise become another API path (M10).
      player_id: z.string().uuid().describe("Player ID to remove (the user id from list_players)"),
    },
    async ({ campaign_id, player_id }) => {
      const result = asRecord(await campaignsApi.kickPlayer(
        client,
        token,
        campaign_id as number,
        player_id as string,
      ));

      return text(
        (result.message as string) ||
          `Removed player ${player_id} from campaign ${campaign_id}. They are excluded until the DM lifts it in the app.`,
      );
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "leave_campaign",
    "Leave a campaign you are a player in",
    { campaign_id: z.number().int().positive().describe("Campaign ID") },
    async ({ campaign_id }) => {
      const result = asRecord(await campaignsApi.leaveCampaign(
        client,
        token,
        campaign_id as number,
      ));

      return text(
        (result.message as string) || `Left campaign ${campaign_id}.`,
      );
    },
    { role: "player" },
  );
}
