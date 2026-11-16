import type { SessionData } from "@/lib/schemas/session";
import { TIME_ORDER, asTimeOfDay } from "@/lib/domain/time";

// ---------------------------------------------------------------------------
// Scenes in the planning view. A scene is an encounter; NPCs, items,
// equipment and read-alouds belong to it through the links they already
// have (no new stored field):
//  - a link naming the encounter itself (read-aloud "encounter" links, and
//    items whose planned location is an encounter name), or
//  - a link naming the encounter's place; with several encounters at the same
//    place, the one on the same day (and time) wins.
// Everything that matches no scene is "loose".
// ---------------------------------------------------------------------------

export const SCENE_MEMBER_KINDS = ["npcs", "items", "equipment", "readAloud"] as const;
export type SceneMemberKind = (typeof SCENE_MEMBER_KINDS)[number];

export type SceneMembers = Record<SceneMemberKind, number[]>;

export type Scene = SceneMembers & {
  /** Index in data.encounters. */
  index: number;
  day: number | null;
};

export type ScenePlan = {
  scenes: Scene[];
  loose: SceneMembers & { places: number[] };
  /** Days that have scenes or loose content, ascending; null (no day) last. */
  days: (number | null)[];
};

const norm = (s: string): string => s.trim().toLowerCase();

export function dayOf(day: string | null | undefined): number | null {
  if (day === null || day === undefined || day === "") return null;
  const n = Number(day);
  return Number.isFinite(n) ? n : null;
}

export function timeRank(time: string | null | undefined): number {
  const tod = asTimeOfDay(time ?? null);
  return tod ? TIME_ORDER[tod] : Number.MAX_SAFE_INTEGER;
}

const emptyMembers = (): SceneMembers => ({ npcs: [], items: [], equipment: [], readAloud: [] });

export function buildScenePlan(data: SessionData): ScenePlan {
  const scenes: Scene[] = data.encounters.map((e, index) => ({ index, day: dayOf(e.day), ...emptyMembers() }));
  const loose = { ...emptyMembers(), places: [] as number[] };

  const byName = new Map<string, number>();
  const byPlace = new Map<string, number[]>();
  data.encounters.forEach((e, i) => {
    if (e.name.trim() && !byName.has(norm(e.name))) byName.set(norm(e.name), i);
    if (e.location.trim()) byPlace.set(norm(e.location), [...(byPlace.get(norm(e.location)) ?? []), i]);
  });

  const atPlace = (place: string, day: string | null, time: string | null): number | null => {
    const candidates = byPlace.get(norm(place));
    if (!candidates?.length) return null;
    const d = dayOf(day);
    const sameDay = candidates.filter((i) => dayOf(data.encounters[i].day) === d);
    const sameTime = sameDay.filter((i) => (data.encounters[i].time ?? null) === (time ?? null));
    return sameTime[0] ?? sameDay[0] ?? candidates[0];
  };

  const sceneFor = (link: string, day: string | null, time: string | null): number | null => {
    if (!link.trim()) return null;
    return byName.get(norm(link)) ?? atPlace(link, day, time);
  };

  const put = (kind: SceneMemberKind, i: number, scene: number | null) => {
    if (scene === null) loose[kind].push(i);
    else scenes[scene][kind].push(i);
  };

  const npcScene: (number | null)[] = data.npcs.map((n) => sceneFor(n.plannedLocation, n.day, n.time));
  npcScene.forEach((s, i) => put("npcs", i, s));
  data.items.forEach((it, i) => put("items", i, sceneFor(it.plannedLocation, it.day, it.time)));
  data.equipment.forEach((eq, i) => put("equipment", i, sceneFor(eq.plannedLocation, eq.day, eq.time)));
  data.readAloud.forEach((r, i) => {
    let scene: number | null = null;
    if (r.linkedType === "encounter") scene = byName.get(norm(r.linkedTo)) ?? null;
    else if (r.linkedType === "place") scene = atPlace(r.linkedTo, r.day, r.time);
    else if (r.linkedType === "npc") {
      const n = data.npcs.findIndex((x) => norm(x.name) === norm(r.linkedTo));
      scene = n >= 0 ? npcScene[n] : null;
    }
    put("readAloud", i, scene);
  });
  data.places.forEach((p, i) => {
    if (!byPlace.has(norm(p.name))) loose.places.push(i);
  });

  const days = new Set<number | null>(scenes.map((s) => s.day));
  for (const kind of SCENE_MEMBER_KINDS) for (const i of loose[kind]) days.add(dayOf(data[kind][i].day));
  for (const i of loose.places) days.add(dayOf(data.places[i].day));
  const sorted = [...days].filter((d): d is number => d !== null).sort((a, b) => a - b);

  return { scenes, loose, days: days.has(null) ? [...sorted, null] : sorted };
}

/** Scenes of one day, in time order (then stored order). */
export function scenesOnDay(plan: ScenePlan, data: SessionData, day: number | null): Scene[] {
  return plan.scenes
    .filter((s) => s.day === day)
    .sort((a, b) => timeRank(data.encounters[a.index].time) - timeRank(data.encounters[b.index].time) || a.index - b.index);
}

export function looseCount(plan: ScenePlan): number {
  return SCENE_MEMBER_KINDS.reduce((n, k) => n + plan.loose[k].length, plan.loose.places.length);
}
