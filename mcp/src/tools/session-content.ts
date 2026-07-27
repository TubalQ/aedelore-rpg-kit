import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as sessionsApi from "../api/sessions.js";
import { withSession, text, asRecord } from "./helpers.js";
import { safeTool } from "./safe-tool.js";

const timeEnum = z.enum(["dawn", "morning", "noon", "afternoon", "dusk", "evening", "night"]);

// ---------------------------------------------------------------------------
// Schemas for import_content
// ---------------------------------------------------------------------------

const placeSchema = z.object({
  name: z.string().describe("Place name"),
  description: z.string().describe("Place description"),
  day: z.number().int().describe("Day number (integer)"),
  time: timeEnum.describe("Time of day"),
});

const npcSchema = z.object({
  name: z.string().describe("NPC name"),
  role: z.string().optional().describe("NPC role"),
  description: z.string().optional().describe("NPC description"),
  disposition: z.string().optional().describe("friendly, neutral, or hostile"),
  day: z.number().int().describe("Day number -- MUST match the place day"),
  time: timeEnum.describe("Time of day -- MUST match the place time"),
  plannedLocation: z.string().describe("EXACT name of the place where this NPC is found"),
});

const enemySchema = z.object({
  name: z.string().describe("Enemy name"),
  disposition: z.string().optional().default("enemy"),
  role: z
    .string()
    .optional()
    .describe("Warrior, Rogue, Mage, Healer, Ranger, Beast, Civilian, Historian, Other"),
  hp: z.coerce.number().int().describe("Hit points (integer)"),
  armor: z.string().optional(),
  weapon: z.string().optional(),
  atkBonus: z.string().optional().describe('Attack bonus as string like "+3"'),
  dmg: z.string().optional().describe('Damage like "1d8"'),
});

const encounterSchema = z.object({
  name: z.string().describe("Encounter name"),
  location: z.string().describe("EXACT name of the place where this encounter happens"),
  day: z.number().int().describe("Day number -- MUST match the place day"),
  time: timeEnum.describe("Time of day -- MUST match the place time"),
  status: z.string().optional(),
  enemies: z.array(enemySchema).optional().describe("List of enemies with stats"),
  tactics: z.string().optional(),
  loot: z
    .string()
    .optional()
    .describe("Simple loot only: gold, potions. Story items go in items array."),
});

const readAloudSchema = z.object({
  title: z.string().describe("Title for the read-aloud text"),
  text: z.string().describe("The atmospheric text to read aloud"),
  day: z.number().int().describe("Day number -- MUST match linked content day"),
  time: timeEnum.describe("Time of day -- MUST match linked content time"),
  linkedType: z.enum(["place", "encounter", "npc"]).describe("What this text is linked to"),
  linkedTo: z.string().describe("EXACT name of the place, encounter, or NPC"),
});

const itemSchema = z.object({
  name: z.string().describe("Item name"),
  description: z.string().describe("Item description"),
  day: z.number().int().describe("Day number -- MUST match the place/encounter day"),
  time: timeEnum.describe("Time of day -- MUST match the place/encounter time"),
  plannedLocation: z
    .string()
    .describe("EXACT name of the place or encounter where this item is found"),
});

const equipmentSchema = z.object({
  name: z.string().max(200).describe("Equipment name"),
  type: z.enum(["weapon", "armor"]).describe("Equipment type"),
  rarity: z
    .enum(["common", "enchanted", "rare", "legendary"])
    .optional()
    .default("common")
    .describe("Rarity tier"),
  description: z.string().max(5000).optional().describe("Equipment description/lore"),
  specialEffect: z.string().max(500).optional().describe("Special effect text"),
  bonuses: z
    .array(z.string())
    .max(10)
    .optional()
    .describe('Stat bonuses as "+N StatName" (e.g. "+1 Intelligence")'),
  baseWeapon: z.string().optional().describe("Base weapon type (for weapons)"),
  atkBonus: z.string().optional().describe("Attack bonus (for weapons)"),
  damage: z.string().optional().describe('Damage dice (for weapons, e.g. "1d8")'),
  range: z.string().optional().describe("Range (for weapons)"),
  breakVal: z.string().optional().describe("Break value (for weapons)"),
  advantage: z.string().optional().describe("Advantage condition (for weapons)"),
  baseArmor: z.string().optional().describe("Base armor type (for armor)"),
  bodypart: z
    .string()
    .optional()
    .describe("Body part: head, shoulders, chest, hands, legs, or feet (for armor)"),
  hp: z.string().optional().describe("HP value (for armor)"),
  ac: z.number().optional().describe("AC value (for armor)"),
  disadvantage: z.string().optional().describe("Disadvantage condition (for armor)"),
  day: z.number().int().optional().describe("Day number"),
  time: timeEnum.optional().describe("Time of day"),
});

// ---------------------------------------------------------------------------
// Per-item normalization - single source of truth for the runtime shape each
// content type gets (visited/status/notes/... defaults). Used by BOTH
// import_content (bulk) and the individual add_* tools so they can never drift.
// ---------------------------------------------------------------------------

type Rec = Record<string, unknown>;

function normalizePlace(p: Rec): Rec {
  return { ...p, visited: false, notes: "" };
}

function normalizeNpc(n: Rec): Rec {
  return { ...n, actualLocation: "", status: "unused", notes: "" };
}

function normalizeEnemy(e: Rec): Rec {
  return {
    ...e,
    disposition: (e.disposition as string) || "enemy",
    hp: Number(e.hp) || 0,
    maxHp: Number(e.maxHp ?? e.hp) || 0,
  };
}

function normalizeEncounter(enc: Rec): Rec {
  return {
    ...enc,
    status: (enc.status as string) || "planned",
    notes: "",
    enemies: ((enc.enemies || []) as Rec[]).map(normalizeEnemy),
  };
}

function normalizeReadAloud(ra: Rec): Rec {
  return { ...ra, read: false };
}

function normalizeItem(item: Rec): Rec {
  return { ...item, actualLocation: "", found: false, givenTo: "", notes: "" };
}

function normalizeEquipment(eq: Rec): Rec {
  return {
    name: eq.name,
    type: eq.type,
    rarity: eq.rarity || "common",
    baseWeapon: eq.baseWeapon || "",
    atkBonus: eq.atkBonus || "",
    damage: eq.damage || "",
    range: eq.range || "",
    breakVal: eq.breakVal || "",
    advantage: eq.advantage || "",
    baseArmor: eq.baseArmor || "",
    bodypart: eq.bodypart || "",
    hp: Number(eq.hp) || 0,
    ac: Number(eq.ac) || 0,
    disadvantage: eq.disadvantage || "",
    bonuses: eq.bonuses || [],
    specialEffect: eq.specialEffect || "",
    description: eq.description || "",
    givenTo: "",
    day: eq.day ?? null,
    time: eq.time ?? null,
  };
}

// Names of every place currently in the session (for link validation).
function placeNames(data: Rec): string[] {
  return ((data.places || []) as Rec[]).map((p) => p.name as string);
}

// Append one item to a session data array (creating it if missing).
function pushTo(data: Rec, key: string, item: Rec): void {
  data[key] = [...((data[key] || []) as Rec[]), item];
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerSessionContentTools(
  server: McpServer,
  client: ApiClient,
  token: string,
): void {
  // -------------------------------------------------------------------------
  // add_dm_note
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "add_dm_note",
    "Add a private DM note to a session. These are NEVER shown to players -- use for internal tracking, hidden plot threads, NPC motivations, planned twists, mechanic tracking, and session continuity notes.",
    {
      session_id: z.number().describe("Session ID"),
      text: z.string().describe("Note content"),
      category: z
        .enum(["plot", "mechanic", "npc", "plan", "reminder"])
        .optional()
        .describe(
          "Note category: plot (hidden story threads), mechanic (HP/resource tracking), npc (secret motivations), plan (upcoming events), reminder (things to remember)",
        ),
    },
    async ({ session_id, text: noteText, category }) => {
      return withSession(client, token, session_id as number, async (data) => {
        if (!data.dmNotes) data.dmNotes = [];
        const dmNotes = data.dmNotes as Array<Record<string, unknown>>;

        const now = new Date();
        const timestamp = now.toLocaleTimeString("sv-SE", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const cat = (category as string) || "reminder";
        dmNotes.push({ timestamp, text: noteText, category: cat });

        return text(`DM note added [${cat}]: "${noteText}"`);
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // add_event
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "add_event",
    "Add an event log entry to a session",
    {
      session_id: z.number().describe("Session ID"),
      text: z.string().describe("Event description"),
      linked_type: z
        .enum(["place", "encounter", "npc"])
        .optional()
        .describe("What this event is linked to"),
      linked_to: z
        .string()
        .optional()
        .describe("Name of the linked place/encounter/NPC"),
      visible_to: z
        .union([z.literal("all"), z.array(z.string())])
        .optional()
        .describe('Who can see this: "all" or array of character names'),
    },
    async ({ session_id, text: eventText, linked_type, linked_to, visible_to }) => {
      return withSession(client, token, session_id as number, async (data) => {
        if (!data.eventLog) data.eventLog = [];
        const eventLog = data.eventLog as Array<Record<string, unknown>>;

        const now = new Date();
        const timestamp = now.toLocaleTimeString("sv-SE", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const entry: Record<string, unknown> = {
          timestamp,
          text: eventText,
          visibleTo: visible_to || "all",
        };
        if (linked_type) entry.linkedType = linked_type;
        if (linked_to) entry.linkedTo = linked_to;

        eventLog.push(entry);

        return text(
          `Event added: "${eventText}"\n\nTip: Use only real Aedelore locations and creatures. If unsure, verify with get_world_lore("world") or get_world_lore("bestiary").`,
        );
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // add_turning_point
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "add_turning_point",
    "Add a turning point to a session",
    {
      session_id: z.number().describe("Session ID"),
      description: z.string().describe("What happened"),
      consequence: z.string().optional().describe("What this leads to"),
      linked_type: z.enum(["place", "encounter", "npc"]).optional(),
      linked_to: z.string().optional(),
      visible_to: z
        .union([z.literal("all"), z.array(z.string())])
        .optional(),
    },
    async ({ session_id, description, consequence, linked_type, linked_to, visible_to }) => {
      return withSession(client, token, session_id as number, async (data) => {
        if (!data.turningPoints) data.turningPoints = [];
        const turningPoints = data.turningPoints as Array<Record<string, unknown>>;

        const entry: Record<string, unknown> = {
          description,
          consequence: consequence || "",
          visibleTo: visible_to || "all",
        };
        if (linked_type) entry.linkedType = linked_type;
        if (linked_to) entry.linkedTo = linked_to;

        turningPoints.push(entry);

        return text(`Turning point added: "${description}"`);
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // import_content
  // -------------------------------------------------------------------------
  safeTool(
    server,
    "import_content",
    "Import AI-generated content into a session. EVERY piece of content MUST have day (integer) and time (dawn/morning/noon/afternoon/dusk/evening/night). NPCs/items need plannedLocation, encounters need location, readAloud needs linkedType+linkedTo. All names must match exactly.",
    {
      session_id: z.number().describe("Session ID"),
      content: z
        .object({
          hook: z.string().optional(),
          places: z
            .array(placeSchema)
            .optional()
            .describe("Places are containers -- define these FIRST, then link other content to them"),
          npcs: z.array(npcSchema).optional(),
          encounters: z.array(encounterSchema).optional(),
          readAloud: z.array(readAloudSchema).optional(),
          items: z.array(itemSchema).optional(),
          equipment: z
            .array(equipmentSchema)
            .optional()
            .describe("DM Special Equipment (weapons/armor with stats, rarity, bonuses)"),
        })
        .describe(
          "All content must have day + time. Content links to places by exact name match + same day/time.",
        ),
    },
    async ({ session_id, content }) => {
      const session = asRecord(await sessionsApi.getSession(
        client,
        token,
        session_id as number,
      ));
      const data = asRecord(session.data ?? {});
      const cnt = content as Record<string, unknown>;

      // Collect place names for validation warnings
      const existingPlaces = ((data.places || []) as Array<Record<string, unknown>>).map(
        (p) => p.name as string,
      );
      const contentPlaces = cnt.places as Array<Record<string, unknown>> | undefined;
      const newPlaces = (contentPlaces || []).map((p) => p.name as string);
      const allPlaces = [...existingPlaces, ...newPlaces];
      const warnings: string[] = [];

      // Hook
      if (cnt.hook) data.hook = cnt.hook;

      // Places
      if (contentPlaces?.length) {
        const places = contentPlaces.map(normalizePlace);
        data.places = [
          ...((data.places || []) as Array<Record<string, unknown>>),
          ...places,
        ];
      }

      // NPCs
      const contentNpcs = cnt.npcs as Array<Record<string, unknown>> | undefined;
      if (contentNpcs?.length) {
        contentNpcs.forEach((npc) => {
          if (npc.plannedLocation && !allPlaces.includes(npc.plannedLocation as string)) {
            warnings.push(
              `NPC "${npc.name}" links to unknown place "${npc.plannedLocation}"`,
            );
          }
        });
        const npcs = contentNpcs.map(normalizeNpc);
        data.npcs = [
          ...((data.npcs || []) as Array<Record<string, unknown>>),
          ...npcs,
        ];
      }

      // Encounters
      const contentEncounters = cnt.encounters as Array<Record<string, unknown>> | undefined;
      if (contentEncounters?.length) {
        contentEncounters.forEach((enc) => {
          if (enc.location && !allPlaces.includes(enc.location as string)) {
            warnings.push(
              `Encounter "${enc.name}" links to unknown place "${enc.location}"`,
            );
          }
        });
        const encounters = contentEncounters.map(normalizeEncounter);
        data.encounters = [
          ...((data.encounters || []) as Array<Record<string, unknown>>),
          ...encounters,
        ];
      }

      // Read-aloud
      const contentReadAloud = cnt.readAloud as Array<Record<string, unknown>> | undefined;
      if (contentReadAloud?.length) {
        // Validate linkedTo references against all known names
        const allNames = [...allPlaces];
        (
          (data.encounters || []) as Array<Record<string, unknown>>
        )
          .concat(contentEncounters || [])
          .forEach((e) => allNames.push(e.name as string));
        (
          (data.npcs || []) as Array<Record<string, unknown>>
        )
          .concat(contentNpcs || [])
          .forEach((n) => allNames.push(n.name as string));

        contentReadAloud.forEach((ra) => {
          if (ra.linkedTo && !allNames.includes(ra.linkedTo as string)) {
            warnings.push(
              `Read-aloud "${ra.title}" links to unknown ${ra.linkedType} "${ra.linkedTo}"`,
            );
          }
        });
        const readAloud = contentReadAloud.map(normalizeReadAloud);
        data.readAloud = [
          ...((data.readAloud || []) as Array<Record<string, unknown>>),
          ...readAloud,
        ];
      }

      // Items
      const contentItems = cnt.items as Array<Record<string, unknown>> | undefined;
      if (contentItems?.length) {
        // Validate plannedLocation references
        const allLocNames = [...allPlaces];
        (
          (data.encounters || []) as Array<Record<string, unknown>>
        )
          .concat(contentEncounters || [])
          .forEach((e) => allLocNames.push(e.name as string));

        contentItems.forEach((item) => {
          if (item.plannedLocation && !allLocNames.includes(item.plannedLocation as string)) {
            warnings.push(
              `Item "${item.name}" links to unknown location "${item.plannedLocation}"`,
            );
          }
        });
        const items = contentItems.map(normalizeItem);
        data.items = [
          ...((data.items || []) as Array<Record<string, unknown>>),
          ...items,
        ];
      }

      // Equipment
      const contentEquipment = cnt.equipment as Array<Record<string, unknown>> | undefined;
      if (contentEquipment?.length) {
        const equipment = contentEquipment.map(normalizeEquipment);
        data.equipment = [
          ...((data.equipment || []) as Array<Record<string, unknown>>),
          ...equipment,
        ];
      }

      // Save
      await sessionsApi.updateSession(client, token, session_id as number, {
        session_number: session.session_number,
        date: session.date,
        location: session.location,
        data,
      });

      // Build response
      const counts: string[] = [];
      if (cnt.hook) counts.push("hook");
      if (contentPlaces?.length) counts.push(`${contentPlaces.length} places`);
      if (contentNpcs?.length) counts.push(`${contentNpcs.length} NPCs`);
      if (contentEncounters?.length) counts.push(`${contentEncounters.length} encounters`);
      if (contentReadAloud?.length) counts.push(`${contentReadAloud.length} read-aloud`);
      if (contentItems?.length) counts.push(`${contentItems.length} items`);
      if (contentEquipment?.length) counts.push(`${contentEquipment.length} equipment`);

      let msg = `Imported: ${counts.join(", ")}`;
      if (warnings.length) msg += `\n\nWarnings:\n${warnings.join("\n")}`;
      msg +=
        "\n\nReminder: All locations and creatures must exist in Aedelore. If you used any names you haven't verified, call get_world_lore(\"world\") or get_world_lore(\"bestiary\") to check.";

      return text(msg);
    },
    { role: "dm", rateLimit: 10 },
  );

  // -------------------------------------------------------------------------
  // Individual add_* tools - add ONE piece of prep content at a time (mid-run),
  // as an alternative to the bulk import_content. Same schemas, same day/time
  // and link rules; a bad link warns but still saves (like import_content).
  // -------------------------------------------------------------------------

  safeTool(
    server,
    "add_place",
    "Add a single place (a location container) to a session. Add places BEFORE the NPCs/encounters/items that link to them. Requires day + time.",
    { session_id: z.number().describe("Session ID"), ...placeSchema.shape },
    async ({ session_id, ...place }) =>
      withSession(client, token, session_id as number, async (data) => {
        pushTo(data, "places", normalizePlace(place as Rec));
        return text(`Place added: "${place.name}" (day ${place.day} ${place.time}).`);
      }),
    { role: "dm" },
  );

  safeTool(
    server,
    "add_npc",
    "Add a single NPC to a session. day + time MUST match its place; plannedLocation is the EXACT place name.",
    { session_id: z.number().describe("Session ID"), ...npcSchema.shape },
    async ({ session_id, ...npc }) =>
      withSession(client, token, session_id as number, async (data) => {
        const warn = !placeNames(data).includes(npc.plannedLocation as string)
          ? ` Warning: links to unknown place "${npc.plannedLocation}".`
          : "";
        pushTo(data, "npcs", normalizeNpc(npc as Rec));
        return text(`NPC added: "${npc.name}".${warn}`);
      }),
    { role: "dm" },
  );

  safeTool(
    server,
    "add_encounter",
    "Add a single encounter to a session. day + time MUST match its place; location is the EXACT place name. Enemies carry stats (hp/atkBonus/dmg).",
    { session_id: z.number().describe("Session ID"), ...encounterSchema.shape },
    async ({ session_id, ...enc }) =>
      withSession(client, token, session_id as number, async (data) => {
        const warn = !placeNames(data).includes(enc.location as string)
          ? ` Warning: links to unknown place "${enc.location}".`
          : "";
        pushTo(data, "encounters", normalizeEncounter(enc as Rec));
        return text(`Encounter added: "${enc.name}".${warn}`);
      }),
    { role: "dm" },
  );

  safeTool(
    server,
    "add_readaloud",
    "Add a single read-aloud (atmospheric text) to a session. linkedType + linkedTo point at the EXACT place/encounter/NPC name; day + time must match it.",
    { session_id: z.number().describe("Session ID"), ...readAloudSchema.shape },
    async ({ session_id, ...ra }) =>
      withSession(client, token, session_id as number, async (data) => {
        const pool =
          ra.linkedType === "place"
            ? placeNames(data)
            : ((data[ra.linkedType === "encounter" ? "encounters" : "npcs"] || []) as Rec[]).map(
                (x) => x.name as string,
              );
        const warn = !pool.includes(ra.linkedTo as string)
          ? ` Warning: links to unknown ${ra.linkedType} "${ra.linkedTo}".`
          : "";
        pushTo(data, "readAloud", normalizeReadAloud(ra as Rec));
        return text(`Read-aloud added: "${ra.title}".${warn}`);
      }),
    { role: "dm" },
  );

  safeTool(
    server,
    "add_item",
    "Add a single story item to a session. day + time MUST match its place/encounter; plannedLocation is the EXACT place or encounter name.",
    { session_id: z.number().describe("Session ID"), ...itemSchema.shape },
    async ({ session_id, ...item }) =>
      withSession(client, token, session_id as number, async (data) => {
        const locNames = [
          ...placeNames(data),
          ...((data.encounters || []) as Rec[]).map((e) => e.name as string),
        ];
        const warn = !locNames.includes(item.plannedLocation as string)
          ? ` Warning: links to unknown location "${item.plannedLocation}".`
          : "";
        pushTo(data, "items", normalizeItem(item as Rec));
        return text(`Item added: "${item.name}".${warn}`);
      }),
    { role: "dm" },
  );

  safeTool(
    server,
    "add_equipment",
    "Add a single piece of DM special equipment (weapon/armor with stats, rarity, bonuses) to a session's loot pool.",
    { session_id: z.number().describe("Session ID"), ...equipmentSchema.shape },
    async ({ session_id, ...eq }) =>
      withSession(client, token, session_id as number, async (data) => {
        pushTo(data, "equipment", normalizeEquipment(eq as Rec));
        return text(`Equipment added: "${eq.name}" (${eq.type}, ${eq.rarity ?? "common"}).`);
      }),
    { role: "dm" },
  );
}
