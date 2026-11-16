import type {
  EncounterEnemy,
  SessionData,
  SessionDmNote,
  SessionEquipment,
  SessionEvent,
  SessionItem,
  SessionNpc,
  SessionReadAloud,
} from "@/lib/schemas/session";
import type { CampaignCharacter } from "@/lib/db/queries/campaigns";
import { buildScenePlan, scenesOnDay, type Scene } from "./scenes";

// ---------------------------------------------------------------------------
// The table view: what a game master needs in front of them right now, in
// one answer. It is the play view's model (scenes.ts) seen from the table:
// the active scene with its place, enemies and people, what comes next, the
// party, and the last few things that happened. The MCP renders it for an AI
// GM; nothing here is stored.
// ---------------------------------------------------------------------------

/** How many upcoming scenes, log entries and reminders the view carries. */
export const TABLE_UPCOMING = 3;
export const TABLE_RECENT_LOG = 5;
export const TABLE_REMINDERS = 3;
const REMINDER_CATEGORIES: ReadonlySet<SessionDmNote["category"]> = new Set(["plan", "reminder"]);

/** Why this scene is the active one; mirrors the play view's default pick. */
export type ScenePick = "requested" | "started" | "planned" | "first" | "none";

export type TableScene = {
  name: string;
  status: string;
  day: string | null;
  time: string | null;
  location: string;
  place: { name: string; description: string; visited: boolean } | null;
  enemies: EncounterEnemy[];
  tactics: string;
  loot: string;
  notes: string;
  npcs: SessionNpc[];
  items: SessionItem[];
  equipment: SessionEquipment[];
  /** Unread first. */
  readAloud: SessionReadAloud[];
};

export type TableSceneRef = Pick<TableScene, "name" | "status" | "day" | "time" | "location">;

export type TableCharacter = {
  id: number;
  name: string;
  player: string | null;
  race: string | null;
  class: string | null;
  hp: number;
  maxHp: number;
  arcana: number;
  maxArcana: number;
  willpower: number;
  bleed: number;
  weakened: number;
  xp: number;
};

export type TableView = {
  pick: ScenePick;
  scene: TableScene | null;
  upcoming: TableSceneRef[];
  /** Content that belongs to no scene. */
  loose: { places: string[]; npcs: string[]; items: string[] };
  party: TableCharacter[];
  recentLog: SessionEvent[];
  reminders: SessionDmNote[];
};

const norm = (s: string): string => s.trim().toLowerCase();

function toCharacter(c: CampaignCharacter): TableCharacter {
  const d = c.data;
  return {
    id: c.id,
    name: c.name,
    player: c.playerName,
    race: d.race,
    class: d.class,
    hp: d.hp,
    maxHp: d.maxHp,
    arcana: d.arcana,
    maxArcana: d.maxArcana,
    willpower: d.willpower,
    bleed: d.bleed,
    weakened: d.weakened,
    xp: c.xp,
  };
}

function sceneRef(data: SessionData, s: Scene): TableSceneRef {
  const e = data.encounters[s.index];
  return { name: e.name, status: e.status, day: e.day, time: e.time, location: e.location };
}

function pickScene(data: SessionData, ordered: Scene[], requested?: string): { scene: Scene | null; pick: ScenePick } {
  if (requested?.trim()) {
    const hit = ordered.find((s) => norm(data.encounters[s.index].name) === norm(requested));
    if (hit) return { scene: hit, pick: "requested" };
  }
  const started = ordered.find((s) => data.encounters[s.index].status === "started");
  if (started) return { scene: started, pick: "started" };
  const planned = ordered.find((s) => data.encounters[s.index].status === "planned");
  if (planned) return { scene: planned, pick: "planned" };
  return ordered[0] ? { scene: ordered[0], pick: "first" } : { scene: null, pick: "none" };
}

/**
 * Build the table view for one session. `requestedScene` is an encounter
 * name; when it matches no scene the default pick applies (the caller can
 * tell from `pick`).
 */
export function buildTableView(
  data: SessionData,
  characters: CampaignCharacter[],
  requestedScene?: string,
): TableView {
  const plan = buildScenePlan(data);
  const ordered = plan.days.flatMap((d) => scenesOnDay(plan, data, d));
  const { scene, pick } = pickScene(data, ordered, requestedScene);

  let tableScene: TableScene | null = null;
  if (scene) {
    const e = data.encounters[scene.index];
    const place = data.places.find((p) => e.location.trim() && norm(p.name) === norm(e.location));
    const readAloud = scene.readAloud.map((i) => data.readAloud[i]);
    tableScene = {
      name: e.name,
      status: e.status,
      day: e.day,
      time: e.time,
      location: e.location,
      place: place ? { name: place.name, description: place.description, visited: place.visited } : null,
      enemies: e.enemies,
      tactics: e.tactics,
      loot: e.loot,
      notes: e.notes,
      npcs: scene.npcs.map((i) => data.npcs[i]),
      items: scene.items.map((i) => data.items[i]),
      equipment: scene.equipment.map((i) => data.equipment[i]),
      readAloud: [...readAloud.filter((r) => !r.read), ...readAloud.filter((r) => r.read)],
    };
  }

  const at = scene ? ordered.indexOf(scene) : -1;
  const upcoming = ordered
    .slice(at + 1)
    .filter((s) => data.encounters[s.index].status !== "completed")
    .slice(0, TABLE_UPCOMING)
    .map((s) => sceneRef(data, s));

  return {
    pick,
    scene: tableScene,
    upcoming,
    loose: {
      places: plan.loose.places.map((i) => data.places[i].name),
      npcs: plan.loose.npcs.map((i) => data.npcs[i].name),
      items: plan.loose.items.map((i) => data.items[i].name),
    },
    party: characters.map(toCharacter),
    recentLog: data.eventLog.slice(-TABLE_RECENT_LOG),
    reminders: data.dmNotes.filter((n) => REMINDER_CATEGORIES.has(n.category)).slice(-TABLE_REMINDERS),
  };
}
