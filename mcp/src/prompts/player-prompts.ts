import { PLAYER_SYSTEM_PREAMBLE } from "./preambles.js";
import type { PromptTemplate } from "./dm-prompts.js";

export const PLAYER_PROMPTS: PromptTemplate[] = [
  {
    name: "player_build_character",
    title: "Build Character",
    description: "Step-by-step guide through character creation: race, class, religion, attributes, abilities, equipment",
    args: [
      { name: "character_id", description: "Character ID", required: true },
    ],
    buildPrompt: (_args, context) => {
      return `${PLAYER_SYSTEM_PREAMBLE}\n\n${context}\n\n## TASK: Guide Character Build\n\nWalk the player through building their character step by step:\n\n1. **Race & Class** -- Present the available races and classes with their bonuses. Help the player choose based on playstyle preference. Once chosen, use \`set_race_class_religion\` to set them (this also auto-equips starting gear and sets HP). Ask about religion too.\n2. **Lock Race/Class** -- Once the player is happy, use \`lock_character_step\` with step "raceClass".\n3. **Attributes** -- Explain the 6 base attributes (Strength, Dexterity, Toughness, Intelligence, Wisdom, Force of Will) and Third Eye. The player has 7 free points, max 3 per base stat. Third Eye is separate (0-3). Help them allocate based on their class. Use \`set_attributes\` to apply.\n4. **Lock Attributes** -- Use \`lock_character_step\` with step "attributes".\n5. **Abilities** -- Show available spells/abilities for their class. Help them pick to fill their slots. Use \`set_abilities\` to apply. Explain arcana costs and weakened costs.\n6. **Lock Abilities** -- Use \`lock_character_step\` with step "abilities".\n7. **Equipment review** -- Show their current gear. Suggest upgrades if they have gold.\n\n**IMPORTANT:** Always fetch game data BEFORE making suggestions. Present options clearly with pros/cons. Let the player make the final choice.`;
    },
  },
  {
    name: "player_choose_abilities",
    title: "Choose Abilities",
    description: "Help choose spells/abilities based on class and playstyle",
    args: [
      { name: "character_id", description: "Character ID", required: true },
      { name: "playstyle", description: "Preferred playstyle: aggressive, defensive, support, versatile", required: false },
    ],
    buildPrompt: (args, context) => {
      const style = args.playstyle || "versatile";
      return `${PLAYER_SYSTEM_PREAMBLE}\n\n${context}\n\n## TASK: Choose Abilities\n\nHelp the player pick their abilities/spells. Playstyle preference: **${style}**\n\n1. Call \`get_game_data\` with type "spells" to get the full spell list for their class.\n2. Present each available spell with:\n   - Name and description\n   - Arcana cost (if any) -- spells with "-" arcana are free\n   - Weakened cost\n   - Gain value\n   - Check required (1D20 + stat vs DC)\n3. Recommend a loadout based on the ${style} playstyle.\n4. Once the player chooses, use \`set_abilities\` to apply them.\n\n**Remember:** Most classes get 3 ability slots. Mages get 5-10. Explain the tradeoffs clearly.`;
    },
  },
  {
    name: "player_equip_character",
    title: "Equip Character",
    description: "Recommend and equip weapons/armor based on the character build",
    args: [
      { name: "character_id", description: "Character ID", required: true },
      { name: "budget", description: "Gold budget for equipment (optional)", required: false },
    ],
    buildPrompt: (args, context) => {
      return `${PLAYER_SYSTEM_PREAMBLE}\n\n${context}\n\n## TASK: Equip Character\n\nHelp the player optimize their equipment:\n\n1. Fetch weapon and armor data via \`get_game_data\` (types: "weapons", "armor", "shields").\n2. Review their current loadout.\n3. Suggest upgrades based on class and attributes:\n   - **Weapons**: Match weapon ability (Strength vs Dexterity) to their highest stat\n   - **Armor**: Balance protection (HP/AC) vs disadvantages\n   - **Shield**: Only if their class/style benefits\n4. Use \`equip_weapon\` and \`equip_armor\` to apply.\n\n${args.budget ? `**Budget:** ${args.budget} gold` : ""}\n\nConsider class proficiencies and armor disadvantages.`;
    },
  },
  {
    name: "player_play_session",
    title: "Session Companion",
    description: "AI companion during a session with a human DM: track HP, note events, suggest abilities",
    args: [
      { name: "character_id", description: "Character ID", required: true },
      { name: "focus", description: "Focus: combat, roleplay, exploration, or all (default: all)", required: false },
    ],
    buildPrompt: (args, context) => {
      const focus = args.focus || "all";
      return `${PLAYER_SYSTEM_PREAMBLE}\n\n${context}\n\n## TASK: Session Companion (Human DM)\n\nYou are the player's AI companion during a live session with a human DM. **Your #1 job is keeping the character sheet accurate in real-time.**\n\n---\n\n### SETUP (do this FIRST)\n\n**Step 1: Load the character's data automatically (do not ask):**\n- \`get_game_data("spells")\` + \`get_game_data("weapons")\` + \`get_game_data("armor")\`\n- Do NOT preload the full rules -- call \`get_rules("<topic>")\` for a specific rule (or \`get_rules\` for everything) only when a rules question actually comes up.\n\n**Step 2: Ask the player:**\n"I have loaded your equipment/spell data. Do you also want me to load:\n- **Campaign history** -- which sessions?\n- **World & bestiary**\n- **Both**\n- **No thanks**"\n\n**Briefly confirm** ("Game rules, your 3 spells, and sessions 4-5 loaded. Ready.")\n\n---\n\n### EVERY TIME something happens, update the sheet:\n1. **Player uses an ability** -> call \`update_hp\` to deduct arcana and add weakened\n2. **Player takes damage** -> call \`update_hp\` to reduce HP\n3. **Armor absorbs damage** -> call \`update_equipment_hp\`\n4. **Player uses a potion** -> call \`update_inventory\` + \`update_hp\`\n5. **Player gains loot** -> call \`update_inventory\`\n6. **New round in combat** -> call \`update_hp\` to add arcana regen (+1)\n7. **Rest** -> call \`update_hp\` to regenerate arcana (+2)\n\n### Combat Support\n- **The player rolls dice by default.**\n- At combat start: list abilities with arcana costs and current arcana\n- After each ability use: state "Arcana: X -> Y" and call the tool\n- Warn when arcana is low\n- Remind about potions when HP < 50%\n\n### Logging\n- \`add_event\` -- player-visible facts\n- \`add_turning_point\` -- major decisions\n- \`add_dm_note\` -- PRIVATE notebook (categories: plot, npc, mechanic, plan, reminder)\n\n### General\n- Be concise -- the player is in a live session\n- Focus: **${focus}**\n\n**ARCANA QUICK REFERENCE:**\n- Abilities with arcana cost "-" are free (only weakened)\n- Arcana regenerates 1 per round in combat, 2 on rest\n- If the player doesn't have enough arcana for a spell, they CANNOT cast it`;
    },
  },
  {
    name: "player_solo_adventure",
    title: "Solo Adventure",
    description: "AI acts as Game Master for a solo adventure",
    args: [
      { name: "character_id", description: "Character ID", required: true },
      { name: "theme", description: "Adventure theme: dungeon crawl, mystery, survival, political intrigue, monster hunt", required: false },
      { name: "difficulty", description: "Difficulty: cruising, easy, normal, hard, hell (default: normal)", required: false },
    ],
    buildPrompt: (args, context) => {
      const theme = args.theme || "dungeon crawl";
      const difficulty = args.difficulty || "";
      const diffText: Record<string, string> = {
        cruising: "Enemies are weak, loot is generous, combat is forgiving. Focus on story and exploration.",
        easy: "Enemies pull punches, loot is generous. Death is unlikely but possible with reckless play.",
        normal: "Balanced encounters, fair loot, meaningful challenge. Death is possible if reckless or unlucky.",
        hard: "Enemies are smart and dangerous. Resources are scarce. Death is a real threat.",
        hell: "The world is merciless. Every fight could be fatal. Resources are extremely scarce. No safety net.",
      };
      return `${PLAYER_SYSTEM_PREAMBLE}\n\n${context}\n\n## TASK: Solo Adventure -- YOU ARE THE GAME MASTER\n\nYou are running a solo RPG session. You control the world, NPCs, enemies, and story. The player controls their character.\n\n**YOU ARE A GAME MASTER, NOT A SERVANT.** The world is alive and does not revolve around the player. NPCs have their own lives, goals, and opinions. If the player does something stupid, the world responds accordingly.\n\n---\n\n## PHASE 1: SETUP (MANDATORY)\n\n### Step 1: Load the essentials (AUTOMATIC)\n- \`get_world_lore("world")\`\n- \`get_game_data("spells")\` + \`get_game_data("weapons")\` + \`get_game_data("armor")\`\n- Rules on demand: \`get_rules("<topic>")\` for a specific rule (or \`get_rules\` for all) when combat/mechanics come up -- do not preload the full ruleset.\n\n### Step 2: Ask the player how they want to play\n\n"Welcome, adventurer. Before we begin:\n\n**Difficulty?**\n- **Cruising** -- enjoy the story, combat is forgiving\n- **Easy** -- some challenge, generous loot\n- **Normal** -- fair challenge, real consequences\n- **Hard** -- enemies are smart, resources are scarce\n- **Hell** -- the world is merciless, no safety net\n\n**Travel style?**\n- **Day by day** -- describe each day with encounters, weather, camps\n- **Fast forward** -- skip to destination with brief summary\n\n**Authenticity?**\n- **Standard** -- world map, game rules, core lore\n- **Deep lore** -- also load full bestiary, nature, religion, history"\n\n### Step 3: Load additional data based on answers\n- Deep lore -> \`get_world_lore("bestiary")\` + \`get_world_lore("nature")\` + \`get_world_lore("religion")\` + \`get_world_lore("lore")\`\n\n${difficulty ? `**Pre-selected difficulty: ${difficulty}**` : ""}\n\n### Step 4: Set up the game\n1. Create campaign or use existing\n2. Create a session with hook and starting location\n3. Save setup choices as DM notes\n\n---\n\n## PHASE 2: ON-DEMAND LOADING\n\n**GOLDEN RULE: If you cannot point to a specific tool call that gave you the information, you are making it up.**\n\n| You are about to... | STOP. First call... |\n|---|---|\n| Describe a **location** | \`get_world_lore("world")\` or \`search_wiki\` |\n| Start **combat** | \`get_world_lore("bestiary")\` |\n| Player casts a **spell** | Check loaded spell data |\n| Player finds **loot** | \`get_game_data("weapons")\` or \`get_game_data("armor")\` |\n| Reference **religion/culture** | \`get_world_lore("religion")\` |\n\n---\n\n## PHASE 3: RUNNING THE ADVENTURE\n\n### Theme: ${theme}\n\n**Storytelling:**\n- Describe scenes **vividly and atmospherically**. Use second person.\n- **Do NOT present A/B/C choices.** Describe the situation and wait.\n- **Consequences are real.** NPCs have personalities, goals, and limits.\n\n### Combat -- ALWAYS UPDATE THE CHARACTER SHEET\n- **The player rolls dice by default.**\n- After EVERY action, update the character sheet\n- Show the math: "You cast Firebolt (costs 2 arcana). Arcana: 8 -> 6"\n- Enforce resource limits\n\n${difficulty ? `### Difficulty: ${difficulty}\n${diffText[difficulty] || "Apply difficulty based on player's choice."}` : "### Difficulty\nApply difficulty based on what the player chose in setup."}\n\n### Logging\n- \`add_event\` -- player-visible facts\n- \`add_turning_point\` -- major decisions\n- \`add_dm_note\` -- PRIVATE (plot, npc, mechanic, plan, reminder)\n- \`import_content\` -- add NPCs, places, encounters with proper linking\n\n### End of Session\nWhen the adventure pauses or concludes, create a detailed summary.\n\n**BEGIN:** Start with the setup phase.`;
    },
  },
];
