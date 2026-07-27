import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as campaignsApi from "../api/campaigns.js";
import * as charactersApi from "../api/characters.js";
import { getGameData } from "../game-data/loader.js";
import { safeTool } from "./safe-tool.js";
import { text, asRecord, asArray } from "./helpers.js";
import type {
  EquippedWeapon,
  EquippedArmor,
  EquippedShield,
  SpellSlot,
} from "../types.js";

export function registerDmCharacterTools(
  server: McpServer,
  client: ApiClient,
  token: string,
): void {
  safeTool(
    server,
    "list_campaign_characters",
    "List all player characters in a campaign with XP and lock status",
    { campaign_id: z.number().describe("Campaign ID") },
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
        output += ` | Locks: race/class=${c.race_class_locked ? "LOCKED" : "open"}, attributes=${c.attributes_locked ? "LOCKED" : "open"}, abilities=${c.abilities_locked ? "LOCKED" : "open"}`;
        output += "\n\n";
      }
      return text(output.trim());
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "get_character_build",
    "Get a character's full build (stats, equipment, abilities). Formatted as a readable character sheet.",
    { character_id: z.number().describe("Character ID") },
    async ({ character_id }) => {
      const char = asRecord(await charactersApi.getCharacter(
        client,
        token,
        character_id as number,
      ));
      const d = asRecord(char.data ?? {});

      let sheet = `# ${char.name || "Unnamed"}\n`;
      sheet += `**Race:** ${d.race || "Not set"} | **Class:** ${d.class || "Not set"}`;
      if (d.religion) sheet += ` | **Religion:** ${d.religion}`;
      sheet += "\n";

      sheet += `\n**Locks:** Race/Class: ${char.race_class_locked ? "LOCKED" : "unlocked"} | Attributes: ${char.attributes_locked ? "LOCKED" : "unlocked"} | Abilities: ${char.abilities_locked ? "LOCKED" : "unlocked"}\n`;

      sheet += `\n**HP:** ${d.hp ?? 0}/${d.maxHp ?? 0} | **Arcana:** ${d.arcana ?? 0}/${d.maxArcana ?? 0} | **Willpower:** ${d.willpower ?? 0}/${d.maxWillpower ?? 3} | **Worthiness:** ${d.worthiness ?? 0} | **Bleed:** ${d.bleed ?? 0} | **Weakened:** ${d.weakened ?? 0}/${d.maxWeakened ?? 3}\n`;

      const attrs = d.attributes as Record<string, number> | undefined;
      if (attrs && Object.keys(attrs).length > 0) {
        const parts = Object.entries(attrs).map(([k, v]) => `${k}:${v}`);
        sheet += `\n**Attributes:** ${parts.join(" ")}\n`;
      }

      const skills = d.skills as Record<string, number> | undefined;
      if (skills && Object.keys(skills).length > 0) {
        const parts = Object.entries(skills).map(([k, v]) => `${k}:${v}`);
        sheet += `**Skills:** ${parts.join(" ")}\n`;
      }

      const weapons = d.equippedWeapons as EquippedWeapon[] | undefined;
      if (weapons && weapons.length > 0) {
        for (let i = 0; i < weapons.length; i++) {
          const w = weapons[i];
          sheet += `**Weapon ${i + 1}:** ${w.name} (ATK:${w.bonus || "?"} DMG:${w.damage || "?"} RNG:${w.range || "?"} BRK:${w.break ?? "?"})\n`;
        }
      }

      const armor = d.equippedArmor as EquippedArmor[] | undefined;
      if (armor && armor.length > 0) {
        for (const a of armor) {
          const label = a.bodypart.charAt(0).toUpperCase() + a.bodypart.slice(1);
          sheet += `**Armor (${label}):** ${a.name} (HP:${a.hp}/${a.maxHp} AC:${a.ac}${a.disadvantage ? ` Disadv:${a.disadvantage}` : ""})\n`;
        }
      }

      const shield = d.equippedShield as EquippedShield | null | undefined;
      if (shield) {
        sheet += `**Shield:** ${shield.name} (HP:${shield.hp}/${shield.maxHp} AC:${shield.ac}${shield.disadvantage ? ` Disadv:${shield.disadvantage}` : ""})\n`;
      }

      const spells = d.spells as SpellSlot[] | undefined;
      if (spells && spells.length > 0) {
        for (let i = 0; i < spells.length; i++) {
          const s = spells[i];
          sheet += `**Ability ${i + 1}:** ${s.name}${s.selected ? "" : " (unselected)"}\n`;
        }
      }

      sheet += `\n**Gold:** ${d.gold ?? 0} | **Food:** ${d.food ?? 0}\n`;

      return text(sheet.trim());
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "give_xp",
    "Award XP to a character",
    {
      campaign_id: z.number().describe("Campaign ID"),
      character_id: z.number().describe("Character ID"),
      amount: z.number().min(1).max(10000).describe("XP amount (1-10000)"),
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
      campaign_id: z.number().describe("Campaign ID"),
      character_id: z.number().describe("Character ID"),
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
      campaign_id: z.number().describe("Campaign ID"),
      character_id: z.number().describe("Character ID"),
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
    "Give DM Special Equipment (weapon or armor) to a character. Supports rarity, stat bonuses, and special effects.",
    {
      campaign_id: z.number().describe("Campaign ID"),
      character_id: z.number().describe("Character ID"),
      name: z.string().max(200).describe("Equipment name"),
      type: z.enum(["weapon", "armor"]).describe("Equipment type"),
      rarity: z
        .enum(["common", "enchanted", "rare", "legendary"])
        .optional()
        .describe("Rarity tier"),
      description: z.string().max(5000).optional().describe("Equipment description/lore"),
      special_effect: z.string().max(500).optional().describe("Special effect text"),
      bonuses: z
        .array(z.string())
        .max(10)
        .optional()
        .describe('Stat bonuses, each as "+N StatName" (e.g. "+1 Intelligence")'),
      base_weapon: z.string().optional().describe("Base weapon type (for weapons)"),
      atk_bonus: z.string().optional().describe("Attack bonus (for weapons)"),
      damage: z.string().optional().describe('Damage dice (for weapons, e.g. "1d8")'),
      range: z.string().optional().describe("Range (for weapons)"),
      break_val: z.string().optional().describe("Break value (for weapons)"),
      advantage: z.string().optional().describe("Advantage condition (for weapons)"),
      base_armor: z.string().optional().describe("Base armor type (for armor)"),
      bodypart: z
        .string()
        .optional()
        .describe("Body part: head, shoulders, chest, hands, legs, or feet (for armor)"),
      hp: z.string().optional().describe("HP value (for armor)"),
      ac: z.number().optional().describe("AC value (for armor)"),
      disadvantage: z.string().optional().describe("Disadvantage condition (for armor)"),
    },
    async ({
      campaign_id,
      character_id,
      name,
      type,
      rarity,
      description,
      special_effect,
      bonuses,
      base_weapon,
      atk_bonus,
      damage,
      range,
      break_val,
      advantage,
      base_armor,
      bodypart,
      hp,
      ac,
      disadvantage,
    }) => {
      const equipment: Record<string, unknown> = { name, type };
      if (rarity) equipment.rarity = rarity;
      if (description) equipment.description = description;
      if (special_effect) equipment.specialEffect = special_effect;
      if (bonuses) {
        // Schemat vill ha {stat, value:number}[] - parsa "+1 Intelligence" → {stat:"Intelligence", value:1}.
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

      const result = asRecord(await campaignsApi.characterControl(
        client,
        token,
        campaign_id as number,
        { action: "giveEquipment", characterId: character_id, equipment },
      ));
      return text(
        (result.message as string) ||
          `Gave ${rarity || "common"} ${type} "${name}" to character ${character_id}.`,
      );
    },
    { role: "dm" },
  );

  safeTool(
    server,
    "remove_equipment",
    "Remove DM Special Equipment from a character by name",
    {
      campaign_id: z.number().describe("Campaign ID"),
      character_id: z.number().describe("Character ID"),
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
      campaign_id: z.number().describe("Campaign ID"),
      character_id: z.number().describe("Character ID"),
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
