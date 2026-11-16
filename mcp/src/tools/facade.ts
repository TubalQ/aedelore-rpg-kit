import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { exposeTool, opDescription, opRateLimit, opRole, opShape, runOp, type SafeToolOptions, type ToolResult } from "./safe-tool.js";
import { DM_NOTE_CATEGORIES, ENEMY_STATUSES, linkedTypeEnum, timeEnum, visibleToInput } from "./session/schemas.js";

// The tools a client sees on the "full" and "play" profiles: a few broad
// tools built on the operations the tool modules define (safe-tool.ts). Each
// one maps its arguments onto an operation, so validation, permissions and
// the actual work stay in one place.

export type Profile = "full" | "play";

const READ = { annotations: { readOnlyHint: true, openWorldHint: false } } satisfies SafeToolOptions;
const WRITE = { annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } } satisfies SafeToolOptions;
const DESTRUCTIVE = { annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false } } satisfies SafeToolOptions;

const sessionId = z.number().int().positive().describe("Session ID");
const campaignId = z.number().int().positive().describe("Campaign ID");
const characterId = z.number().int().positive().describe("Character ID");
const day = z.number().int().min(1).optional().describe("In-game day; needed when a name repeats on several days");
const time = timeEnum.optional().describe("Time of day; needed when a name repeats");

/** Joins the results of several operations; an error in any marks the whole call. */
function combine(results: ToolResult[]): ToolResult {
  if (!results.length) return { content: [{ type: "text", text: "Nothing to do: pass at least one field to change." }], isError: true };
  return {
    content: [{ type: "text", text: results.map((r) => r.content.map((c) => c.text).join("\n")).join("\n\n") }],
    isError: results.some((r) => r.isError) || undefined,
  };
}

/** Offers an operation under its own name, description and schema. */
function passthrough(server: McpServer, name: string, options: SafeToolOptions): void {
  const description = opDescription(server, name);
  // The operation's own rate limit and role tag apply to the exposed tool.
  const limited = { ...options, rateLimit: options.rateLimit ?? opRateLimit(server, name), role: options.role ?? opRole(server, name) };
  exposeTool(server, name, description, opShape(server, name), (args) => runOp(server, name, args, { direct: true }), limited);
}

function registerOrientation(server: McpServer, profile: Profile): void {
  exposeTool(
    server,
    "list_campaigns",
    "Start here: the campaigns you run (with IDs) and your own characters (with IDs and the campaigns they play in).",
    {},
    async () => combine([await runOp(server, "list_campaigns", {}), await runOp(server, "list_my_characters", {})]),
    READ,
  );
  passthrough(server, "get_campaign_state", READ);
  passthrough(server, "get_table", READ);
  passthrough(server, "get_session", READ);
  if (profile === "full") passthrough(server, "get_session_history", READ);
  passthrough(server, "search_sessions", READ);
  exposeTool(
    server,
    "get_character",
    'One character. view "sheet" (default): the live sheet with HP, resources, gear and notes. view "build": race, class, attributes, skills and abilities with the points left to spend.',
    { character_id: characterId, view: z.enum(["sheet", "build"]).optional().describe('"sheet" (default) or "build"') },
    async ({ character_id, view }) =>
      runOp(server, view === "build" ? "get_character_build" : "get_my_character", { character_id }),
    READ,
  );
}

function registerLookup(server: McpServer): void {
  for (const name of ["get_rules", "get_game_data", "get_world_lore", "read_wiki_page"]) passthrough(server, name, READ);
}

function registerPlay(server: McpServer, profile: Profile): void {
  exposeTool(
    server,
    "mark",
    'Record that the party reached something in the session: kind "place" (visited), "npc" (met), "item" (found; given_to = the character who took it, which hands it to them: on their sheet, taken from anyone else) or "read_aloud" (read out). Match on the exact name shown by get_table / get_session.',
    {
      session_id: sessionId,
      kind: z.enum(["place", "npc", "item", "read_aloud"]),
      name: z.string().min(1).describe("Exact name (the title for a read-aloud)"),
      day,
      time,
      notes: z.string().optional().describe("Note appended to the record (not for read_aloud)"),
      given_to: z.string().optional().describe("item: the character who took it; it is handed to them"),
      actual_location: z.string().optional().describe("npc: where they actually appeared, if not where planned"),
    },
    async ({ session_id, kind, name, day: d, time: t, notes, given_to, actual_location }) => {
      const base = { session_id, day: d, time: t };
      switch (kind) {
        case "place":
          return runOp(server, "mark_place_visited", { ...base, place_name: name, notes });
        case "npc":
          return runOp(server, "mark_npc_met", { ...base, npc_name: name, notes, actual_location });
        case "item":
          return runOp(server, "mark_item_found", { ...base, item_name: name, notes, given_to });
        case "read_aloud":
          return runOp(server, "mark_readaloud_read", { ...base, title: name });
      }
    },
    WRITE,
  );

  exposeTool(
    server,
    "encounter",
    'Run an encounter (a scene). action "start" when it begins, "complete" when it resolves, "replan" to set it back to planned; "damage" subtracts `amount` from an enemy\'s HP, "set_hp" sets it (use it to heal); "set_status" marks an enemy fighting, fled, surrendered or captured (`enemy_status`), so a fight can end without killing everyone. Enemy names, HP and status are in get_table.',
    {
      session_id: sessionId,
      encounter_name: z.string().min(1).describe("Exact encounter name"),
      action: z.enum(["start", "complete", "replan", "damage", "set_hp", "set_status"]),
      enemy_name: z.string().optional().describe("damage / set_hp: exact enemy name"),
      amount: z.number().int().min(0).optional().describe("damage: points to subtract; set_hp: the new HP"),
      enemy_status: z.enum(ENEMY_STATUSES).optional().describe("set_status: the enemy's state"),
      notes: z.string().optional().describe("start / complete / replan: note appended to the encounter"),
      day,
      time,
    },
    async ({ session_id, encounter_name, action, enemy_name, amount, enemy_status, notes, day: d, time: t }) => {
      const base = { session_id, encounter_name, day: d, time: t };
      if (action === "set_status") return runOp(server, "set_enemy_status", { ...base, enemy_name, status: enemy_status });
      if (action === "damage") return runOp(server, "damage_enemy", { ...base, enemy_name, damage: amount });
      if (action === "set_hp") return runOp(server, "update_enemy_hp", { ...base, enemy_name, hp: amount });
      const status = action === "start" ? "started" : action === "complete" ? "completed" : "planned";
      return runOp(server, "set_encounter_status", { ...base, status, notes });
    },
    WRITE,
  );

  exposeTool(
    server,
    "log",
    'Write to the session log as play happens. kind "event" (what happened; shown to players unless visible_to says otherwise), "turning_point" (a choice that changes the story; consequence = what it leads to) or "dm_note" (private; category plot/mechanic/npc/plan/reminder). Pass the day and time from get_table so the entry lands in the right scene.',
    {
      session_id: sessionId,
      kind: z.enum(["event", "turning_point", "dm_note"]),
      text: z.string().min(1),
      day,
      time,
      consequence: z.string().optional().describe("turning_point: what it leads to"),
      category: z.enum(DM_NOTE_CATEGORIES).optional().describe("dm_note category (default plan)"),
      linked_type: linkedTypeEnum.optional().describe("event / turning_point: what it is about"),
      linked_to: z.string().optional().describe("event / turning_point: exact name of that place, encounter or NPC"),
      visible_to: visibleToInput.optional(),
    },
    async ({ session_id, kind, text, day: d, time: t, consequence, category, linked_type, linked_to, visible_to }) => {
      if (kind === "dm_note") return runOp(server, "add_dm_note", { session_id, text, category });
      const shared = { session_id, day: d, time: t, linked_type, linked_to, visible_to };
      if (kind === "turning_point") return runOp(server, "add_turning_point", { ...shared, description: text, consequence });
      return runOp(server, "add_event", { ...shared, text });
    },
    WRITE,
  );

  exposeTool(
    server,
    "update_character",
    "Keep a character sheet true as play happens. Set any of: current hp, arcana, willpower, worthiness, bleed, weakened (new values, not deltas); gold, food; one armor piece's HP (armor_piece = body part or \"shield\"); or append a note to the Lore tab. Only the fields you pass change.",
    {
      character_id: characterId,
      hp: z.number().int().min(0).optional(),
      arcana: z.number().int().min(0).optional(),
      willpower: z.number().int().min(0).optional(),
      worthiness: z.number().int().optional(),
      bleed: z.number().int().min(0).optional(),
      weakened: z.number().int().min(0).optional(),
      gold: z.number().int().min(0).optional(),
      food: z.number().int().min(0).optional(),
      armor_piece: z.string().optional().describe('Body part (e.g. chest) or "shield"'),
      armor_hp: z.number().int().min(0).optional().describe("New current HP of armor_piece"),
      note: z.string().optional().describe("Appended to the character's notes"),
    },
    async (a) => {
      const results: ToolResult[] = [];
      const stats = { hp: a.hp, arcana: a.arcana, willpower: a.willpower, worthiness: a.worthiness, bleed: a.bleed, weakened: a.weakened };
      if (Object.values(stats).some((v) => v !== undefined)) results.push(await runOp(server, "update_hp", { character_id: a.character_id, ...stats }));
      if (a.gold !== undefined || a.food !== undefined) results.push(await runOp(server, "update_inventory", { character_id: a.character_id, gold: a.gold, food: a.food }));
      if (a.armor_piece !== undefined || a.armor_hp !== undefined) results.push(await runOp(server, "update_equipment_hp", { character_id: a.character_id, piece: a.armor_piece, hp: a.armor_hp }));
      if (a.note) results.push(await runOp(server, "add_notes", { character_id: a.character_id, text: a.note }));
      return combine(results);
    },
    WRITE,
  );

  exposeTool(
    server,
    "give",
    'Give a character something. what "xp" (amount), "stash_item" (an item or piece of equipment from the campaign stash by stash_id; the stash keeps it) or "quest_item" (a new story item by name and description). Make new equipment in the stash first (stash action "add_equipment").',
    {
      campaign_id: campaignId,
      character_id: characterId,
      what: z.enum(["xp", "stash_item", "quest_item"]),
      amount: z.number().int().optional().describe("xp: points to give"),
      stash_id: z.number().int().positive().optional().describe("stash_item: id from stash action list or get_table"),
      name: z.string().optional().describe("quest_item: name"),
      description: z.string().optional().describe("quest_item: description"),
    },
    async ({ campaign_id, character_id, what, amount, stash_id, name, description }) => {
      if (what === "xp") return runOp(server, "give_xp", { campaign_id, character_id, amount });
      if (what === "stash_item") return runOp(server, "handout_box_item", { campaign_id, character_id, item_id: stash_id });
      return runOp(server, "give_item", { campaign_id, character_id, name, description });
    },
    WRITE,
  );

  const equipmentFields = Object.fromEntries(
    Object.entries(opShape(server, "add_box_equipment")).filter(([k]) => k !== "campaign_id" && k !== "name"),
  );
  exposeTool(
    server,
    "stash",
    'The campaign stash (förråd): DM-made items and equipment kept for the campaign. action "list", "add_quest_item" (name, description), "add_equipment" (name + equipment fields; weapons/armor with stats, rarity and bonuses) or "remove" (stash_id). Hand things out with give(what "stash_item").',
    {
      campaign_id: campaignId,
      action: z.enum(["list", "add_quest_item", "add_equipment", "remove"]),
      stash_id: z.number().int().positive().optional().describe("remove: the entry"),
      name: z.string().optional().describe("add_*: name"),
      description: z.string().optional().describe("add_quest_item: description"),
      equipment: z.object(equipmentFields).partial().optional().describe("add_equipment: type is required; the rest as needed"),
    },
    async ({ campaign_id, action, stash_id, name, description, equipment }) => {
      if (action === "list") return runOp(server, "list_campaign_box", { campaign_id });
      if (action === "remove") return runOp(server, "remove_box_item", { campaign_id, item_id: stash_id });
      if (action === "add_quest_item") return runOp(server, "add_box_quest_item", { campaign_id, name, description });
      return runOp(server, "add_box_equipment", { ...(equipment ?? {}), campaign_id, name });
    },
    WRITE,
  );

  exposeTool(
    server,
    "add_to_session",
    'Add one record to a session, e.g. something you just made up in play so it becomes canon. kind and the fields it needs: place {name, description, day, time}; npc {name, day, time, plannedLocation, role?, description?, disposition?}; encounter {name, location, day, time, enemies?: [{name, hp, role?, armor?, weapon?, atkBonus?, dmg?}], tactics?, loot?}; item {name, description, day, time, plannedLocation}; read_aloud {title, text, day, time, linkedType, linkedTo}; equipment {name, type, ...stats, day?, time?}. Every kind also takes visibleTo: "all" (default), "dm" or a list of character names. Unknown fields are refused. day is a number, time one of dawn/morning/noon/afternoon/dusk/evening/night.' + (profile === "full" ? " For many records at once use import_content." : ""),
    {
      session_id: sessionId,
      kind: z.enum(["place", "npc", "encounter", "item", "read_aloud", "equipment"]),
      fields: z.record(z.string(), z.unknown()).describe("The record's fields for that kind (see description)"),
    },
    async ({ session_id, kind, fields }) => {
      const opName = kind === "read_aloud" ? "add_readaloud" : `add_${kind}`;
      return runOp(server, opName, { ...fields, session_id }, { strict: true });
    },
    WRITE,
  );
}

const EDIT_OPS = {
  place: ["update_place", "place_name"],
  npc: ["update_npc", "npc_name"],
  encounter: ["update_encounter", "encounter_name"],
  item: ["update_item", "item_name"],
  read_aloud: ["update_readaloud", "title"],
  equipment: ["update_equipment_item", "equipment_name"],
} as const;

const DELETE_OPS = {
  place: ["delete_place", "place_name"],
  npc: ["delete_npc", "npc_name"],
  encounter: ["delete_encounter", "encounter_name"],
  item: ["delete_item", "item_name"],
  read_aloud: ["delete_readaloud", "title"],
} as const;

function registerPrep(server: McpServer): void {
  passthrough(server, "import_content", WRITE);

  exposeTool(
    server,
    "edit_record",
    "Change fields on one existing record in a session (the name itself cannot change). fields is an object of the fields to set, e.g. {description, notes, day, time} for a place; {role, disposition, plannedLocation} for an NPC; {location, enemies, tactics, loot} for an encounter; {text, linkedTo} for a read-aloud.",
    {
      session_id: sessionId,
      kind: z.enum(["place", "npc", "encounter", "item", "read_aloud", "equipment"]),
      name: z.string().min(1).describe("Exact name (title for a read-aloud)"),
      fields: z.record(z.string(), z.unknown()),
      day,
      time,
    },
    async ({ session_id, kind, name, fields, day: d, time: t }) => {
      const [opName, key] = EDIT_OPS[kind];
      const slot = kind === "equipment" ? {} : { day: d, time: t };
      return runOp(server, opName, { session_id, [key]: name, fields, ...slot });
    },
    WRITE,
  );

  exposeTool(
    server,
    "delete_record",
    "Remove one record (place, npc, encounter, item or read_aloud) from a session. It goes to no trash; ask the user first unless they asked for it.",
    {
      session_id: sessionId,
      kind: z.enum(["place", "npc", "encounter", "item", "read_aloud"]),
      name: z.string().min(1).describe("Exact name (title for a read-aloud)"),
      day,
      time,
    },
    async ({ session_id, kind, name, day: d, time: t }) => {
      const [opName, key] = DELETE_OPS[kind];
      return runOp(server, opName, { session_id, [key]: name, day: d, time: t });
    },
    DESTRUCTIVE,
  );

  passthrough(server, "create_session", WRITE);
  exposeTool(
    server,
    "update_session",
    "Change a session: title, date, real-world location, in-game location, hook, prolog, summary (+ follow_up), or lock/unlock it (locked). Only the fields you pass change.",
    {
      session_id: sessionId,
      title: z.string().optional(),
      date: z.string().optional().describe("Real-world date, YYYY-MM-DD"),
      location: z.string().optional().describe("Where you play (real world)"),
      game_location: z.string().optional().describe("Where the party is in the world"),
      hook: z.string().optional(),
      prolog: z.string().optional(),
      summary: z.string().optional().describe("What happened; shown as the story so far"),
      follow_up: z.string().optional(),
      locked: z.boolean().optional().describe("true locks the session against edits, false unlocks"),
    },
    async (a) => {
      const results: ToolResult[] = [];
      const meta = { title: a.title, date: a.date, location: a.location, game_location: a.game_location };
      if (a.locked === false) results.push(await runOp(server, "unlock_session", { session_id: a.session_id }));
      if (Object.values(meta).some((v) => v !== undefined)) results.push(await runOp(server, "update_session_meta", { session_id: a.session_id, ...meta }));
      if (a.hook !== undefined) results.push(await runOp(server, "set_session_hook", { session_id: a.session_id, hook: a.hook }));
      if (a.prolog !== undefined) results.push(await runOp(server, "set_session_prolog", { session_id: a.session_id, prolog: a.prolog }));
      if (a.summary !== undefined) results.push(await runOp(server, "set_session_summary", { session_id: a.session_id, summary: a.summary, follow_up: a.follow_up }));
      if (a.locked === true) results.push(await runOp(server, "lock_session", { session_id: a.session_id }));
      return combine(results);
    },
    WRITE,
  );

  passthrough(server, "create_campaign", WRITE);
  exposeTool(
    server,
    "manage_campaign",
    'Campaign administration. action "update" (name, description), "share_code" (make an invite code), "revoke_share_code" (also removes every player, confirm with the DM first), "list_players", "list_characters", "kick_player" (player_id; the player is excluded and cannot rejoin with the code until the DM lifts it in the app), "leave" (leave a campaign you play in).',
    {
      campaign_id: campaignId,
      action: z.enum(["update", "share_code", "revoke_share_code", "list_players", "list_characters", "kick_player", "leave"]),
      name: z.string().optional(),
      description: z.string().optional(),
      player_id: z.string().uuid().optional().describe("kick_player: the player's user id from list_players"),
    },
    async ({ campaign_id, action, name, description, player_id }) => {
      switch (action) {
        case "update":
          return runOp(server, "update_campaign", { campaign_id, name, description });
        case "share_code":
          return runOp(server, "generate_share_code", { campaign_id });
        case "revoke_share_code":
          return runOp(server, "revoke_share_code", { campaign_id });
        case "list_players":
          return runOp(server, "list_players", { campaign_id });
        case "list_characters":
          return runOp(server, "list_campaign_characters", { campaign_id });
        case "kick_player":
          return runOp(server, "kick_player", { campaign_id, player_id });
        case "leave":
          return runOp(server, "leave_campaign", { campaign_id });
      }
    },
    DESTRUCTIVE,
  );
  passthrough(server, "join_campaign", WRITE);

  exposeTool(
    server,
    "trash",
    'Deleted campaigns, characters, sessions and wiki pages. action "list", or "restore" with type and id from the list.',
    {
      action: z.enum(["list", "restore"]),
      type: z.enum(["campaign", "character", "session", "wiki-book", "wiki-chapter", "wiki-page"]).optional(),
      id: z.number().int().positive().optional(),
    },
    async ({ action, type, id }) => (action === "list" ? runOp(server, "list_trash", {}) : runOp(server, "restore_item", { type, id })),
    WRITE,
  );
}

function registerCharacterBuild(server: McpServer): void {
  passthrough(server, "create_my_character", WRITE);
  exposeTool(
    server,
    "build_character",
    'Build a character, one step per call: race + character_class (+ religion), which applies starting stats and gear; then, after lock(race_class: true), attributes / skills (TOTAL creation points per name, e.g. {"Strength": 2}); abilities (spell/ability names for the class). Look up valid names with get_game_data.',
    {
      character_id: characterId,
      race: z.string().optional(),
      character_class: z.string().optional(),
      religion: z.string().optional(),
      attributes: z.record(z.string(), z.number().int().min(0)).optional(),
      skills: z.record(z.string(), z.number().int().min(0)).optional(),
      abilities: z.array(z.string().min(1)).optional().describe("Spell/ability names"),
    },
    async (a) => {
      const results: ToolResult[] = [];
      const wantsPoints = a.attributes !== undefined || a.skills !== undefined;
      if (a.race !== undefined || a.character_class !== undefined || a.religion !== undefined) {
        const step = await runOp(server, "set_race_class_religion", { character_id: a.character_id, race: a.race, character_class: a.character_class, religion: a.religion });
        results.push(step);
        // Points need race/class locked, which is the player's own step (lock).
        // Running set_attributes in the same call always failed with a bare
        // "lock race/class first" after the race step had already been saved.
        if (step.isError) return combine(results);
        if (wantsPoints) {
          results.push({
            content: [{ type: "text", text: "Not done yet: attributes and skills come after race/class is locked. Confirm the choice with the player, call lock(race_class: true), then build_character again with the points." }],
          });
          return combine(results);
        }
      }
      if (wantsPoints) {
        results.push(await runOp(server, "set_attributes", { character_id: a.character_id, attributes: a.attributes, skills: a.skills }));
      }
      if (a.abilities !== undefined) {
        results.push(await runOp(server, "set_abilities", { character_id: a.character_id, abilities: a.abilities.map((name) => ({ name })) }));
      }
      return combine(results);
    },
    WRITE,
  );
  exposeTool(
    server,
    "equip",
    "Equip game-data gear: a weapon in slot 1-3 (weapon_slot + weapon_name), an armor piece on a body part (body_part + armor_name) and/or a shield (shield_name). Stats come from get_game_data.",
    {
      character_id: characterId,
      weapon_slot: z.number().int().min(1).max(3).optional(),
      weapon_name: z.string().optional(),
      body_part: z.string().optional(),
      armor_name: z.string().optional(),
      shield_name: z.string().optional(),
    },
    async (a) => {
      const results: ToolResult[] = [];
      if (a.weapon_name !== undefined || a.weapon_slot !== undefined) {
        results.push(await runOp(server, "equip_weapon", { character_id: a.character_id, slot: a.weapon_slot, weapon_name: a.weapon_name }));
      }
      if (a.armor_name !== undefined || a.body_part !== undefined || a.shield_name !== undefined) {
        results.push(await runOp(server, "equip_armor", { character_id: a.character_id, body_part: a.body_part, armor_name: a.armor_name, shield_name: a.shield_name }));
      }
      return combine(results);
    },
    WRITE,
  );
  passthrough(server, "spend_xp", WRITE);
  passthrough(server, "update_relationships", WRITE);
  exposeTool(
    server,
    "set_locks",
    "Lock character build steps. As the player: pass the steps to lock (race_class, then attributes, then abilities; locking is one-way). As the campaign's DM: also pass campaign_id to lock or unlock (true/false) any step.",
    {
      character_id: characterId,
      campaign_id: campaignId.optional().describe("Only as the DM"),
      race_class: z.boolean().optional(),
      attributes: z.boolean().optional(),
      abilities: z.boolean().optional(),
    },
    async (a) => {
      if (a.campaign_id !== undefined) {
        return runOp(server, "set_character_locks", {
          campaign_id: a.campaign_id,
          character_id: a.character_id,
          race_class_locked: a.race_class,
          attributes_locked: a.attributes,
          abilities_locked: a.abilities,
        });
      }
      const steps = ([["race_class", "raceClass"], ["attributes", "attributes"], ["abilities", "abilities"]] as const)
        .filter(([key]) => a[key] === true)
        .map(([, step]) => step);
      const results: ToolResult[] = [];
      for (const step of steps) results.push(await runOp(server, "lock_character_step", { character_id: a.character_id, step }));
      return combine(results);
    },
    WRITE,
  );
}

/** Registers the tools of a profile. The operations must be defined first. */
export function registerFacadeTools(server: McpServer, profile: Profile): void {
  registerOrientation(server, profile);
  registerLookup(server);
  registerPlay(server, profile);
  if (profile === "full") {
    registerPrep(server);
    registerCharacterBuild(server);
  }
}
