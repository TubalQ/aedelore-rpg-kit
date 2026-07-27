import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as campaignsApi from "../api/campaigns.js";
import { safeTool } from "./safe-tool.js";
import { asRecord, asArray } from "./helpers.js";

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
        const sessions = c.session_count ?? c.sessionCount ?? "?";
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
    { campaign_id: z.number().describe("Campaign ID") },
    async ({ campaign_id }) => {
      const campaign = asRecord(await campaignsApi.getCampaign(
        client,
        token,
        campaign_id as number,
      ));

      let text = `Campaign: ${campaign.name} [${campaign.id}]\n`;
      if (campaign.description) text += `Description: ${campaign.description}\n`;
      if (campaign.share_code || campaign.shareCode)
        text += `Share code: ${campaign.share_code || campaign.shareCode}\n`;

      // getCampaign returnerar ingen sessions-array - hämta dem separat.
      const sessions = asArray(
        await campaignsApi.listCampaignSessions(client, token, campaign_id as number),
      );
      if (sessions.length) {
        text += `\nSessions (${sessions.length}):\n`;
        for (const s of sessions) {
          const num = s.session_number ?? s.sessionNumber ?? "?";
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
            text: `Campaign created: ${result.name} [id=${result.id}]`,
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
      campaign_id: z.number().describe("Campaign ID"),
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
    { campaign_id: z.number().describe("Campaign ID") },
    async ({ campaign_id }) => {
      const result = asRecord(await campaignsApi.generateShareCode(
        client,
        token,
        campaign_id as number,
      ));

      const code = result.share_code || result.shareCode;
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
    "Revoke the share code for a campaign so no new players can join",
    { campaign_id: z.number().describe("Campaign ID") },
    async ({ campaign_id }) => {
      await campaignsApi.revokeShareCode(client, token, campaign_id as number);
      return {
        content: [
          {
            type: "text",
            text: `Share code for campaign ${campaign_id} has been revoked.`,
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
    "List items in a campaign's item box (förråd) - DM-authored items ready to hand out.",
    { campaign_id: z.number().describe("Campaign ID") },
    async ({ campaign_id }) => {
      const box = asArray(await campaignsApi.getCampaignBox(client, token, campaign_id as number));
      if (!box.length) return { content: [{ type: "text", text: "The item box is empty." }] };
      const lines = box.map((it) => {
        const d = (it.data ?? {}) as Record<string, unknown>;
        const kind = it.kind === "quest" ? "Quest" : "Equip";
        const extra = it.kind === "equipment" ? ` (${d.type ?? "?"})` : "";
        return `- [${it.id}] ${kind}: ${d.name ?? "?"}${extra}`;
      });
      return { content: [{ type: "text", text: `Item box:\n${lines.join("\n")}` }] };
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "add_box_quest_item",
    "Create a quest item in the campaign item box (förråd) for later hand-out.",
    {
      campaign_id: z.number().describe("Campaign ID"),
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
      campaign_id: z.number().describe("Campaign ID"),
      name: z.string().max(200).describe("Equipment name"),
      type: z.enum(["weapon", "armor", "shield", "misc"]).describe("Equipment type"),
      rarity: z.enum(["common", "enchanted", "rare", "legendary"]).optional().describe("Rarity tier"),
      description: z.string().max(5000).optional().describe("Description/lore"),
      special_effect: z.string().max(500).optional().describe("Special effect text"),
      bonuses: z.array(z.string()).max(10).optional().describe('Stat bonuses, each "+N StatName" (e.g. "+1 Intelligence")'),
      base_weapon: z.string().optional().describe("Base weapon type (for weapons)"),
      atk_bonus: z.string().optional().describe("Attack bonus (for weapons)"),
      damage: z.string().optional().describe("Damage dice (for weapons)"),
      range: z.string().optional().describe("Range (for weapons)"),
      break_val: z.string().optional().describe("Break value (for weapons)"),
      advantage: z.string().optional().describe("Advantage condition (for weapons)"),
      base_armor: z.string().optional().describe("Base armor type (for armor)"),
      bodypart: z.string().optional().describe("Body part: head, shoulders, chest, hands, legs, or feet (for armor)"),
      hp: z.string().optional().describe("HP value (for armor)"),
      ac: z.number().optional().describe("AC value (for armor)"),
      disadvantage: z.string().optional().describe("Disadvantage condition (for armor)"),
    },
    async ({
      campaign_id, name, type, rarity, description, special_effect, bonuses,
      base_weapon, atk_bonus, damage, range, break_val, advantage,
      base_armor, bodypart, hp, ac, disadvantage,
    }) => {
      const equipment: Record<string, unknown> = { name, type };
      if (rarity) equipment.rarity = rarity;
      if (description) equipment.description = description;
      if (special_effect) equipment.specialEffect = special_effect;
      if (bonuses) {
        equipment.bonuses = (bonuses as string[])
          .map((b) => {
            const m = String(b).trim().match(/^([+-]?\d+)\s+(.+)$/);
            return m ? { stat: m[2].trim(), value: Number(m[1]) } : null;
          })
          .filter(Boolean);
      }
      if (base_weapon) equipment.baseWeapon = base_weapon;
      if (atk_bonus) equipment.atkBonus = atk_bonus;
      if (damage) equipment.damage = damage;
      if (range) equipment.range = range;
      if (break_val) equipment.breakVal = break_val;
      if (advantage) equipment.advantage = advantage;
      if (base_armor) equipment.baseArmor = base_armor;
      if (bodypart) equipment.bodypart = bodypart;
      if (hp) equipment.hp = Number(hp) || 0;
      if (ac !== undefined) equipment.ac = ac;
      if (disadvantage) equipment.disadvantage = disadvantage;
      await campaignsApi.campaignBoxAction(client, token, campaign_id as number, {
        action: "add",
        item: { kind: "equipment", equipment },
      });
      return { content: [{ type: "text", text: `Added ${rarity || "common"} ${type} "${name}" to the box.` }] };
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "handout_box_item",
    "Hand out an item from the campaign box to a character (the box keeps the template).",
    {
      campaign_id: z.number().describe("Campaign ID"),
      item_id: z.number().describe("Box item ID (from list_campaign_box)"),
      character_id: z.number().describe("Character ID to give it to"),
    },
    async ({ campaign_id, item_id, character_id }) => {
      await campaignsApi.campaignBoxAction(client, token, campaign_id as number, {
        action: "handout",
        id: item_id,
        characterId: character_id,
      });
      return { content: [{ type: "text", text: `Handed out box item ${item_id} to character ${character_id}.` }] };
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "remove_box_item",
    "Remove an item from the campaign box (förråd).",
    {
      campaign_id: z.number().describe("Campaign ID"),
      item_id: z.number().describe("Box item ID"),
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
