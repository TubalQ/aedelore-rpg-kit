import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as campaignsApi from "../api/campaigns.js";
import { safeTool } from "./safe-tool.js";
import { buildEquipment, equipmentToolShape, invalidBonusMessage } from "./equipment-input.js";
import { asRecord, asArray, text, textError } from "./helpers.js";

export function registerCampaignTools(
  server: McpServer,
  client: ApiClient,
  token: string,
): void {
  // -----------------------------------------------------------------------
  // list_campaigns
  // -----------------------------------------------------------------------
  safeTool(
    server,
    "list_campaigns",
    "List all your campaigns with session counts",
    {},
    async () => {
      const campaigns = asArray(await campaignsApi.listCampaigns(client, token));

      if (!campaigns.length) {
        return { content: [{ type: "text", text: "No campaigns found." }] };
      }

      const lines = campaigns.map((c) => {
        const sessions = c.sessionCount ?? "?";
        const desc = c.description ? ` -- ${c.description}` : "";
        return `- [${c.id}] ${c.name} (${sessions} sessions)${desc}`;
      });

      return {
        content: [{ type: "text", text: `Campaigns:\n${lines.join("\n")}` }],
      };
    },
    { role: "dm" },
  );

  // -----------------------------------------------------------------------
  // get_campaign
  // -----------------------------------------------------------------------
  safeTool(
    server,
    "get_campaign",
    "Get campaign details with list of sessions",
    { campaign_id: z.number().int().positive().describe("Campaign ID") },
    async ({ campaign_id }) => {
      const campaign = asRecord(await campaignsApi.getCampaign(
        client,
        token,
        campaign_id as number,
      ));

      let text = `Campaign: ${campaign.name} [${campaign.id}]\n`;
      if (campaign.description) text += `Description: ${campaign.description}\n`;
      if (campaign.shareCode)
        text += `Share code: ${campaign.shareCode}\n`;

      // getCampaign returnerar ingen sessions-array - hämta dem separat.
      const sessions = asArray(
        await campaignsApi.listCampaignSessions(client, token, campaign_id as number),
      );
      if (sessions.length) {
        text += `\nSessions (${sessions.length}):\n`;
        for (const s of sessions) {
          const num = s.sessionNumber ?? "?";
          const date = s.date || "no date";
          const status = s.status || "draft";
          text += `  - #${num} (${date}) [${status}] id=${s.id}\n`;
        }
      } else {
        text += "\nNo sessions yet.\n";
      }

      return { content: [{ type: "text", text }] };
    },
    { role: "dm" },
  );

  // -----------------------------------------------------------------------
  // create_campaign
  // -----------------------------------------------------------------------
  safeTool(
    server,
    "create_campaign",
    "Create a new campaign",
    {
      name: z.string().min(1).max(100).describe("Campaign name"),
      description: z.string().optional().describe("Campaign description"),
    },
    async ({ name, description }) => {
      const result = asRecord(await campaignsApi.createCampaign(
        client,
        token,
        name as string,
        (description as string) || "",
      ));

      return {
        content: [
          {
            type: "text",
            text: `Campaign created: ${result.name} (campaign_id ${result.id})`,
          },
        ],
      };
    },
    { role: "dm" },
  );

  // -----------------------------------------------------------------------
  // update_campaign
  // -----------------------------------------------------------------------
  safeTool(
    server,
    "update_campaign",
    "Update a campaign's name or description",
    {
      campaign_id: z.number().int().positive().describe("Campaign ID"),
      name: z.string().min(1).max(100).optional().describe("New campaign name"),
      description: z.string().optional().describe("New campaign description"),
    },
    async ({ campaign_id, name, description }) => {
      const updates: Record<string, string> = {};
      if (name !== undefined) updates.name = name as string;
      if (description !== undefined) updates.description = description as string;

      if (Object.keys(updates).length === 0) {
        return {
          content: [{ type: "text", text: "Nothing to update -- provide name or description." }],
          isError: true,
        };
      }

      await campaignsApi.updateCampaign(
        client,
        token,
        campaign_id as number,
        updates,
      );

      return {
        content: [
          {
            type: "text",
            text: `Campaign ${campaign_id} updated: ${Object.keys(updates).join(", ")} changed.`,
          },
        ],
      };
    },
    { role: "dm" },
  );

  // -----------------------------------------------------------------------
  // generate_share_code
  // -----------------------------------------------------------------------
  safeTool(
    server,
    "generate_share_code",
    "Generate a share code for a campaign so players can join it",
    { campaign_id: z.number().int().positive().describe("Campaign ID") },
    async ({ campaign_id }) => {
      const result = asRecord(await campaignsApi.generateShareCode(
        client,
        token,
        campaign_id as number,
      ));

      const code = result.shareCode;
      if (code) {
        return {
          content: [
            {
              type: "text",
              text:
                `Share code: ${code}\n\n` +
                "Give this code to your players. They paste it into their character sheet " +
                "(or run join_campaign with it from a player MCP session) to link their " +
                "character to this campaign.",
            },
          ],
        };
      }

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
    { role: "dm" },
  );

  // -----------------------------------------------------------------------
  // revoke_share_code
  // -----------------------------------------------------------------------
  safeTool(
    server,
    "revoke_share_code",
    // L2: the app's revoke removes every player too (its own dialog says so).
    // The old text promised only that no new players could join.
    "Revoke the campaign's share code. This also removes EVERY player from the campaign and detaches their characters (the DM's own character stays). Only use it when the DM explicitly wants that; confirm with them first.",
    { campaign_id: z.number().int().positive().describe("Campaign ID") },
    async ({ campaign_id }) => {
      await campaignsApi.revokeShareCode(client, token, campaign_id as number);
      return {
        content: [
          {
            type: "text",
            text: `Share code for campaign ${campaign_id} has been revoked. All players were removed from the campaign and their characters detached; make a new code with share_code to invite anyone again.`,
          },
        ],
      };
    },
    { role: "dm" },
  );

  // -----------------------------------------------------------------------
  // Item box (förråd): DM-authored items created ahead of time, handed out
  // to players on demand (hand-out keeps the template = gives a copy).
  // -----------------------------------------------------------------------
  safeTool(
    server,
    "list_campaign_box",
    "List the campaign stash (förråd): DM-made items and equipment ready to hand out, with their stash_id.",
    { campaign_id: z.number().int().positive().describe("Campaign ID") },
    async ({ campaign_id }) => {
      const box = asArray(await campaignsApi.getCampaignBox(client, token, campaign_id as number));
      if (!box.length) return { content: [{ type: "text", text: "The campaign stash is empty." }] };
      const lines = box.map((it) => {
        const d = (it.data ?? {}) as Record<string, unknown>;
        const kind = it.kind === "quest" ? "quest item" : "equipment";
        const meta = it.kind === "equipment" ? [d.type, d.rarity && d.rarity !== "common" ? d.rarity : ""].filter(Boolean).join(", ") : "";
        const desc = typeof d.description === "string" && d.description ? `: ${d.description.length > 120 ? `${d.description.slice(0, 120)}...` : d.description}` : "";
        return `- stash_id ${it.id}: ${kind} "${d.name ?? "?"}"${meta ? ` (${meta})` : ""}${desc}`;
      });
      return { content: [{ type: "text", text: `Campaign stash (hand out with the stash_id):\n${lines.join("\n")}` }] };
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "add_box_quest_item",
    "Create a quest item in the campaign item box (förråd) for later hand-out.",
    {
      campaign_id: z.number().int().positive().describe("Campaign ID"),
      name: z.string().max(200).describe("Item name"),
      description: z.string().max(5000).optional().describe("Item description/lore (can be long)"),
    },
    async ({ campaign_id, name, description }) => {
      await campaignsApi.campaignBoxAction(client, token, campaign_id as number, {
        action: "add",
        item: { kind: "quest", quest: { name, description: description ?? "" } },
      });
      return { content: [{ type: "text", text: `Added quest item "${name}" to the box.` }] };
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "add_box_equipment",
    "Create equipment (weapon/armor/shield/misc) in the campaign item box for later hand-out. Supports rarity, stat bonuses, special effects.",
    {
      campaign_id: z.number().int().positive().describe("Campaign ID"),
      ...equipmentToolShape,
    },
    async ({ campaign_id, ...args }) => {
      const built = buildEquipment(args);
      if (!built.ok) return textError(invalidBonusMessage(built.invalidBonuses));
      await campaignsApi.campaignBoxAction(client, token, campaign_id, {
        action: "add",
        item: { kind: "equipment", equipment: built.equipment },
      });
      return text(`Added ${args.rarity || "common"} ${args.type} "${args.name}" to the box.`);
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "handout_box_item",
    "Give an item from the campaign stash to a character (the stash keeps the entry).",
    {
      campaign_id: z.number().int().positive().describe("Campaign ID"),
      item_id: z.number().int().positive().describe("Box item ID (from list_campaign_box)"),
      character_id: z.number().int().positive().describe("Character ID to give it to"),
    },
    async ({ campaign_id, item_id, character_id }) => {
      await campaignsApi.campaignBoxAction(client, token, campaign_id as number, {
        action: "handout",
        id: item_id,
        characterId: character_id,
      });
      return { content: [{ type: "text", text: `Gave stash item ${item_id} to character ${character_id}; the stash keeps its entry.` }] };
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "remove_box_item",
    "Remove an item from the campaign box (förråd).",
    {
      campaign_id: z.number().int().positive().describe("Campaign ID"),
      item_id: z.number().int().positive().describe("Box item ID"),
    },
    async ({ campaign_id, item_id }) => {
      await campaignsApi.campaignBoxAction(client, token, campaign_id as number, {
        action: "remove",
        id: item_id,
      });
      return { content: [{ type: "text", text: `Removed box item ${item_id}.` }] };
    },
    { role: "dm" },
  );
}
