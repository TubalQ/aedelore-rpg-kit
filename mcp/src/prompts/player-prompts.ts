import { playerPreamble } from "./preambles.js";
import type { PromptTemplate } from "./dm-prompts.js";

export const PLAYER_PROMPTS: PromptTemplate[] = [
  {
    name: "player_build_character",
    title: "Build Character",
    description: "Step-by-step guide through character creation: race, class, religion, attributes, abilities, equipment",
    args: [
      { name: "character_id", description: "Character ID", required: true },
    ],
    buildPrompt: (_args, context, profile) => {
      return `${playerPreamble(profile)}\n\n${context}\n\n## TASK: Guide Character Build\n\nWalk the player through building their character step by step:\n\n1. **Race & Class** -- Present the available races and classes with their bonuses. Help the player choose based on playstyle preference. Once chosen, use \`build_character\` with race and character_class to set them (this also auto-equips starting gear and sets HP). Ask about religion too.\n2. **Lock Race/Class** -- Once the player is happy, use \`set_locks\` with race_class true.\n3. **Attributes** -- Explain the 6 base attributes (Strength, Dexterity, Toughness, Intelligence, Wisdom, Force of Will) and Third Eye. The player has 7 free points, max 3 per base stat. Third Eye is separate (0-3). Help them allocate based on their class. Use \`build_character\` with attributes (and skills) to apply.\n4. **Lock Attributes** -- Use \`set_locks\` with attributes true.\n5. **Abilities** -- Show available spells/abilities for their class. Help them pick to fill their slots. Use \`build_character\` with abilities to apply. Explain arcana costs and weakened costs.\n6. **Lock Abilities** -- Use \`set_locks\` with abilities true.\n7. **Equipment review** -- Show their current gear. Suggest upgrades if they have gold.\n\n**IMPORTANT:** Always fetch game data BEFORE making suggestions. Present options clearly with pros/cons. Let the player make the final choice.`;
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
    buildPrompt: (args, context, profile) => {
      const style = args.playstyle || "versatile";
      return `${playerPreamble(profile)}\n\n${context}\n\n## TASK: Choose Abilities\n\nHelp the player pick their abilities/spells. Playstyle preference: **${style}**\n\n1. Call \`get_game_data\` with type "spells" to get the full spell list for their class.\n2. Present each available spell with:\n   - Name and description\n   - Arcana cost (if any) -- spells with "-" arcana are free\n   - Weakened cost\n   - Gain value\n   - Check required (1D20 + stat vs DC)\n3. Recommend a loadout based on the ${style} playstyle.\n4. Once the player chooses, use \`build_character\` with abilities to apply them.\n\n**Remember:** Most classes get 3 ability slots. Mages get 5-10. Explain the tradeoffs clearly.`;
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
    buildPrompt: (args, context, profile) => {
      return `${playerPreamble(profile)}\n\n${context}\n\n## TASK: Equip Character\n\nHelp the player optimize their equipment:\n\n1. Fetch weapon and armor data via \`get_game_data\` (types: "weapons", "armor", "shields").\n2. Review their current loadout.\n3. Suggest upgrades based on class and attributes:\n   - **Weapons**: Match weapon ability (Strength vs Dexterity) to their highest stat\n   - **Armor**: Balance protection (HP/AC) vs disadvantages\n   - **Shield**: Only if their class/style benefits\n4. Use \`equip\` to apply.\n\n${args.budget ? `**Budget:** ${args.budget} gold` : ""}\n\nConsider class proficiencies and armor disadvantages.`;
    },
  },
  {
    name: "player_play_session",
    profiles: ["full", "play"],
    title: "Session Companion",
    description: "AI companion during a session with a human DM: track HP, note events, suggest abilities",
    args: [
      { name: "character_id", description: "Character ID", required: true },
      { name: "focus", description: "Focus: combat, roleplay, exploration, or all (default: all)", required: false },
    ],
    buildPrompt: (args, context, profile) => {
      const focus = args.focus || "all";
      return `${playerPreamble(profile)}\n\n${context}\n\n## TASK: Session Companion (Human DM)\n\nYou are the player's AI companion during a live session with a human DM. **Your #1 job is keeping the character sheet accurate in real-time.**\n\n---\n\n### SETUP (do this FIRST)\n\n**Step 1: Load the character's data automatically (do not ask):**\n- \`get_game_data("spells")\` + \`get_game_data("weapons")\` + \`get_game_data("armor")\`\n- Do NOT preload the full rules -- call \`get_rules("<topic>")\` for a specific rule (or \`get_rules\` for everything) only when a rules question actually comes up.\n\n**Step 2: Ask the player:**\n"I have loaded your equipment/spell data. Do you also want me to load:\n- **Campaign history** -- which sessions?\n- **World & bestiary**\n- **Both**\n- **No thanks**"\n\n**Briefly confirm** ("Game rules, your 3 spells, and sessions 4-5 loaded. Ready.")\n\n---\n\n### EVERY TIME something happens, update the sheet:\n1. **Player uses an ability** -> call \`update_character\` with the new arcana and weakened\n2. **Player takes damage** -> call \`update_character\` with the new hp\n3. **Armor absorbs damage** -> call \`update_character\` with armor_piece + armor_hp\n4. **Player uses a potion** -> call \`update_character\` with the new food/gold and hp\n5. **Player gains loot** -> call \`update_character\` with gold or food\n6. **New round in combat** -> call \`update_character\` with arcana +1\n7. **Rest** -> call \`update_character\` with arcana +2\n\n### Combat Support\n- **The player rolls dice by default.**\n- At combat start: list abilities with arcana costs and current arcana\n- After each ability use: state "Arcana: X -> Y" and call the tool\n- Warn when arcana is low\n- Remind about potions when HP < 50%\n\n### Logging\n- \`log\` kind "event" -- player-visible facts (day + time from \`get_table\`)\n- \`log\` kind "turning_point" -- major decisions\n- \`log\` kind "dm_note" -- PRIVATE notebook (categories: plot, npc, mechanic, plan, reminder)\n\n### General\n- Be concise -- the player is in a live session\n- Focus: **${focus}**\n\n**ARCANA QUICK REFERENCE:**\n- Abilities with arcana cost "-" are free (only weakened)\n- Arcana regenerates 1 per round in combat, 2 on rest\n- If the player doesn't have enough arcana for a spell, they CANNOT cast it`;
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
    buildPrompt: (args, context, profile) => {
      const theme = args.theme || "dungeon crawl";
      const difficulty = args.difficulty || "";
      const diffText: Record<string, string> = {
        cruising: "Enemies are weak, loot is generous, combat is forgiving. Focus on story and exploration.",
        easy: "Enemies pull punches, loot is generous. Death is unlikely but possible with reckless play.",
        normal: "Balanced encounters, fair loot, meaningful challenge. Death is possible if reckless or unlucky.",
        hard: "Enemies are smart and dangerous. Resources are scarce. Death is a real threat.",
        hell: "The world is merciless. Every fight could be fatal. Resources are extremely scarce. No safety net.",
      };
      return `${playerPreamble(profile)}\n\n${context}\n\n## TASK: Solo Adventure -- YOU ARE THE GAME MASTER\n\nYou are running a solo RPG session. You control the world, NPCs, enemies, and story. The player controls their character.\n\n**YOU ARE A GAME MASTER, NOT A SERVANT.** The world is alive and does not revolve around the player. NPCs have their own lives, goals, and opinions. If the player does something stupid, the world responds accordingly.\n\n---\n\n## PHASE 1: SETUP (MANDATORY)\n\n### Step 1: Orient (do not preload)\n- \`list_campaigns\` and \`get_character\` for the player's character\n- Look up the rest when it comes up: \`get_rules(section)\` for a ruling (\`get_rules\` alone gives the contents and the DM cheat sheet), \`get_game_data\` for the character's spells and gear, \`get_world_lore\` for places and creatures.\n\n### Step 2: Ask the player how they want to play (ASK MODE FIRST -- do not start the story until they answer)\n\n"Welcome, adventurer. Before we begin:\n\n**What kind of session do you want?**\n- **Strict canon** -- full lore weight, the world's signature threats and deep history, deadly and morally heavy\n- **Adventure & heroism** -- heroic tone, lower lethality, action and discovery; lore as seasoning\n- **Everyday & roleplay** -- low stakes, character-driven, ordinary life in the world; rarely combat\n- **Horror & survival** -- dark, resource-starved, dangerous; dread over heroism\n- Or tell me your own tone.\n\nThis choice sets the lore weight, lethality, and tone. In the lighter modes I keep the heavy cosmic canon (the Void, the Sunken City, Malcath and the like) in the background unless you reach for it, and draw the world from its wider breadth instead.\n\n**Difficulty?**\n- **Cruising** -- enjoy the story, combat is forgiving\n- **Easy** -- some challenge, generous loot\n- **Normal** -- fair challenge, real consequences\n- **Hard** -- enemies are smart, resources are scarce\n- **Hell** -- the world is merciless, no safety net\n\n**Travel style?**\n- **Day by day** -- describe each day with encounters, weather, camps\n- **Fast forward** -- skip to destination with brief summary\n\n**Authenticity?**\n- **Standard** -- world map, game rules, core lore\n- **Deep lore** -- I also read the indexes of the bestiary, nature, religion and history books"\n\n### Step 3: Load additional data based on answers\n- Deep lore / **Strict canon** -> \`get_world_lore("bestiary")\` + \`get_world_lore("nature")\` + \`get_world_lore("religion")\` + \`get_world_lore("lore")\`\n- **Adventure / Everyday / Horror modes** -> do NOT front-load the heavy cosmic lore. Pull threats and places on demand from the world's breadth (\`get_world_lore("bestiary")\` for lesser creatures, \`get_world_lore(<topic>)\` for the rest) so the session does not collapse into the same signature canon every time.\n\n${difficulty ? `**Pre-selected difficulty: ${difficulty}**` : ""}\n\n### Step 4: Set up the game\n1. Create a solo campaign with create_campaign (the player becomes its DM, so the logging tools below work). Reuse an existing campaign only if the player is its DM\n2. Create a session (create_session), then set its hook with update_session and plan the first scene with add_to_session or import_content\n3. Save setup choices with log kind "dm_note"\n4. Play from get_table\n\n---\n\n## PHASE 2: ON-DEMAND LOADING\n\n**GOLDEN RULE: If you cannot point to a specific tool call that gave you the information, you are making it up.**\n\n| You are about to... | STOP. First call... |\n|---|---|\n| Describe a **location** | \`get_world_lore("the world")\` or \`get_world_lore(<place>)\` |\n| Start **combat** | \`get_world_lore("bestiary")\` |\n| Player casts a **spell** | Check loaded spell data |\n| Player finds **loot** | \`get_game_data("weapons")\` or \`get_game_data("armor")\` |\n| Reference **religion/culture** | \`get_world_lore("religion")\` |\n\n---\n\n## PHASE 3: RUNNING THE ADVENTURE\n\n### Theme: ${theme}\n\n**Honor the chosen mode throughout:** let it govern lore weight, lethality, and tone. Do not drift a light Adventure or Everyday session into heavy cosmic canon, and do not soften a Strict-canon or Horror session into comfort. And remember: you are the Game Master, fair but firm -- the player advances the story through their character and the dice, not by talking you around.\n\n**Storytelling:**\n- Describe scenes **vividly and atmospherically**. Use second person.\n- **Do NOT present A/B/C choices.** Describe the situation and wait.\n- **Consequences are real.** NPCs have personalities, goals, and limits.\n\n### Combat -- ALWAYS UPDATE THE CHARACTER SHEET\n- **The player rolls dice by default.**\n- After EVERY action, update the character sheet\n- Show the math: "You cast Firebolt (costs 2 arcana). Arcana: 8 -> 6"\n- Enforce resource limits\n\n${difficulty ? `### Difficulty: ${difficulty}\n${diffText[difficulty] || "Apply difficulty based on player's choice."}` : "### Difficulty\nApply difficulty based on what the player chose in setup."}\n\n### Logging\n- \`log\` kind "event" -- player-visible facts (day + time from \`get_table\`)\n- \`log\` kind "turning_point" -- major decisions\n- \`log\` kind "dm_note" -- PRIVATE (plot, npc, mechanic, plan, reminder)\n- \`add_to_session\` -- a new NPC, place or encounter you introduce (\`import_content\` for many)\n\n### End of Session\nWhen the adventure pauses or concludes, create a detailed summary.\n\n**BEGIN:** Start with the setup phase.`;
    },
  },
];
