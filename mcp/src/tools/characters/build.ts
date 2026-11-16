import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../../api/client.js";
import * as charactersApi from "../../api/characters.js";
import { getGameData } from "../../game-data/loader.js";
import { safeTool } from "../safe-tool.js";
import { LOCK_STEPS } from "../../game-data/contracts.js";
import { asRecord, text, textError, withCharacter } from "../helpers.js";
import type { EquippedArmor, EquippedWeapon, SpellSlot } from "../../types.js";

const pointMap = z.record(z.string(), z.number().int().min(0));

/**
 * A class's ability slots, as the app counts them: `spellSlots` (C8). The old
 * `startingEquipment.abilities || 3` gave Mage 3 slots instead of 12, Druid 3
 * instead of 10 and Ascendant 3 instead of 6.
 */
export function abilitySlots(classData: Record<string, unknown> | undefined): number {
  const slots = classData?.spellSlots;
  return typeof slots === "number" && Number.isInteger(slots) && slots >= 0 ? slots : 3;
}

export function registerCharacterBuildTools(server: McpServer, client: ApiClient, token: string): void {
  safeTool(
    server,
    "set_race_class_religion",
    "Set race, class, and optionally religion for a character. The app applies the starting HP, arcana, gold, worthiness, weapon, armor and shield for that combination (same rules as the character wizard). Clears chosen abilities.",
    {
      character_id: z.number().int().positive().describe("Character ID"),
      race: z.string().min(1).describe("Race name (see get_game_data('races'))"),
      character_class: z.string().min(1).describe("Class name (see get_game_data('classes'))"),
      religion: z.string().min(1).optional().describe("Religion name (see get_game_data('religions'))"),
    },
    async ({ character_id, race, character_class, religion }) => {
      const char = asRecord(
        await charactersApi.applyRaceClass(client, token, character_id, {
          race,
          class: character_class,
          religion,
        }),
      );
      const d = (char.data ?? {}) as Record<string, unknown>;
      const weapons = ((d.equippedWeapons ?? []) as EquippedWeapon[]).map((w) => w.name);
      const armor = ((d.equippedArmor ?? []) as EquippedArmor[]).map((a) => `${a.name} (${a.bodypart})`);
      const shield = (d.equippedShield as { name?: string } | null)?.name;
      const gear = [...weapons, ...armor, ...(shield ? [shield] : [])];
      return text(
        [
          `Set ${race} ${character_class}${religion ? ` (${religion})` : ""}.`,
          `HP ${d.hp}/${d.maxHp}, Arcana ${d.arcana}/${d.maxArcana}, Gold ${d.gold}, Worthiness ${d.worthiness}.`,
          `Starting equipment: ${gear.length ? gear.join(", ") : "none for this class"}.`,
        ].join("\n"),
      );
    },
    { role: "player" },
  );

  safeTool(
    server,
    "set_attributes",
    "Distribute the character-creation points over attributes and skills. Values are TOTAL points per field (not deltas). The budget and per-field cap come from the game system (see get_game_data('attributes'): freePointsTotal, maxPointsPerField); attributes and skills share the budget. Requires race/class locked and attributes unlocked. Inside a map you send, fields you leave out are set to 0; a map you do not send at all (attributes or skills) keeps its current points. To raise stats after creation, use spend_xp.",
    {
      character_id: z.number().int().positive().describe("Character ID"),
      attributes: pointMap.optional().describe('Points per attribute by exact name, e.g. {"Strength": 2, "Wisdom": 1}'),
      skills: pointMap.optional().describe('Points per skill by exact name, e.g. {"Athletics": 1}'),
    },
    async ({ character_id, attributes, skills }) => {
      const rules = getGameData().attributes;
      if (attributes === undefined && skills === undefined) {
        return textError("ERROR: Send attributes and/or skills.");
      }

      const unknownAttrs = Object.keys(attributes ?? {}).filter((n) => !rules.attributeNames.includes(n));
      const unknownSkills = Object.keys(skills ?? {}).filter((n) => !rules.skillNames.includes(n));
      if (unknownAttrs.length || unknownSkills.length) {
        return textError(
          `ERROR: Unknown name(s): ${[...unknownAttrs, ...unknownSkills].join(", ")}. Attributes: ${rules.attributeNames.join(", ")}. Skills: see get_game_data('attributes').`,
        );
      }

      return withCharacter(client, token, character_id, (data, char) => {
        if (char.attributesLocked) return textError("ERROR: Attributes are locked and cannot be changed.");
        if (!char.raceClassLocked) return textError("ERROR: Lock race/class before setting attributes.");
        // A sent map is the full allocation (0 for fields left out); a map not
        // sent keeps what the character has (C12: build_character with only
        // attributes used to zero all skills).
        const current = (m: unknown): Record<string, number> =>
          m && typeof m === "object" ? (m as Record<string, number>) : {};
        const nextAttrs = Object.fromEntries(
          rules.attributeNames.map((n) => [n, attributes ? (attributes[n] ?? 0) : Number(current(data.attributes)[n]) || 0]),
        );
        const nextSkills = Object.fromEntries(
          rules.skillNames.map((n) => [n, skills ? (skills[n] ?? 0) : Number(current(data.skills)[n]) || 0]),
        );
        const overCap = Object.entries({ ...nextAttrs, ...nextSkills }).filter(([, v]) => v > rules.maxPointsPerField);
        if (overCap.length) {
          return textError(
            `ERROR: Max ${rules.maxPointsPerField} points per field at creation: ${overCap.map(([k, v]) => `${k}=${v}`).join(", ")}.`,
          );
        }
        const total = [...Object.values(nextAttrs), ...Object.values(nextSkills)].reduce((s, v) => s + v, 0);
        if (total > rules.freePointsTotal) {
          return textError(`ERROR: ${total} points used, the budget is ${rules.freePointsTotal}.`);
        }
        data.attributes = nextAttrs;
        data.skills = nextSkills;
        const left = rules.freePointsTotal - total;
        return text(
          `Points set (${total}/${rules.freePointsTotal} used${left > 0 ? `, ${left} left to distribute` : ""}): ${Object.entries({ ...nextAttrs, ...nextSkills })
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${k} ${v}`)
            .join(", ")}`,
        );
      });
    },
    { role: "player" },
  );

  safeTool(
    server,
    "set_abilities",
    "Set spells/abilities for a character. Must be valid spells for their class, within the class's ability slots.",
    {
      character_id: z.number().int().positive().describe("Character ID"),
      abilities: z
        .array(z.object({ name: z.string().min(1).describe("Spell/ability name for the character's class") }))
        .describe("Abilities to set (replaces the current selection)"),
    },
    async ({ character_id, abilities }) =>
      withCharacter(client, token, character_id, (data, char) => {
        if (char.abilitiesLocked) return textError("ERROR: Abilities are locked and cannot be changed.");
        const charClass = data.class as string | undefined;
        if (!charClass) return textError("ERROR: Character has no class set. Set race/class first.");

        const gd = getGameData();
        const classSpells = gd.spells[charClass];
        if (!classSpells) return textError(`ERROR: No spells found for class "${charClass}".`);
        const maxSlots = abilitySlots(gd.classes.data[charClass]);
        if (abilities.length > maxSlots) {
          return textError(
            `ERROR: Class "${charClass}" has ${maxSlots} ability slots, ${abilities.length} abilities were given.`,
          );
        }

        const spells: SpellSlot[] = [];
        for (const { name } of abilities) {
          const spell = classSpells.find((s) => s.name === name);
          if (!spell) {
            return textError(
              `ERROR: "${name}" is not a ${charClass} ability. Valid: ${classSpells.map((s) => s.name).join(", ")}`,
            );
          }
          spells.push({ name: spell.name, selected: true });
        }
        data.spells = spells;
        return text(`Abilities set:\n${spells.map((s) => s.name).join("\n")}`);
      }),
    { role: "player" },
  );

  safeTool(
    server,
    "spend_xp",
    'Spend this character\'s earned XP to raise attributes and/or skills past the creation cap. Values are POINTS TO ADD (deltas), NOT target values -- e.g. {"Strength": 1} raises Strength by 1. Each point costs the system\'s XP-per-point and is rejected if the character lacks enough unspent XP. This is the ONLY way to raise stats after they are locked. Use exact attribute/skill names (see get_my_character or get_game_data).',
    {
      character_id: z.number().int().positive().describe("Character ID"),
      attributes: z
        .record(z.string(), z.number().int().min(1))
        .optional()
        .describe('Attribute point deltas by exact name, e.g. {"Strength": 1}'),
      skills: z
        .record(z.string(), z.number().int().min(1))
        .optional()
        .describe('Skill point deltas by exact name, e.g. {"Athletics": 2}'),
    },
    async ({ character_id, attributes, skills }) => {
      const attrs = attributes ?? {};
      const sk = skills ?? {};
      if (Object.keys(attrs).length === 0 && Object.keys(sk).length === 0) {
        return textError("ERROR: Provide at least one attribute or skill to raise (points to add).");
      }
      const rules = getGameData().attributes;
      const unknown = [
        ...Object.keys(attrs).filter((n) => !rules.attributeNames.includes(n)),
        ...Object.keys(sk).filter((n) => !rules.skillNames.includes(n)),
      ];
      if (unknown.length) return textError(`ERROR: Unknown attribute/skill name(s): ${unknown.join(", ")}.`);

      try {
        const updated = asRecord(
          await charactersApi.spendXp(client, token, character_id, { attributes: attrs, skills: sk }),
        );
        const raised = [...Object.entries(attrs), ...Object.entries(sk)].map(([k, v]) => `${k} +${v}`).join(", ");
        return text(`Raised ${raised}. XP total ${updated.xp ?? "?"}, spent ${updated.xpSpent ?? "?"}.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Only the API's notEnoughXp is a lack of XP; any other 400 (a name or
        // value the API refused) goes out with the API's own message.
        if (msg.startsWith("API 400") && msg.includes('"notEnoughXp"')) {
          return textError("ERROR: Not enough unspent XP for that many points. Check unspent XP on the character sheet.");
        }
        throw err;
      }
    },
    { role: "player" },
  );

  safeTool(
    server,
    "lock_character_step",
    "Lock a character build step (must follow order: raceClass -> attributes -> abilities)",
    {
      character_id: z.number().int().positive().describe("Character ID"),
      step: z.enum(LOCK_STEPS).describe("Step to lock"),
    },
    async ({ character_id, step }) => {
      const result = asRecord(await charactersApi.lockCharacterStep(client, token, character_id, step, true));
      return text((result.message as string) || `Locked step "${step}" for character ${character_id}.`);
    },
    { role: "player" },
  );
}
