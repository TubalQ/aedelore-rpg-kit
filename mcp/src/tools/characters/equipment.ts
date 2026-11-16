import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api/client.js";
import { getGameData } from "../../game-data/loader.js";
import { safeTool } from "../safe-tool.js";
import { text, textError, withCharacter } from "../helpers.js";
import { bodyParts } from "./sheet.js";
import type { EquippedArmor, EquippedShield, EquippedWeapon } from "../../types.js";

const MAX_WEAPON_SLOTS = 3;
const SHIELD = "shield";

function bodyPartError(part: string): string {
  return `ERROR: Unknown body part "${part}". Valid: ${bodyParts().join(", ")}.`;
}

/**
 * C7: each armor piece belongs to one body part. Putting the same piece on
 * every part stacked AC far past the system's maximum (AC 28, max 18). The
 * part defaults to the armor's own and must match it.
 */
export function armorBodyPart(
  armor: { name: string; bodypart?: string },
  requested: string | undefined,
  known: string[],
): { part: string } | { error: string; part: string } {
  const own = typeof armor.bodypart === "string" && armor.bodypart ? armor.bodypart.toLowerCase() : undefined;
  const part = requested?.toLowerCase() ?? own;
  if (!part) return { error: `"${armor.name}" has no body part in the game data; pass body_part.`, part: "" };
  if (!known.includes(part)) return { error: "unknown part", part };
  if (own && part !== own) return { error: `"${armor.name}" is worn on ${own}, not ${part}.`, part };
  return { part };
}

export function registerCharacterEquipmentTools(server: McpServer, client: ApiClient, token: string): void {
  safeTool(
    server,
    "equip_weapon",
    "Equip a weapon in a slot (1-3): replaces the weapon there, or is added after the last weapon (weapons have no empty slots). Fills attack, damage, range and break from game data.",
    {
      character_id: z.number().int().positive().describe("Character ID"),
      slot: z.number().int().min(1).max(MAX_WEAPON_SLOTS).describe("Weapon slot (1-3)"),
      weapon_name: z.string().min(1).describe("Weapon name (see get_game_data('weapons'))"),
    },
    async ({ character_id, slot, weapon_name }) => {
      const info = getGameData().weapons.weapons.find((w) => w.name === weapon_name);
      if (!info) return textError(`ERROR: Unknown weapon "${weapon_name}". See get_game_data("weapons").`);

      return withCharacter(client, token, character_id, (data) => {
        const weapons = [...((data.equippedWeapons ?? []) as EquippedWeapon[])];
        const entry: EquippedWeapon = {
          name: info.name,
          damage: info.damage || "",
          bonus: info.bonus || "",
          range: info.range || "",
          break: info.break ?? 0,
        };
        // The sheet keeps weapons as a list without empty slots, so a slot past
        // the end is the next free one; the answer says which (slot 3 with one
        // weapon used to report nothing and land in slot 2).
        const at = Math.min(slot - 1, weapons.length);
        weapons[at] = entry;
        data.equippedWeapons = weapons;
        return text(
          `Equipped ${info.name} in slot ${at + 1}${at + 1 !== slot ? ` (slot ${slot} was past the last weapon)` : ""} (ATK:${info.bonus} DMG:${info.damage} RNG:${info.range} BRK:${info.break})`,
        );
      });
    },
    { role: "player" },
  );

  safeTool(
    server,
    "equip_armor",
    "Equip an armor piece on a body part and/or a shield. Fills HP, AC and disadvantage from game data. Body parts come from get_game_data('armor') (bodyParts).",
    {
      character_id: z.number().int().positive().describe("Character ID"),
      body_part: z.string().optional().describe("Body part for the armor (defaults to the armor's own body part; must match it)"),
      armor_name: z.string().optional().describe("Armor name (see get_game_data('armor'))"),
      shield_name: z.string().optional().describe("Shield name (see get_game_data('shields'))"),
    },
    async ({ character_id, body_part, armor_name, shield_name }) => {
      const gd = getGameData();
      if (!armor_name && !shield_name) {
        return textError("ERROR: Provide armor_name (and optionally body_part), and/or shield_name.");
      }
      const armorInfo = armor_name ? gd.armor.armor.find((a) => a.name === armor_name) : undefined;
      if (armor_name && !armorInfo) return textError(`ERROR: Unknown armor "${armor_name}". See get_game_data("armor").`);
      const placed = armorInfo ? armorBodyPart(armorInfo, body_part, bodyParts()) : null;
      if (placed && "error" in placed) {
        return textError(placed.error === "unknown part" ? bodyPartError(placed.part) : `ERROR: ${placed.error}`);
      }
      const part = placed?.part;
      const shieldInfo = shield_name ? gd.shields.find((s) => s.name === shield_name) : undefined;
      if (shield_name && !shieldInfo) return textError(`ERROR: Unknown shield "${shield_name}". See get_game_data("shields").`);

      return withCharacter(client, token, character_id, (data) => {
        const done: string[] = [];
        if (armorInfo && part) {
          const armor = ((data.equippedArmor ?? []) as EquippedArmor[]).filter((a) => a.bodypart !== part);
          armor.push({
            name: armorInfo.name,
            bodypart: part,
            ac: armorInfo.ac ?? 0,
            hp: armorInfo.hp ?? 0,
            maxHp: armorInfo.hp ?? 0,
            disadvantage: armorInfo.disadvantage ?? null,
          });
          data.equippedArmor = armor;
          done.push(`Equipped ${armorInfo.name} on ${part} (HP:${armorInfo.hp} AC:${armorInfo.ac})`);
        }
        if (shieldInfo) {
          const shield: EquippedShield = {
            name: shieldInfo.name,
            ac: shieldInfo.ac ?? 0,
            hp: shieldInfo.hp ?? 0,
            maxHp: shieldInfo.hp ?? 0,
            damage: shieldInfo.damage || "",
            disadvantage: shieldInfo.disadvantage ?? null,
          };
          data.equippedShield = shield;
          done.push(`Equipped ${shieldInfo.name} (HP:${shieldInfo.hp} AC:${shieldInfo.ac})`);
        }
        return text(done.join("\n"));
      });
    },
    { role: "player" },
  );

  safeTool(
    server,
    "update_equipment_hp",
    `Set the current HP of an equipped armor piece or the shield (track damage in combat). Use a body part from get_game_data('armor') or "${SHIELD}".`,
    {
      character_id: z.number().int().positive().describe("Character ID"),
      piece: z.string().min(1).describe(`Body part (e.g. head, chest, feet) or "${SHIELD}"`),
      hp: z.number().int().min(0).describe("New current HP"),
    },
    async ({ character_id, piece, hp }) => {
      const part = piece.toLowerCase();
      if (part !== SHIELD && !bodyParts().includes(part)) return textError(bodyPartError(part));

      return withCharacter(client, token, character_id, (data) => {
        if (part === SHIELD) {
          const shield = data.equippedShield as EquippedShield | null | undefined;
          if (!shield) return textError("ERROR: No shield equipped.");
          if (shield.maxHp > 0 && hp > shield.maxHp) {
            return textError(`ERROR: HP ${hp} exceeds the shield's max HP ${shield.maxHp}.`);
          }
          data.equippedShield = { ...shield, hp };
          return text(`Shield HP ${hp}/${shield.maxHp}${hp === 0 ? " (BROKEN)" : ""}. Log the cause in the session log.`);
        }
        const armor = (data.equippedArmor ?? []) as EquippedArmor[];
        const piece = armor.find((a) => a.bodypart === part);
        if (!piece) return textError(`ERROR: No armor equipped on ${part}.`);
        if (piece.maxHp > 0 && hp > piece.maxHp) {
          return textError(`ERROR: HP ${hp} exceeds max HP ${piece.maxHp} for ${part}.`);
        }
        data.equippedArmor = armor.map((a) => (a.bodypart === part ? { ...a, hp } : a));
        return text(`${piece.name} (${part}) HP ${hp}/${piece.maxHp}${hp === 0 ? " (BROKEN)" : ""}. Log the cause in the session log.`);
      });
    },
    { role: "player" },
  );
}
