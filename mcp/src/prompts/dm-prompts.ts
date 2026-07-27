import { SYSTEM_PREAMBLE } from "./preambles.js";
import { IMPORT_FORMAT } from "./import-format.js";

export interface PromptTemplate {
  name: string;
  title: string;
  description: string;
  args: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  buildPrompt: (args: Record<string, string>, context: string) => string;
}

export const DM_PROMPTS: PromptTemplate[] = [
  {
    name: "plan_session",
    title: "Plan Session",
    description: "Help plan the next session with hooks, NPCs, encounters, and read-aloud text",
    args: [
      { name: "campaign_id", description: "Campaign ID", required: true },
      { name: "session_type", description: "Session type: mixed, combat, or roleplay (default: mixed)", required: false },
      { name: "session_length", description: "Session length in hours (default: 3)", required: false },
      { name: "instructions", description: "Additional instructions or focus areas", required: false },
    ],
    buildPrompt: (args, context) => {
      const type = args.session_type || "mixed";
      const hours = parseInt(args.session_length) || 3;
      return `${SYSTEM_PREAMBLE}\n\n${context}\n\n${IMPORT_FORMAT}\n\n## TASK: Plan Next Session\n\nSession type: ${type} | Length: ~${hours} hours\n\nHelp me plan my next session. Structure it as a **journey through places at specific times**:\n\n1. **A hook/goal** for the session\n2. **2-4 places** the party will visit, each assigned to a day and time of day\n3. **2-3 NPCs** -- each placed at a specific location (matching a place name exactly), same day+time\n4. **1-2 encounters** -- each at a specific location, same day+time, with enemies, tactics, loot\n5. **2-3 read-aloud texts** -- each linked to a place, encounter, or NPC, same day+time\n6. **Story items/clues** -- each placed at a location or encounter, same day+time\n\n**Think chronologically:** What happens at dawn? Morning? Where does the party go in the evening?\n\n${args.instructions ? `\n**DM's specific instructions:** ${args.instructions}` : ""}\n\nAfter I approve, export everything in import format.`;
    },
  },
  {
    name: "create_npcs",
    title: "Create NPCs",
    description: "Create NPCs with names, roles, descriptions, and dispositions fitting the campaign",
    args: [
      { name: "campaign_id", description: "Campaign ID", required: true },
      { name: "count", description: "Number of NPCs to create (default: 3)", required: false },
      { name: "instructions", description: "Specific requirements (roles, locations, etc.)", required: false },
    ],
    buildPrompt: (args, context) => {
      const count = parseInt(args.count) || 3;
      return `${SYSTEM_PREAMBLE}\n\n${context}\n\n${IMPORT_FORMAT}\n\n## TASK: Create ${count} NPCs\n\nCreate ${count} NPCs that fit this campaign. For each NPC:\n- **Name** fitting for their race (invent one; check race styles with get_game_data("races") if unsure)\n- **Role** (merchant, guard, villain, etc.)\n- **Description** and personality (2-3 sentences)\n- What they **know or want**\n- **Disposition** (friendly, neutral, hostile)\n- **day** and **time**\n- **plannedLocation** -- exact name of the place where they are found\n\n${args.instructions ? `\n**DM's specific instructions:** ${args.instructions}` : ""}\n\nAfter I approve, export in import format.`;
    },
  },
  {
    name: "create_encounters",
    title: "Create Encounters",
    description: "Design combat encounters with enemies, tactics, and loot",
    args: [
      { name: "campaign_id", description: "Campaign ID", required: true },
      { name: "count", description: "Number of encounters (default: 2)", required: false },
      { name: "instructions", description: "Specific requirements (difficulty, location, theme)", required: false },
    ],
    buildPrompt: (args, context) => {
      const count = parseInt(args.count) || 2;
      return `${SYSTEM_PREAMBLE}\n\n${context}\n\n${IMPORT_FORMAT}\n\n## TASK: Create ${count} Combat Encounters\n\nFor each encounter include:\n- **Name** and **location** (must match an existing place name exactly)\n- **day** and **time** (must match the place's day+time exactly)\n- **Enemies** with HP (string), armor, weapons (use get_game_data for valid names), atkBonus (string), dmg\n- **Tactics**\n- Simple loot in **"loot"** field (gold, potions)\n- Story items ONLY in the separate **"items"** array\n\n${args.instructions ? `\n**DM's specific instructions:** ${args.instructions}` : ""}\n\nAfter I approve, export in import format.`;
    },
  },
  {
    name: "write_readaloud",
    title: "Write Read-Aloud",
    description: "Write atmospheric read-aloud texts for locations and scenes",
    args: [
      { name: "campaign_id", description: "Campaign ID", required: true },
      { name: "count", description: "Number of texts (default: 3)", required: false },
      { name: "instructions", description: "Specific scenes or moods to write for", required: false },
    ],
    buildPrompt: (args, context) => {
      const count = parseInt(args.count) || 3;
      return `${SYSTEM_PREAMBLE}\n\n${context}\n\n${IMPORT_FORMAT}\n\n## TASK: Write ${count} Read-Aloud Texts\n\nWrite ${count} atmospheric read-aloud texts. For EACH you MUST include:\n- **title** -- descriptive name\n- **text** -- the atmospheric passage\n- **day** and **time** -- MUST match the linked content's day+time\n- **linkedType** -- "place", "encounter", or "npc"\n- **linkedTo** -- the EXACT name of the linked content\n\n**CRITICAL:** Every read-aloud MUST link to an existing place, encounter, or NPC with matching day+time.\n\n${args.instructions ? `\n**DM's specific instructions:** ${args.instructions}` : ""}\n\nAfter I approve, export in import format.`;
    },
  },
  {
    name: "summarize_campaign",
    title: "Summarize Campaign",
    description: "Create a comprehensive summary of the campaign so far",
    args: [
      { name: "campaign_id", description: "Campaign ID", required: true },
      { name: "focus", description: "What to focus on (plot, characters, mysteries, all)", required: false },
    ],
    buildPrompt: (args, context) => {
      return `${SYSTEM_PREAMBLE}\n\n${context}\n\n## TASK: Summarize Campaign\n\nSummarize this campaign based on the session notes. Include:\n- Major events and turning points\n- Key NPCs and their roles\n- Ongoing plot threads\n- Unresolved mysteries\n${args.focus ? `\n**Focus on:** ${args.focus}` : ""}`;
    },
  },
  {
    name: "session_recap",
    title: "Session Recap",
    description: "Generate a recap of the latest session to read to players",
    args: [
      { name: "campaign_id", description: "Campaign ID", required: true },
      { name: "style", description: "Style: dramatic, factual, or humorous (default: dramatic)", required: false },
    ],
    buildPrompt: (args, context) => {
      const style = args.style || "dramatic";
      return `${SYSTEM_PREAMBLE}\n\n${context}\n\n## TASK: Session Recap\n\nWrite a ${style} recap of the latest session that I can read aloud to my players at the start of the next session. Focus on what the players experienced and any cliffhangers.`;
    },
  },
  {
    name: "run_session",
    title: "Run Session (Live DM Companion)",
    description: "Live companion during an in-progress session: looks up rules, tracks encounter HP, marks state changes, logs events",
    args: [
      { name: "campaign_id", description: "Campaign ID", required: true },
      { name: "session_id", description: "Specific session ID (optional -- defaults to most recent)", required: false },
      { name: "focus", description: "Focus: combat, roleplay, exploration, or all (default: all)", required: false },
    ],
    buildPrompt: (args, context) => {
      const focus = args.focus || "all";
      const sessionRef = args.session_id
        ? `session_id ${args.session_id}`
        : "the most recent non-locked session in this campaign";
      return `${SYSTEM_PREAMBLE}\n\n${context}\n\n## TASK: LIVE DM COMPANION\n\nYou are running this session WITH the DM at the table. The DM narrates; you keep session state accurate, look up rules instantly, and track combat. **Be CONCISE -- players are waiting.**\n\n---\n\n## PHASE 1: PRE-FLIGHT\n\n### Step 1: Identify the active session\nCall \`get_campaign_state\` to find ${sessionRef}. Then call \`get_session(session_id)\` to load the planned content.\n\n### Step 2: Ask the DM what else to load\n"Session loaded. Before we start, do you also want me to load:\n- **Game rules** -- recommended if you expect combat\n- **World & bestiary** -- recommended for exploration\n- **Previous session history**\n- **Everything**\n- **Nothing else**"\n\n### Step 3: Briefly confirm\n"Session #X loaded: 3 places, 5 NPCs, 2 encounters. Ready."\n\n---\n\n## PHASE 2: DURING PLAY\n\n### MANDATORY STATE UPDATES -- auto-call tools without asking\n\n| When the DM says... | You immediately call... |\n|---|---|\n| "the party arrives at [place]" | \`mark_place_visited(session_id, "[place]")\` |\n| "they meet [NPC]" | \`mark_npc_met(session_id, "[NPC]")\` |\n| "combat starts" | \`set_encounter_status(session_id, "[encounter]", "started")\` |\n| "[enemy] takes X damage" | \`damage_enemy(session_id, "[encounter]", "[enemy]", X)\` |\n| "combat ends" | \`set_encounter_status(session_id, "[encounter]", "completed")\` |\n| "they find [item]" | \`mark_item_found(session_id, "[item]", given_to="[character]")\` |\n| Important moment | \`add_event\` or \`add_turning_point\` |\n| Player earns XP | \`give_xp(character_id, amount)\` |\n| DM tells a secret | \`add_dm_note\` with appropriate category |\n\n**Do not ask "should I mark X?" -- just do it.**\n\n### COMBAT TRACKING\n\nWhen an encounter is started:\n- List enemies and HP at start of each round\n- After every hit: \`damage_enemy\` + report HP change\n- When last enemy at 0: \`set_encounter_status(..., "completed")\`\n\n### LOGGING -- silent by default\n\n- \`add_event\` -- player-visible facts\n- \`add_dm_note\` -- PRIVATE (categories: plot / npc / mechanic / plan / reminder)\n- \`add_turning_point\` -- player-visible major decisions\n\n### END OF SESSION\n\nWhen the DM signals end:\n1. Call \`get_session\` to read back logged events\n2. Suggest a summary\n3. Call \`set_session_summary(session_id, summary, follow_up)\`\n4. Ask if they want to \`lock_session\`\n\n---\n\n## STYLE\n\n- **Concise.** One-line confirmations.\n- **Do not narrate tool calls.**\n- **Do not suggest unless asked.**\n- **Focus: ${focus}**\n\nBegin with PHASE 1.`;
    },
  },
  {
    name: "full_new_session",
    title: "Full New Session",
    description: "Generate a complete session with all content types",
    args: [
      { name: "campaign_id", description: "Campaign ID", required: true },
      { name: "session_type", description: "Session type: mixed, combat, or roleplay (default: mixed)", required: false },
      { name: "session_length", description: "Session length in hours (default: 3)", required: false },
      { name: "instructions", description: "Theme, goals, or specific requirements", required: false },
    ],
    buildPrompt: (args, context) => {
      const type = args.session_type || "mixed";
      const hours = parseInt(args.session_length) || 3;
      return `${SYSTEM_PREAMBLE}\n\n${context}\n\n${IMPORT_FORMAT}\n\n## TASK: Generate Complete Session\n\nSession type: ${type} | Length: ~${hours} hours\n\nGenerate a COMPLETE session organized as a **journey through places at specific times**.\n\n### Step 1: Define the skeleton (places + times)\nCreate **3-5 places** with day + time.\n\n### Step 2: Attach content to places\nFor EACH place, add content with the SAME day+time:\n- **NPCs** (plannedLocation = exact place name)\n- **Encounters** (location = exact place name)\n- **Items/clues** (plannedLocation = place or encounter name)\n- **Read-aloud texts** (linkedType + linkedTo)\n\n### What to include:\n- **Hook/goal**\n- **3-5 places** with day + time\n- **3-5 NPCs**\n- **1-3 encounters** with full enemy stats\n- **3-5 read-aloud texts**\n- **Story items/clues**\n\n${args.instructions ? `\n**DM's specific instructions:** ${args.instructions}` : ""}\n\nAfter I approve, export EVERYTHING in import format.`;
    },
  },
];
