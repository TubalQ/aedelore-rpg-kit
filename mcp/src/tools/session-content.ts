import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import { withSession, text, textError } from "./helpers.js";
import {
  placeSchema,
  npcSchema,
  encounterSchema,
  readAloudSchema,
  itemSchema,
  equipmentSchema,
  linkedTypeEnum,
  dayNumber,
  timeEnum,
  visibleToInput,
  clampEncounterStatus,
  DM_NOTE_CATEGORIES,
  DEFAULT_DM_NOTE_CATEGORY,
} from "./session/schemas.js";
import { invalidBonusMessage, parseBonusStrings } from "./equipment-input.js";
import { safeTool } from "./safe-tool.js";

// ---------------------------------------------------------------------------
// Per-item normalization - the runtime flags each new entry starts with
// (visited/status/found/...). Used by BOTH import_content (bulk) and the
// individual add_* tools so they can never drift. The app fills every other
// default from its schema.
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
    status: clampEncounterStatus(enc.status),
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

type EquipmentInput = Rec & { bonuses?: string[]; hp?: number };

/** Session loot entry, or the bonus strings that could not be parsed. */
function normalizeEquipment(eq: EquipmentInput): { ok: true; value: Rec } | { ok: false; invalid: string[] } {
  const { bonuses, invalid } = parseBonusStrings(eq.bonuses ?? []);
  if (invalid.length) return { ok: false, invalid };
  return {
    ok: true,
    value: { ...eq, bonuses, maxHp: eq.hp ?? 0, givenTo: "", visibleTo: eq.visibleTo ?? "dm" },
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

/**
 * M3: the tools find a record by its name (title for read-alouds), and by day
 * and time when names repeat. A second record with the same name, day and
 * time can never be reached again, not even to delete it, so it is refused.
 */
const sameSlot = (a: Rec, b: Rec, keyField: string): boolean =>
  String(a[keyField] ?? "").trim() === String(b[keyField] ?? "").trim() &&
  String(a.day ?? "") === String(b.day ?? "") &&
  String(a.time ?? "") === String(b.time ?? "");

function duplicateMessage(data: Rec, key: string, item: Rec, keyField = "name"): string | null {
  const existing = (data[key] || []) as Rec[];
  if (!existing.some((x) => sameSlot(x, item, keyField))) return null;
  return `"${String(item[keyField])}" already exists on day ${String(item.day ?? "-")} ${String(item.time ?? "")}. Change that one with edit_record, or use another name, day or time.`;
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
      session_id: z.number().int().positive().describe("Session ID"),
      text: z.string().describe("Note content"),
      category: z
        .enum(DM_NOTE_CATEGORIES)
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

        const cat = category ?? DEFAULT_DM_NOTE_CATEGORY;
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
      session_id: z.number().int().positive().describe("Session ID"),
      text: z.string().describe("Event description"),
      linked_type: linkedTypeEnum.optional().describe("What this event is linked to"),
      linked_to: z
        .string()
        .optional()
        .describe("Name of the linked place/encounter/NPC"),
      visible_to: visibleToInput.optional(),
      day: dayNumber.optional().describe("In-game day it happened (see get_table)"),
      time: timeEnum.optional().describe("Time of day it happened (see get_table)"),
    },
    async ({ session_id, text: eventText, linked_type, linked_to, visible_to, day, time }) => {
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
        if (day !== undefined) entry.day = String(day);
        if (time) entry.time = time;

        eventLog.push(entry);

        return text(`Event added${day !== undefined || time ? ` (${[day !== undefined && `day ${day}`, time].filter(Boolean).join(", ")})` : ""}: "${eventText}"`);
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
      session_id: z.number().int().positive().describe("Session ID"),
      description: z.string().describe("What happened"),
      consequence: z.string().optional().describe("What this leads to"),
      linked_type: linkedTypeEnum.optional(),
      linked_to: z.string().optional(),
      visible_to: visibleToInput.optional(),
      day: dayNumber.optional().describe("In-game day it happened (see get_table)"),
      time: timeEnum.optional().describe("Time of day it happened (see get_table)"),
    },
    async ({ session_id, description, consequence, linked_type, linked_to, visible_to, day, time }) => {
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
        if (day !== undefined) entry.day = String(day);
        if (time) entry.time = time;

        turningPoints.push(entry);

        return text(`Turning point added: "${description}"`);
      });
    },
    { role: "dm" },
  );

  // -------------------------------------------------------------------------
  // import_content
  // -------------------------------------------------------------------------
  // The rules stand once in the description, not on every field (#71: this
  // was the largest tool, ~8 500 characters).
  const bare = { day: dayNumber, time: timeEnum, visibleTo: visibleToInput.optional() };
  safeTool(
    server,
    "import_content",
    'Import AI-generated content into a session. EVERY record MUST have day (integer) and time (dawn/morning/noon/afternoon/dusk/evening/night), the same day and time as the place or record it links to. NPCs and items need plannedLocation, encounters location (EXACT place names; items may name an encounter), readAloud linkedType + linkedTo. Define places first. Every record also takes visibleTo: "all" (default), "dm" or a list of character names.',
    {
      session_id: z.number().int().positive().describe("Session ID"),
      content: z
        .object({
          hook: z.string().optional(),
          places: z.array(placeSchema.extend(bare)).optional(),
          npcs: z.array(npcSchema.extend({ ...bare, plannedLocation: z.string() })).optional(),
          encounters: z.array(encounterSchema.extend({ ...bare, location: z.string() })).optional(),
          readAloud: z.array(readAloudSchema.extend({ ...bare, linkedTo: z.string() })).optional(),
          items: z.array(itemSchema.extend({ ...bare, plannedLocation: z.string() })).optional(),
          equipment: z
            .array(equipmentSchema)
            .optional()
            .describe("DM Special Equipment (weapons/armor with stats, rarity, bonuses)"),
        })

    },
    async ({ session_id, content }) => {
      // Validate everything that can fail BEFORE touching the session.
      const equipment: Rec[] = [];
      for (const eq of content.equipment ?? []) {
        const normalized = normalizeEquipment(eq);
        if (!normalized.ok) return textError(`Equipment "${eq.name}": ${invalidBonusMessage(normalized.invalid)}`);
        equipment.push(normalized.value);
      }

      // Through withSession: serialised with the other session tools and only
      // the keys that actually changed are sent (no full-blob overwrite).
      return withSession(client, token, session_id, async (data) => {
        const names = (key: string, field = "name"): string[] =>
          ((data[key] || []) as Rec[]).map((x) => x[field] as string);
        const newPlaces = (content.places ?? []).map((p) => p.name);
        const allPlaces = [...names("places"), ...newPlaces];
        const allEncounters = [...names("encounters"), ...(content.encounters ?? []).map((e) => e.name)];
        const allNpcs = [...names("npcs"), ...(content.npcs ?? []).map((n) => n.name)];
        const warnings: string[] = [];

        for (const npc of content.npcs ?? []) {
          if (npc.plannedLocation && !allPlaces.includes(npc.plannedLocation)) {
            warnings.push(`NPC "${npc.name}" links to unknown place "${npc.plannedLocation}"`);
          }
        }
        for (const enc of content.encounters ?? []) {
          if (enc.location && !allPlaces.includes(enc.location)) {
            warnings.push(`Encounter "${enc.name}" links to unknown place "${enc.location}"`);
          }
        }
        const linkTargets: Record<string, string[]> = {
          place: allPlaces,
          encounter: allEncounters,
          npc: allNpcs,
        };
        for (const ra of content.readAloud ?? []) {
          if (ra.linkedTo && !linkTargets[ra.linkedType].includes(ra.linkedTo)) {
            warnings.push(`Read-aloud "${ra.title}" links to unknown ${ra.linkedType} "${ra.linkedTo}"`);
          }
        }
        for (const item of content.items ?? []) {
          if (item.plannedLocation && ![...allPlaces, ...allEncounters].includes(item.plannedLocation)) {
            warnings.push(`Item "${item.name}" links to unknown location "${item.plannedLocation}"`);
          }
        }

        // Nothing is saved when anything would be a duplicate (M3), also
        // within this import.
        const dupes: string[] = [];
        const probe: Rec = { places: [...((data.places || []) as Rec[])], npcs: [...((data.npcs || []) as Rec[])], encounters: [...((data.encounters || []) as Rec[])], readAloud: [...((data.readAloud || []) as Rec[])], items: [...((data.items || []) as Rec[])] };
        const lists: Array<[string, Rec[], string]> = [
          ["places", (content.places ?? []) as Rec[], "name"],
          ["npcs", (content.npcs ?? []) as Rec[], "name"],
          ["encounters", (content.encounters ?? []) as Rec[], "name"],
          ["readAloud", (content.readAloud ?? []) as Rec[], "title"],
          ["items", (content.items ?? []) as Rec[], "name"],
        ];
        for (const [key, recs, keyField] of lists) {
          for (const rec of recs) {
            const dup = duplicateMessage(probe, key, rec, keyField);
            if (dup) dupes.push(`${key}: ${dup}`);
            pushTo(probe, key, rec);
          }
        }
        if (dupes.length) return textError(`Nothing imported. Duplicates:\n${dupes.join("\n")}`);

        if (content.hook) data.hook = content.hook;
        for (const p of content.places ?? []) pushTo(data, "places", normalizePlace(p));
        for (const n of content.npcs ?? []) pushTo(data, "npcs", normalizeNpc(n));
        for (const e of content.encounters ?? []) pushTo(data, "encounters", normalizeEncounter(e));
        for (const r of content.readAloud ?? []) pushTo(data, "readAloud", normalizeReadAloud(r));
        for (const i of content.items ?? []) pushTo(data, "items", normalizeItem(i));
        for (const eq of equipment) pushTo(data, "equipment", eq);

        const counts = [
          content.hook ? "hook" : "",
          content.places?.length ? `${content.places.length} places` : "",
          content.npcs?.length ? `${content.npcs.length} NPCs` : "",
          content.encounters?.length ? `${content.encounters.length} encounters` : "",
          content.readAloud?.length ? `${content.readAloud.length} read-aloud` : "",
          content.items?.length ? `${content.items.length} items` : "",
          equipment.length ? `${equipment.length} equipment` : "",
        ].filter(Boolean);

        let msg = `Imported: ${counts.join(", ") || "nothing"}`;
        if (warnings.length) msg += `\n\nWarnings:\n${warnings.join("\n")}`;
        msg +=
          '\n\nReminder: All locations and creatures must exist in Aedelore. If you used any names you haven\'t verified, call get_world_lore("the world") or get_world_lore("bestiary") to check.';
        return text(msg);
      });
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
    { session_id: z.number().int().positive().describe("Session ID"), ...placeSchema.shape },
    async ({ session_id, ...place }) =>
      withSession(client, token, session_id as number, async (data) => {
        const dup = duplicateMessage(data, "places", place as Rec);
        if (dup) return textError(dup);
        pushTo(data, "places", normalizePlace(place as Rec));
        return text(`Place added: "${place.name}" (day ${place.day} ${place.time}).`);
      }),
    { role: "dm" },
  );

  safeTool(
    server,
    "add_npc",
    "Add a single NPC to a session. day + time MUST match its place; plannedLocation is the EXACT place name.",
    { session_id: z.number().int().positive().describe("Session ID"), ...npcSchema.shape },
    async ({ session_id, ...npc }) =>
      withSession(client, token, session_id as number, async (data) => {
        const warn = !placeNames(data).includes(npc.plannedLocation as string)
          ? ` Warning: links to unknown place "${npc.plannedLocation}".`
          : "";
        const dup = duplicateMessage(data, "npcs", npc as Rec);
        if (dup) return textError(dup);
        pushTo(data, "npcs", normalizeNpc(npc as Rec));
        return text(`NPC added: "${npc.name}".${warn}`);
      }),
    { role: "dm" },
  );

  safeTool(
    server,
    "add_encounter",
    "Add a single encounter to a session. day + time MUST match its place; location is the EXACT place name. Enemies carry stats (hp/atkBonus/dmg).",
    { session_id: z.number().int().positive().describe("Session ID"), ...encounterSchema.shape },
    async ({ session_id, ...enc }) =>
      withSession(client, token, session_id as number, async (data) => {
        const warn = !placeNames(data).includes(enc.location as string)
          ? ` Warning: links to unknown place "${enc.location}".`
          : "";
        const dup = duplicateMessage(data, "encounters", enc as Rec);
        if (dup) return textError(dup);
        pushTo(data, "encounters", normalizeEncounter(enc as Rec));
        return text(`Encounter added: "${enc.name}".${warn}`);
      }),
    { role: "dm" },
  );

  safeTool(
    server,
    "add_readaloud",
    "Add a single read-aloud (atmospheric text) to a session. linkedType + linkedTo point at the EXACT place/encounter/NPC name; day + time must match it.",
    { session_id: z.number().int().positive().describe("Session ID"), ...readAloudSchema.shape },
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
        const dup = duplicateMessage(data, "readAloud", ra as Rec, "title");
        if (dup) return textError(dup);
        pushTo(data, "readAloud", normalizeReadAloud(ra as Rec));
        return text(`Read-aloud added: "${ra.title}".${warn}`);
      }),
    { role: "dm" },
  );

  safeTool(
    server,
    "add_item",
    "Add a single story item to a session. day + time MUST match its place/encounter; plannedLocation is the EXACT place or encounter name.",
    { session_id: z.number().int().positive().describe("Session ID"), ...itemSchema.shape },
    async ({ session_id, ...item }) =>
      withSession(client, token, session_id as number, async (data) => {
        const locNames = [
          ...placeNames(data),
          ...((data.encounters || []) as Rec[]).map((e) => e.name as string),
        ];
        const warn = !locNames.includes(item.plannedLocation as string)
          ? ` Warning: links to unknown location "${item.plannedLocation}".`
          : "";
        const dup = duplicateMessage(data, "items", item as Rec);
        if (dup) return textError(dup);
        pushTo(data, "items", normalizeItem(item as Rec));
        return text(`Item added: "${item.name}".${warn}`);
      }),
    { role: "dm" },
  );

  safeTool(
    server,
    "add_equipment",
    "Add a single piece of DM special equipment (weapon/armor/shield/misc with stats, rarity, bonuses) to a session's loot pool. Hidden from players until given or revealed.",
    { session_id: z.number().int().positive().describe("Session ID"), ...equipmentSchema.shape },
    async ({ session_id, ...eq }) =>
      withSession(client, token, session_id as number, async (data) => {
        const normalized = normalizeEquipment(eq);
        if (!normalized.ok) return textError(invalidBonusMessage(normalized.invalid));
        pushTo(data, "equipment", normalized.value);
        return text(`Equipment added: "${eq.name}" (${eq.type}, ${eq.rarity ?? "common"}).`);
      }),
    { role: "dm" },
  );
}
