import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as campaignsApi from "../api/campaigns.js";
import * as charactersApi from "../api/characters.js";
import { getGameData } from "../game-data/loader.js";
import { safeTool } from "./safe-tool.js";
import { text } from "./helpers.js";
import type {
  EquippedWeapon,
  EquippedArmor,
  EquippedShield,
  SpellSlot,
  Relationship,
  QuestItem,
  DmEquipment,
} from "../types.js";

interface ApiRecord {
  [key: string]: unknown;
  data?: Record<string, unknown>;
  id?: number;
  name?: string;
}

function asRecord(value: unknown): ApiRecord {
  if (value && typeof value === "object") return value as ApiRecord;
  throw new Error("Expected object response from API");
}

function getSlotNames(): Record<number, string> {
  const armorData = getGameData().armor;
  const parts = armorData.bodyParts ?? [
    "head",
    "shoulders",
    "chest",
    "hands",
    "legs",
    "feet",
  ];
  const names: Record<number, string> = {};
  for (let i = 0; i < parts.length; i++) {
    names[i + 1] = parts[i].charAt(0).toUpperCase() + parts[i].slice(1);
  }
  return names;
}

function getSlotMap(): Record<string, number> {
  const armorData = getGameData().armor;
  const parts = armorData.bodyParts ?? [
    "head",
    "shoulders",
    "chest",
    "hands",
    "legs",
    "feet",
  ];
  const map: Record<string, number> = {};
  for (let i = 0; i < parts.length; i++) {
    map[parts[i]] = i + 1;
  }
  return map;
}

const gd = getGameData;

export function registerPlayerCharacterTools(
  server: McpServer,
  client: ApiClient,
  token: string,
): void {
  // =========================================================================
  // Character Management
  // =========================================================================

  safeTool(
    server,
    "create_my_character",
    "Create a new character with a name. Returns the new character ID.",
    {
      name: z.string().min(1).max(100).describe("Character name"),
      campaign_id: z.number().optional().describe("Campaign ID to assign the character to"),
    },
    async ({ name, campaign_id }) => {
      const result = asRecord(await charactersApi.createCharacter(
        client,
        token,
        name as string,
        campaign_id as number | undefined,
      ));
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
      const chars = (await charactersApi.listCharacters(client, token)) as ApiRecord[];
      if (!chars.length) return text("You have no characters yet.");

      let output = `# Your Characters (${chars.length})\n\n`;
      for (const c of chars) {
        const d = (c.data ?? {}) as Record<string, unknown>;
        output += `**${c.name || "Unnamed"}** (ID: ${c.id})`;
        if (d.race) output += ` -- ${d.race} ${d.class || ""}`;
        if (d.religion) output += ` (${d.religion})`;
        const campaign = c.campaign as Record<string, unknown> | undefined;
        if (campaign) output += ` | Campaign: ${campaign.name}`;
        output += ` | XP: ${c.xp || 0}`;
        output += "\n";
      }
      return text(output.trim());
    },
    { role: "player" },
  );

  safeTool(
    server,
    "get_my_character",
    "Get your character's full data including stats, equipment, abilities, and lock status",
    { character_id: z.number().describe("Character ID") },
    async ({ character_id }) => {
      const char = asRecord(await charactersApi.getCharacter(
        client,
        token,
        character_id as number,
      ));
      const d = (char.data ?? {}) as Record<string, unknown>;

      let summary = `# ${char.name || "Unnamed"}\n`;
      summary += `**Race:** ${d.race || "Not set"} | **Class:** ${d.class || "Not set"}`;
      if (d.religion) summary += ` | **Religion:** ${d.religion}`;
      summary += "\n";

      summary += `\n**Locks:** Race/Class: ${char.race_class_locked ? "LOCKED" : "unlocked"} | Attributes: ${char.attributes_locked ? "LOCKED" : "unlocked"} | Abilities: ${char.abilities_locked ? "LOCKED" : "unlocked"}\n`;

      summary += `\n**HP:** ${d.hp ?? 0}/${d.maxHp ?? 0} | **Arcana:** ${d.arcana ?? 0}/${d.maxArcana ?? 0} | **Willpower:** ${d.willpower ?? 0}/${d.maxWillpower ?? 3} | **Worthiness:** ${d.worthiness ?? 0} | **Bleed:** ${d.bleed ?? 0} | **Weakened:** ${d.weakened ?? 0}/${d.maxWeakened ?? 3}\n`;

      const attrs = d.attributes as Record<string, number> | undefined;
      if (attrs && Object.keys(attrs).length > 0) {
        const parts = Object.entries(attrs).map(([k, v]) => `${k}:${v}`);
        summary += `\n**Attributes:** ${parts.join(" ")}\n`;
      }

      const skills = d.skills as Record<string, number> | undefined;
      if (skills && Object.keys(skills).length > 0) {
        const parts = Object.entries(skills).map(([k, v]) => `${k}:${v}`);
        summary += `**Skills:** ${parts.join(" ")}\n`;
      }

      const weapons = d.equippedWeapons as EquippedWeapon[] | undefined;
      if (weapons && weapons.length > 0) {
        for (let i = 0; i < weapons.length; i++) {
          const w = weapons[i];
          summary += `**Weapon ${i + 1}:** ${w.name} (ATK:${w.bonus || "?"} DMG:${w.damage || "?"} RNG:${w.range || "?"} BRK:${w.break ?? "?"})\n`;
        }
      }

      const armor = d.equippedArmor as EquippedArmor[] | undefined;
      if (armor && armor.length > 0) {
        for (const a of armor) {
          const label = a.bodypart.charAt(0).toUpperCase() + a.bodypart.slice(1);
          summary += `**Armor (${label}):** ${a.name} (HP:${a.hp}/${a.maxHp} AC:${a.ac}${a.disadvantage ? ` Disadv:${a.disadvantage}` : ""})\n`;
        }
      }

      const shield = d.equippedShield as EquippedShield | null | undefined;
      if (shield) {
        summary += `**Shield:** ${shield.name} (HP:${shield.hp}/${shield.maxHp} AC:${shield.ac}${shield.disadvantage ? ` Disadv:${shield.disadvantage}` : ""})\n`;
      }

      const spells = d.spells as SpellSlot[] | undefined;
      if (spells && spells.length > 0) {
        for (let i = 0; i < spells.length; i++) {
          const s = spells[i];
          summary += `**Ability ${i + 1}:** ${s.name}${s.selected ? "" : " (unselected)"}\n`;
        }
      }

      summary += `\n**Gold:** ${d.gold ?? 0} | **Food:** ${d.food ?? 0}\n`;

      const rels = d.relationships as Relationship[] | undefined;
      if (rels && Array.isArray(rels) && rels.length > 0) {
        summary += "\n**Relationships:**\n";
        for (const r of rels) {
          if (r.archived) continue;
          summary += `- **${r.name}**${r.relation ? ` (${r.relation})` : ""}${r.notes ? `: ${r.notes}` : ""}\n`;
        }
      }

      const questItems = d.questItems as QuestItem[] | undefined;
      if (questItems && questItems.length > 0) {
        summary += "\n**Quest Items:**\n";
        for (const item of questItems) {
          summary += `- ${item.name}${item.description ? `: ${item.description}` : ""}${item.sessionName ? ` (${item.sessionName})` : ""}\n`;
        }
      }

      const dmEquip = d.dmEquipment as DmEquipment[] | undefined;
      if (dmEquip && dmEquip.length > 0) {
        summary += "\n**DM Equipment:**\n";
        for (const eq of dmEquip) {
          summary += `- ${eq.name}${eq.type ? ` (${eq.type})` : ""}\n`;
        }
      }

      const campaign = char.campaign as Record<string, unknown> | undefined;
      if (campaign) {
        summary += `\n**Campaign:** ${campaign.name}${campaign.dm_name ? ` (DM: ${campaign.dm_name})` : ""}\n`;
      }

      summary +=
        "\n---\nBefore playing, load data relevant to this character's class using get_game_data. Call get_rules(\"<topic>\") for a specific rule (or get_rules for all) when a rules question comes up -- don't preload the full ruleset. Never guess spell costs, weapon stats, or combat mechanics.\n";

      return text(summary.trim());
    },
    { role: "player" },
  );

  safeTool(
    server,
    "get_party",
    "List party members in a campaign",
    { campaign_id: z.number().describe("Campaign ID") },
    async ({ campaign_id }) => {
      const chars = (await campaignsApi.listCampaignCharacters(
        client,
        token,
        campaign_id as number,
      )) as ApiRecord[];

      if (!chars.length) return text("No characters in this campaign.");

      let output = `# Party (${chars.length} members)\n\n`;
      for (const c of chars) {
        const d = (c.data ?? {}) as Record<string, unknown>;
        output += `**${c.name || "Unnamed"}** (ID: ${c.id})`;
        if (d.race) output += ` -- ${d.race} ${d.class || ""}`;
        output += ` | HP: ${d.hp ?? "?"}/${d.maxHp ?? "?"}`;
        output += ` | XP: ${c.xp || 0}`;
        output += "\n";
      }
      return text(output.trim());
    },
    { role: "player" },
  );

  safeTool(
    server,
    "join_campaign",
    "Join a campaign using a share code",
    { share_code: z.string().describe("Campaign share code") },
    async ({ share_code }) => {
      const result = asRecord(await campaignsApi.joinCampaign(
        client,
        token,
        share_code as string,
      ));
      return text(
        result.campaign_name
          ? `Joined campaign: ${result.campaign_name}`
          : `Joined campaign successfully.`,
      );
    },
    { role: "player" },
  );

  // =========================================================================
  // Character Building
  // =========================================================================

  safeTool(
    server,
    "set_race_class_religion",
    "Set race, class, and optionally religion for a character. Auto-applies starting equipment (weapon, armor, shield, HP, gold, worthiness) from game data.",
    {
      character_id: z.number().describe("Character ID"),
      race: z.string().describe("Race name (must exist in game data)"),
      character_class: z.string().describe("Class name (must exist in game data)"),
      religion: z.string().optional().describe("Religion name"),
    },
    async ({ character_id, race, character_class, religion }) => {
      const charId = character_id as number;
      const raceName = race as string;
      const className = character_class as string;

      const char = asRecord(await charactersApi.getCharacter(
        client,
        token,
        charId,
      ));

      if (char.race_class_locked) {
        return text("ERROR: Race/class is already locked and cannot be changed.");
      }

      const gameData = gd();
      const races = gameData.races;
      const classes = gameData.classes;

      if (races && !races.data[raceName]) {
        return text(
          `ERROR: Unknown race "${raceName}". Valid races: ${races.names.join(", ")}`,
        );
      }
      if (classes && !classes.data[className]) {
        return text(
          `ERROR: Unknown class "${className}". Valid classes: ${classes.names.join(", ")}`,
        );
      }

      const data = (char.data ?? {}) as Record<string, unknown>;
      data.race = raceName;
      data.class = className;
      if (religion) data.religion = religion;

      const raceEntry = races?.data[raceName];
      const raceEquip = raceEntry?.startingEquipment as
        | Record<string, unknown>
        | undefined;
      const classEntry = classes?.data[className];
      const classEquip = classEntry?.startingEquipment as
        | Record<string, unknown>
        | undefined;

      let baseHp = 0;
      if (raceEquip) {
        baseHp = (raceEquip.hp as number) || 0;
        data.hp = baseHp;
        data.maxHp = baseHp;
        data.worthiness = (raceEquip.worthiness as number) || 0;
        data.food = 0;
      }

      if (classEquip) {
        data.gold = (classEquip.gold as number) || 0;
        if (classEquip.hpBonus && baseHp) {
          const totalHp = baseHp + (classEquip.hpBonus as number);
          data.hp = totalHp;
          data.maxHp = totalHp;
        }
        if (classEquip.worthiness !== undefined && raceEquip?.worthiness !== undefined) {
          data.worthiness =
            (raceEquip.worthiness as number) + (classEquip.worthiness as number);
        }
        data.arcana = (classEntry?.arcanaStart as number) || 0;
        data.maxArcana = (classEntry?.arcanaMax as number) || 0;
      }

      data.willpower = 0;
      data.maxWillpower = 3;
      data.bleed = 0;
      data.weakened = 0;
      data.maxWeakened = 3;

      const findWeapon = (name: string) =>
        gameData.weapons.weapons.find((w) => w.name === name);
      const findArmor = (name: string) =>
        gameData.armor.armor.find((a) => a.name === name);
      const findShield = (name: string) =>
        gameData.shields.find((s) => s.name === name);

      const equippedWeapons: EquippedWeapon[] = [];
      const equippedArmor: EquippedArmor[] = [];
      let equippedShield: EquippedShield | null = null;

      const startKey = `${raceName}_${className}`;
      const startEquipData = raceEntry?.starting_equipment as
        | Record<string, Record<string, unknown>>
        | undefined;
      const startEquipEntry = startEquipData?.[startKey] as Record<string, unknown> | undefined;

      if (startEquipEntry) {
        if (startEquipEntry.weapon) {
          const weaponName = startEquipEntry.weapon as string;
          const weaponInfo = findWeapon(weaponName);
          equippedWeapons.push({
            name: weaponName,
            damage: weaponInfo?.damage || "",
            bonus: weaponInfo?.bonus || "",
            range: weaponInfo?.range || "",
            break: weaponInfo?.break ?? 0,
          });
        }

        const raceWeapon = raceEquip?.weapon as string | undefined;
        if (raceWeapon && raceWeapon !== startEquipEntry.weapon) {
          const weaponInfo = findWeapon(raceWeapon);
          equippedWeapons.push({
            name: raceWeapon,
            damage: weaponInfo?.damage || "",
            bonus: weaponInfo?.bonus || "",
            range: weaponInfo?.range || "",
            break: weaponInfo?.break ?? 0,
          });
        }

        if (startEquipEntry.armor) {
          for (const [bodypart, armorName] of Object.entries(
            startEquipEntry.armor as Record<string, string>,
          )) {
            const armorInfo = findArmor(armorName);
            equippedArmor.push({
              name: armorName,
              bodypart,
              ac: armorInfo?.ac ?? 0,
              hp: armorInfo?.hp ?? 0,
              maxHp: armorInfo?.hp ?? 0,
              disadvantage: armorInfo?.disadvantage ?? null,
            });
          }
        }

        if (startEquipEntry.shield) {
          const shieldName = startEquipEntry.shield as string;
          const shieldInfo = findShield(shieldName);
          equippedShield = {
            name: shieldName,
            ac: shieldInfo?.ac ?? 0,
            hp: shieldInfo?.hp ?? 0,
            maxHp: shieldInfo?.hp ?? 0,
            damage: shieldInfo?.damage || "",
            disadvantage: shieldInfo?.disadvantage ?? null,
          };
        }
      }

      data.equippedWeapons = equippedWeapons;
      data.equippedArmor = equippedArmor;
      data.equippedShield = equippedShield;
      if (!data.spells) data.spells = [];
      if (!data.questItems) data.questItems = [];
      if (!data.dmEquipment) data.dmEquipment = [];
      if (!data.relationships) data.relationships = [];

      await charactersApi.updateCharacter(client, token, charId, {
        name: char.name as string || "Unnamed",
        data,
      });

      let msg = `Set ${raceName} ${className}`;
      if (religion) msg += ` (${religion})`;
      msg += ". Starting equipment applied.";
      msg += ` HP: ${data.hp}.`;
      if (data.gold) msg += ` Gold: ${data.gold}.`;
      return text(msg);
    },
    { role: "player" },
  );

  safeTool(
    server,
    "set_attributes",
    "Set attribute values for a character. Max 5 per base stat, 10 free points total. Third eye is separate (0-3).",
    {
      character_id: z.number().describe("Character ID"),
      attributes: z
        .object({
          str: z.number().min(0).max(5).describe("Strength (0-5)"),
          dex: z.number().min(0).max(5).describe("Dexterity (0-5)"),
          tou: z.number().min(0).max(5).describe("Toughness (0-5)"),
          int: z.number().min(0).max(5).describe("Intelligence (0-5)"),
          wis: z.number().min(0).max(5).describe("Wisdom (0-5)"),
          fow: z.number().min(0).max(5).describe("Force of Will (0-5)"),
          te: z.number().min(0).max(3).optional().describe("Third Eye (0-3)"),
        })
        .describe("Attribute values"),
    },
    async ({ character_id, attributes }) => {
      const charId = character_id as number;
      const attrs = attributes as {
        str: number;
        dex: number;
        tou: number;
        int: number;
        wis: number;
        fow: number;
        te?: number;
      };

      const char = asRecord(await charactersApi.getCharacter(
        client,
        token,
        charId,
      ));

      if (char.attributes_locked) {
        return text("ERROR: Attributes are already locked and cannot be changed.");
      }
      if (!char.race_class_locked) {
        return text("ERROR: Must lock race/class before setting attributes.");
      }

      const total = attrs.str + attrs.dex + attrs.tou + attrs.int + attrs.wis + attrs.fow;

      if (total > 10) {
        return text(
          `ERROR: Total base points (${total}) exceeds maximum of 10. Reduce some values.`,
        );
      }
      if (total < 10) {
        return text(
          `WARNING: Only ${total}/10 points used. All 10 free points should be allocated.`,
        );
      }

      const data = (char.data ?? {}) as Record<string, unknown>;
      const attrMap: Record<string, number> = {
        "Strength": attrs.str,
        "Dexterity": attrs.dex,
        "Toughness": attrs.tou,
        "Intelligence": attrs.int,
        "Wisdom": attrs.wis,
        "Force of Will": attrs.fow,
      };
      if (attrs.te !== undefined) {
        attrMap["Third Eye"] = attrs.te;
      }
      data.attributes = attrMap;

      await charactersApi.updateCharacter(client, token, charId, {
        name: char.name as string || "Unnamed",
        data,
      });

      return text(
        `Attributes set: STR:${attrs.str} DEX:${attrs.dex} TOU:${attrs.tou} INT:${attrs.int} WIS:${attrs.wis} FOW:${attrs.fow}${attrs.te !== undefined ? ` TE:${attrs.te}` : ""} (${total}/10 points used)`,
      );
    },
    { role: "player" },
  );

  safeTool(
    server,
    "set_abilities",
    "Set spells/abilities for a character. Must match valid spells for their class.",
    {
      character_id: z.number().describe("Character ID"),
      abilities: z
        .array(
          z.object({
            name: z.string().describe("Spell/ability name (must exist for the character class)"),
          }),
        )
        .describe("Array of ability names to set"),
    },
    async ({ character_id, abilities }) => {
      const charId = character_id as number;
      const abilityList = abilities as Array<{ name: string }>;

      const char = asRecord(await charactersApi.getCharacter(
        client,
        token,
        charId,
      ));

      if (char.abilities_locked) {
        return text("ERROR: Abilities are already locked and cannot be changed.");
      }

      const charData = (char.data ?? {}) as Record<string, unknown>;
      const charClass = charData.class as string | undefined;
      if (!charClass) {
        return text("ERROR: Character has no class set. Set race/class first.");
      }

      const gameDataRaw = gd();
      const classSpells = gameDataRaw.spells[charClass];
      if (!classSpells) {
        return text(`ERROR: No spells found for class "${charClass}".`);
      }

      const classInfo = gameDataRaw.classes.data[charClass];
      const startingEquip = classInfo?.startingEquipment as
        | Record<string, unknown>
        | undefined;
      const maxSlots = (startingEquip?.abilities as number) || 3;

      if (abilityList.length > maxSlots) {
        return text(
          `ERROR: Class "${charClass}" only has ${maxSlots} ability slots, but ${abilityList.length} abilities were provided.`,
        );
      }

      const spells: SpellSlot[] = [];
      const applied: string[] = [];

      for (const { name } of abilityList) {
        const spell = classSpells.find((s) => s.name === name);
        if (!spell) {
          return text(
            `ERROR: Spell "${name}" is not valid for class "${charClass}". Valid spells: ${classSpells.map((s) => s.name).join(", ")}`,
          );
        }
        spells.push({ name: spell.name, selected: true });
        applied.push(spell.name);
      }

      charData.spells = spells;

      await charactersApi.updateCharacter(client, token, charId, {
        name: char.name as string || "Unnamed",
        data: charData,
      });

      return text(`Abilities set:\n${applied.join("\n")}`);
    },
    { role: "player" },
  );

  safeTool(
    server,
    "spend_xp",
    'Spend this character\'s earned XP to raise attributes and/or skills past the creation cap. Values are POINTS TO ADD (deltas), NOT target values -- e.g. {"Strength": 1} raises Strength by 1. Each point costs the system\'s XP-per-point and is rejected if the character lacks enough unspent XP. This is the ONLY way to raise stats after they are locked. Use exact attribute/skill names (see get_my_character or get_game_data).',
    {
      character_id: z.number().describe("Character ID"),
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
      const attrs = (attributes ?? {}) as Record<string, number>;
      const sk = (skills ?? {}) as Record<string, number>;
      if (Object.keys(attrs).length === 0 && Object.keys(sk).length === 0) {
        return text("ERROR: Provide at least one attribute or skill to raise (points to add).");
      }
      try {
        const updated = asRecord(
          await charactersApi.spendXp(client, token, character_id as number, {
            attributes: attrs,
            skills: sk,
          }),
        );
        const spent =
          Object.values(attrs).reduce((s, v) => s + v, 0) +
          Object.values(sk).reduce((s, v) => s + v, 0);
        const raised = [
          ...Object.entries(attrs).map(([k, v]) => `${k} +${v}`),
          ...Object.entries(sk).map(([k, v]) => `${k} +${v}`),
        ].join(", ");
        return text(
          `Spent ${spent} XP point(s): ${raised}. Character XP total ${updated.xp ?? "?"}, spent ${updated.xp_spent ?? "?"}.`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith("API 400")) {
          return text(
            "ERROR: Could not spend XP -- not enough unspent XP, or an unknown attribute/skill name. Check available XP with get_my_character and use exact names.",
          );
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
      character_id: z.number().describe("Character ID"),
      step: z
        .enum(["raceClass", "attributes", "abilities"])
        .describe("Step to lock"),
    },
    async ({ character_id, step }) => {
      const result = asRecord(await charactersApi.lockCharacterStep(
        client,
        token,
        character_id as number,
        step as string,
        true,
      ));
      return text(
        (result.message as string) || `Locked step "${step}" for character ${character_id}.`,
      );
    },
    { role: "player" },
  );

  safeTool(
    server,
    "equip_weapon",
    "Equip a weapon in a slot (1-3). Auto-fills attack, damage, range, and break from game data.",
    {
      character_id: z.number().describe("Character ID"),
      slot: z.number().min(1).max(3).describe("Weapon slot (1-3)"),
      weapon_name: z.string().describe("Weapon name (must exist in game data)"),
    },
    async ({ character_id, slot, weapon_name }) => {
      const charId = character_id as number;
      const slotNum = slot as number;
      const wName = weapon_name as string;

      const gameDataRaw = gd();
      const weaponInfo = gameDataRaw.weapons.weapons.find((w) => w.name === wName);

      if (!weaponInfo) {
        return text(
          `ERROR: Unknown weapon "${wName}". Use get_game_data("weapons") to see valid weapons.`,
        );
      }

      const char = asRecord(await charactersApi.getCharacter(
        client,
        token,
        charId,
      ));
      const data = (char.data ?? {}) as Record<string, unknown>;

      const weapons = (data.equippedWeapons as EquippedWeapon[] | undefined) ?? [];
      const idx = slotNum - 1;

      const entry: EquippedWeapon = {
        name: wName,
        damage: weaponInfo.damage || "",
        bonus: weaponInfo.bonus || "",
        range: weaponInfo.range || "",
        break: weaponInfo.break ?? 0,
      };

      while (weapons.length <= idx) {
        weapons.push({ name: "", damage: "", bonus: "", range: "", break: 0 });
      }
      weapons[idx] = entry;

      data.equippedWeapons = weapons.filter((w) => w.name);

      await charactersApi.updateCharacter(client, token, charId, {
        name: char.name as string || "Unnamed",
        data,
      });

      return text(
        `Equipped ${wName} in slot ${slotNum} (ATK:${weaponInfo.bonus} DMG:${weaponInfo.damage} RNG:${weaponInfo.range} BRK:${weaponInfo.break})`,
      );
    },
    { role: "player" },
  );

  safeTool(
    server,
    "equip_armor",
    "Equip armor or shield. Slot: 1=Head, 2=Shoulders, 3=Chest, 4=Hands, 5=Legs, 6=Feet. Auto-fills HP, AC, disadvantage.",
    {
      character_id: z.number().describe("Character ID"),
      slot: z
        .number()
        .min(1)
        .max(6)
        .optional()
        .describe("Armor slot: 1=Head, 2=Shoulders, 3=Chest, 4=Hands, 5=Legs, 6=Feet"),
      armor_name: z
        .string()
        .optional()
        .describe("Armor name (must exist in game data)"),
      shield_name: z
        .string()
        .optional()
        .describe("Shield name (must exist in game data)"),
    },
    async ({ character_id, slot, armor_name, shield_name }) => {
      const charId = character_id as number;

      const gameDataRaw = gd();

      const char = asRecord(await charactersApi.getCharacter(
        client,
        token,
        charId,
      ));
      const data = (char.data ?? {}) as Record<string, unknown>;
      const results: string[] = [];

      if (armor_name && slot) {
        const aName = armor_name as string;
        const slotNum = slot as number;
        const armorInfo = gameDataRaw.armor.armor.find((a) => a.name === aName);
        if (!armorInfo) {
          return text(
            `ERROR: Unknown armor "${aName}". Use get_game_data("armor") to see valid armor.`,
          );
        }

        const slotNames = getSlotNames();
        const bodypart = slotNames[slotNum]?.toLowerCase() || "unknown";
        const armorArr = (data.equippedArmor as EquippedArmor[] | undefined) ?? [];

        const existingIdx = armorArr.findIndex((a) => a.bodypart === bodypart);
        const entry: EquippedArmor = {
          name: aName,
          bodypart,
          ac: armorInfo.ac ?? 0,
          hp: armorInfo.hp ?? 0,
          maxHp: armorInfo.hp ?? 0,
          disadvantage: armorInfo.disadvantage ?? null,
        };

        if (existingIdx >= 0) {
          armorArr[existingIdx] = entry;
        } else {
          armorArr.push(entry);
        }

        data.equippedArmor = armorArr;
        results.push(
          `Equipped ${aName} on ${slotNames[slotNum]} (HP:${armorInfo.hp} AC:${armorInfo.ac})`,
        );
      }

      if (shield_name) {
        const sName = shield_name as string;
        const shieldInfo = gameDataRaw.shields.find((s) => s.name === sName);
        if (!shieldInfo) {
          return text(
            `ERROR: Unknown shield "${sName}". Use get_game_data("shields") to see valid shields.`,
          );
        }
        data.equippedShield = {
          name: sName,
          ac: shieldInfo.ac ?? 0,
          hp: shieldInfo.hp ?? 0,
          maxHp: shieldInfo.hp ?? 0,
          damage: shieldInfo.damage || "",
          disadvantage: shieldInfo.disadvantage ?? null,
        } as EquippedShield;
        results.push(`Equipped ${sName} (HP:${shieldInfo.hp} AC:${shieldInfo.ac})`);
      }

      if (results.length === 0) {
        return text("ERROR: Must provide either armor_name+slot or shield_name.");
      }

      await charactersApi.updateCharacter(client, token, charId, {
        name: char.name as string || "Unnamed",
        data,
      });

      return text(results.join("\n"));
    },
    { role: "player" },
  );

  // =========================================================================
  // Gameplay
  // =========================================================================

  safeTool(
    server,
    "update_hp",
    "Update HP, arcana, willpower, worthiness, bleed, weakened, or injuries for a character",
    {
      character_id: z.number().describe("Character ID"),
      hp: z.number().min(0).max(99).optional().describe("Set HP value (0-99)"),
      arcana: z
        .number()
        .min(0)
        .max(20)
        .optional()
        .describe("Set arcana value (0-20)"),
      willpower: z.number().min(0).max(3).optional().describe("Set willpower (0-3)"),
      worthiness: z
        .number()
        .min(-10)
        .max(10)
        .optional()
        .describe("Set worthiness (-10 to 10)"),
      bleed: z.number().min(0).max(6).optional().describe("Set bleed level (0-6)"),
      weakened: z
        .number()
        .min(0)
        .max(6)
        .optional()
        .describe("Set weakened level (0-6)"),
      injuries: z.string().optional().describe("Injury description text"),
    },
    async ({ character_id, hp, arcana, willpower, worthiness, bleed, weakened, injuries }) => {
      const charId = character_id as number;
      const char = asRecord(await charactersApi.getCharacter(
        client,
        token,
        charId,
      ));
      const data = (char.data ?? {}) as Record<string, unknown>;
      const changes: string[] = [];

      if (hp !== undefined) {
        data.hp = hp;
        changes.push(`HP->${hp}`);
      }
      if (arcana !== undefined) {
        data.arcana = arcana;
        changes.push(`Arcana->${arcana}`);
      }
      if (willpower !== undefined) {
        data.willpower = willpower;
        changes.push(`Willpower->${willpower}`);
      }
      if (worthiness !== undefined) {
        data.worthiness = worthiness;
        changes.push(`Worthiness->${worthiness}`);
      }
      if (bleed !== undefined) {
        data.bleed = bleed;
        changes.push(`Bleed->${bleed}`);
      }
      if (weakened !== undefined) {
        data.weakened = weakened;
        changes.push(`Weakened->${weakened}`);
      }
      if (injuries !== undefined) {
        data.injuries = injuries;
        changes.push(`Injuries: ${injuries}`);
      }

      if (changes.length === 0) return text("No changes specified.");

      await charactersApi.updateCharacter(client, token, charId, {
        name: char.name as string || "Unnamed",
        data,
      });

      return text(
        `Updated: ${changes.join(", ")}\n\nReminder: Log what caused this change with add_event. If unsure about defense or healing rules, call get_rules.`,
      );
    },
    { role: "player" },
  );

  safeTool(
    server,
    "update_equipment_hp",
    "Update current HP for an armor piece or shield (track damage during combat)",
    {
      character_id: z.number().describe("Character ID"),
      equipment_index: z
        .number()
        .min(1)
        .max(6)
        .describe("Equipment index: 1=Head, 2=Shoulders, 3=Chest, 4=Hands, 5=Legs, 6=Shield"),
      hp: z.number().min(0).describe("New current HP value"),
    },
    async ({ character_id, equipment_index, hp }) => {
      const charId = character_id as number;
      const idx = equipment_index as number;
      const newHp = hp as number;

      const char = asRecord(await charactersApi.getCharacter(
        client,
        token,
        charId,
      ));
      const data = (char.data ?? {}) as Record<string, unknown>;
      let changeMsg: string;

      if (idx >= 1 && idx <= 5) {
        const slotNames = getSlotNames();
        const bodypart = slotNames[idx]?.toLowerCase() || "unknown";
        const armorArr = (data.equippedArmor as EquippedArmor[] | undefined) ?? [];
        const piece = armorArr.find((a) => a.bodypart === bodypart);

        if (!piece) {
          return text(`ERROR: No armor equipped on ${slotNames[idx] || `slot ${idx}`}.`);
        }

        if (piece.maxHp > 0 && newHp > piece.maxHp) {
          return text(
            `ERROR: HP (${newHp}) exceeds armor max HP (${piece.maxHp}) for ${slotNames[idx]}.`,
          );
        }

        piece.hp = newHp;
        data.equippedArmor = armorArr;
        changeMsg = `Armor (${slotNames[idx]}) HP->${newHp}/${piece.maxHp}${newHp <= 0 ? " BROKEN" : ""}`;
      } else {
        const shield = data.equippedShield as EquippedShield | null | undefined;
        if (!shield) {
          return text("ERROR: No shield equipped.");
        }
        if (shield.maxHp > 0 && newHp > shield.maxHp) {
          return text(
            `ERROR: HP (${newHp}) exceeds shield max HP (${shield.maxHp}).`,
          );
        }
        shield.hp = newHp;
        data.equippedShield = shield;
        changeMsg = `Shield HP->${newHp}/${shield.maxHp}${newHp <= 0 ? " BROKEN" : ""}`;
      }

      await charactersApi.updateCharacter(client, token, charId, {
        name: char.name as string || "Unnamed",
        data,
      });

      return text(
        `Updated: ${changeMsg}\n\nReminder: Log what caused this equipment damage with add_event.`,
      );
    },
    { role: "player" },
  );

  safeTool(
    server,
    "update_inventory",
    "Update gold or food for a character",
    {
      character_id: z.number().describe("Character ID"),
      gold: z.number().optional().describe("Set gold amount"),
      food: z.number().optional().describe("Set food amount"),
    },
    async ({ character_id, gold, food }) => {
      const charId = character_id as number;
      const char = asRecord(await charactersApi.getCharacter(
        client,
        token,
        charId,
      ));
      const data = (char.data ?? {}) as Record<string, unknown>;
      const changes: string[] = [];

      if (gold !== undefined) {
        data.gold = gold;
        changes.push(`Gold->${gold}`);
      }
      if (food !== undefined) {
        data.food = food;
        changes.push(`Food->${food}`);
      }

      if (changes.length === 0) return text("No changes specified.");

      await charactersApi.updateCharacter(client, token, charId, {
        name: char.name as string || "Unnamed",
        data,
      });

      return text(`Updated: ${changes.join(", ")}`);
    },
    { role: "player" },
  );

  safeTool(
    server,
    "add_notes",
    "Add text to the character's notes or inventory freetext",
    {
      character_id: z.number().describe("Character ID"),
      text: z.string().describe("Text to append"),
      field: z
        .enum(["inventory", "notes"])
        .describe("Which field: inventory (additional gear/items) or notes (quest notes)"),
    },
    async ({ character_id, text: noteText, field }) => {
      const charId = character_id as number;
      const char = asRecord(await charactersApi.getCharacter(
        client,
        token,
        charId,
      ));
      const data = (char.data ?? {}) as Record<string, unknown>;

      const fieldId =
        field === "inventory" ? "inventory_freetext" : "notes_freetext";
      const current = (data[fieldId] as string) || "";
      const newValue = current ? current + "\n" + (noteText as string) : (noteText as string);

      if (newValue.length > 10000) {
        return text(
          `WARNING: ${field} field is very large (${newValue.length} chars). Consider summarizing old notes. Text was still added.`,
        );
      }

      data[fieldId] = newValue;

      await charactersApi.updateCharacter(client, token, charId, {
        name: char.name as string || "Unnamed",
        data,
      });

      return text(`Added to ${field}: "${noteText}"`);
    },
    { role: "player" },
  );

  safeTool(
    server,
    "update_relationships",
    "Update NPC relationships on a character sheet. Replaces the entire list.",
    {
      character_id: z.number().describe("Character ID"),
      relationships: z
        .array(
          z.object({
            name: z.string().describe("NPC name"),
            relation: z
              .string()
              .optional()
              .describe("Relation type (e.g. Ally, Rival, Mentor, Enemy)"),
            notes: z
              .string()
              .optional()
              .describe("Notes about this relationship"),
          }),
        )
        .describe("Array of relationships (replaces all existing)"),
    },
    async ({ character_id, relationships }) => {
      const charId = character_id as number;
      const rels = relationships as Array<{
        name: string;
        relation?: string;
        notes?: string;
      }>;

      const char = asRecord(await charactersApi.getCharacter(
        client,
        token,
        charId,
      ));
      const data = (char.data ?? {}) as Record<string, unknown>;

      const valid = rels.filter((r) => r.name && r.name.trim());
      if (valid.length === 0 && rels.length > 0) {
        return text("ERROR: Each relationship must have at least a name.");
      }

      data.relationships = valid.map((r) => ({
        name: r.name,
        relation: r.relation || "",
        notes: r.notes || "",
        archived: false,
      }));

      await charactersApi.updateCharacter(client, token, charId, {
        name: char.name as string || "Unnamed",
        data,
      });

      return text(
        `Updated relationships (${valid.length} entries): ${valid.map((r) => r.name).join(", ")}`,
      );
    },
    { role: "player" },
  );
}
