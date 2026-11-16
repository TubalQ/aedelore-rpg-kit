"use client";

import { useRef } from "react";
import { useUndoableRemove } from "@/hooks/useUndoableRemove";
import { rememberedFor, renameStep, type ClearedName } from "@/lib/session/rename";
import type {
  ContentKind, SessionData, SessionEncounter, SessionEquipment, SessionItem, SessionNpc, SessionPlace, SessionReadAloud,
} from "@/lib/schemas/session";
import type { Scene } from "@/lib/session/scenes";
import { newEncounter, newItem, newNpc, newPlace, newReadAloud, newSessionEquipment } from "@/lib/schemas/session";

/** The data array each content kind lives in. */
export const CONTENT_KEY = {
  place: "places",
  encounter: "encounters",
  npc: "npcs",
  item: "items",
  equipment: "equipment",
  readAloud: "readAloud",
} as const satisfies Record<ContentKind, keyof SessionData>;

export type ContentKey = (typeof CONTENT_KEY)[ContentKind];
export type PlaceLinkedKey = Exclude<ContentKey, "places">;

export type ContentWhen = { day: string | null; time: string | null; place?: string };

/**
 * Add, edit, move and remove session content. One implementation for the
 * planning view: renames relink what points at the renamed thing, and every
 * removal can be undone from the toast.
 */
export function useSessionContent(
  data: SessionData,
  onDataChange: (patch: Partial<SessionData>) => void,
  onRenamePlaceCascade: (index: number, newName: string) => void,
) {
  const placeNames = data.places.filter((p) => p.name).map((p) => p.name);

  /** Adds new content and returns its index in its array. */
  function add(kind: ContentKind, when: ContentWhen, init: Record<string, unknown> = {}): number {
    const base = { day: when.day, time: when.time };
    const place = when.place ?? "";
    if (kind === "place") onDataChange({ places: [...data.places, newPlace({ ...base, ...init })] });
    else if (kind === "encounter") onDataChange({ encounters: [...data.encounters, newEncounter({ ...base, location: place, ...init })] });
    else if (kind === "npc") onDataChange({ npcs: [...data.npcs, newNpc({ ...base, plannedLocation: place, ...init })] });
    else if (kind === "item") onDataChange({ items: [...data.items, newItem({ ...base, plannedLocation: place, ...init })] });
    else if (kind === "equipment") onDataChange({ equipment: [...data.equipment, newSessionEquipment({ ...base, plannedLocation: place, ...init })] });
    else onDataChange({ readAloud: [...data.readAloud, newReadAloud({ ...base, linkedType: place ? "place" : null, linkedTo: place, ...init })] });
    return data[CONTENT_KEY[kind]].length;
  }

  const removers = {
    place: useUndoableRemove(data.places, (places) => onDataChange({ places })),
    encounter: useUndoableRemove(data.encounters, (encounters) => onDataChange({ encounters })),
    npc: useUndoableRemove(data.npcs, (npcs) => onDataChange({ npcs })),
    item: useUndoableRemove(data.items, (items) => onDataChange({ items })),
    equipment: useUndoableRemove(data.equipment, (equipment) => onDataChange({ equipment })),
    readAloud: useUndoableRemove(data.readAloud, (readAloud) => onDataChange({ readAloud })),
  };

  function remove(kind: ContentKind, index: number) {
    const el = data[CONTENT_KEY[kind]][index] as { name?: string; title?: string } | undefined;
    removers[kind](index, (kind === "readAloud" ? el?.title : el?.name) ?? "");
  }

  // Relink readAloud/eventLog/turningPoints whose linkedType matches when an
  // npc/encounter is renamed, so links don't silently break (mirrors places).
  function relinkOnRename(linkType: "npc" | "encounter", oldName: string, newName: string): Partial<SessionData> {
    const hit = (x: { linkedType: string | null; linkedTo: string }) => x.linkedType === linkType && x.linkedTo === oldName;
    const relink = <T extends { linkedType: string | null; linkedTo: string }>(arr: T[]): T[] =>
      arr.map((x) => (hit(x) ? { ...x, linkedTo: newName } : x));
    // Only the lists with a link to the renamed thing (S7).
    const out: Partial<SessionData> = {};
    if (data.readAloud.some(hit)) out.readAloud = relink(data.readAloud);
    if (data.eventLog.some(hit)) out.eventLog = relink(data.eventLog);
    if (data.turningPoints.some(hit)) out.turningPoints = relink(data.turningPoints);
    return out;
  }

  function updatePlace(index: number, patch: Partial<SessionPlace>) {
    if (patch.name !== undefined && patch.name !== data.places[index].name) {
      onRenamePlaceCascade(index, patch.name);
      return;
    }
    onDataChange({ places: data.places.map((p, i) => (i === index ? { ...p, ...patch } : p)) });
  }

  // Which name a rename moves references from (S3): never an empty one, and a
  // cleared name carries over to the next one typed. See lib/session/rename.ts.
  const cleared = useRef<{ encounter: ClearedName | null; npc: ClearedName | null }>({ encounter: null, npc: null });
  function cascadeFrom(kind: "encounter" | "npc", index: number, length: number, oldName: string, newName: string): string | null {
    const step = renameStep(oldName, newName, rememberedFor(cleared.current[kind], index, length));
    cleared.current[kind] = step.remember === null ? null : { index, length, name: step.remember };
    return step.from;
  }

  function updateEncounter(index: number, patch: Partial<SessionEncounter>) {
    const oldName = data.encounters[index].name;
    const encounters = data.encounters.map((e, i) => (i === index ? { ...e, ...patch } : e));
    if (patch.name !== undefined && patch.name !== oldName) {
      const newName = patch.name;
      const from = cascadeFrom("encounter", index, data.encounters.length, oldName, newName);
      if (from === null) {
        onDataChange({ encounters });
        return;
      }
      // Items may be linked to the encounter by name; keep them in the scene.
      // Only lists that actually change are sent (S7).
      const changed: Partial<SessionData> = { encounters };
      if (data.items.some((it) => it.plannedLocation === from)) {
        changed.items = data.items.map((it) => (it.plannedLocation === from ? { ...it, plannedLocation: newName } : it));
      }
      if (data.equipment.some((eq) => eq.plannedLocation === from)) {
        changed.equipment = data.equipment.map((eq) => (eq.plannedLocation === from ? { ...eq, plannedLocation: newName } : eq));
      }
      onDataChange({ ...changed, ...relinkOnRename("encounter", from, newName) });
      return;
    }
    onDataChange({ encounters });
  }

  function updateNpc(index: number, patch: Partial<SessionNpc>) {
    const oldName = data.npcs[index].name;
    const npcs = data.npcs.map((n, i) => (i === index ? { ...n, ...patch } : n));
    if (patch.name !== undefined && patch.name !== oldName) {
      const from = cascadeFrom("npc", index, data.npcs.length, oldName, patch.name);
      onDataChange(from === null ? { npcs } : { npcs, ...relinkOnRename("npc", from, patch.name) });
      return;
    }
    onDataChange({ npcs });
  }

  function updateItem(index: number, patch: Partial<SessionItem>) {
    onDataChange({ items: data.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) });
  }

  function updateEquipment(index: number, patch: Partial<SessionEquipment>) {
    onDataChange({ equipment: data.equipment.map((eq, i) => (i === index ? { ...eq, ...patch } : eq)) });
  }

  function updateReadAloud(index: number, patch: Partial<SessionReadAloud>) {
    onDataChange({ readAloud: data.readAloud.map((r, i) => (i === index ? { ...r, ...patch } : r)) });
  }

  function patchAt(key: ContentKey, index: number, patch: Record<string, unknown>) {
    const updated = (data[key] as Record<string, unknown>[]).map((el, i) => (i === index ? { ...el, ...patch } : el));
    onDataChange({ [key]: updated });
  }

  function assignToPlace(key: PlaceLinkedKey, index: number, placeName: string) {
    // The same name can stand on several days (S9): keep the entry's own day
    // when a place of that name exists on it, else take the first.
    const current = (data[key] as { day?: unknown }[])[index];
    const named = data.places.filter((p) => p.name === placeName);
    const place = named.find((p) => current && String(p.day ?? "") === String(current.day ?? "")) ?? named[0];
    const patch: Record<string, unknown> = {};
    if (key === "encounters") patch.location = placeName;
    // Must set linkedType too, else rename-cascade and place grouping (which
    // scope by linkedType === "place") won't recognise the link.
    else if (key === "readAloud") Object.assign(patch, { linkedTo: placeName, linkedType: placeName ? "place" : null });
    else patch.plannedLocation = placeName;
    if (place?.day) patch.day = place.day;
    if (place?.time) patch.time = place.time;
    patchAt(key, index, patch);
  }

  /** Puts content in a scene: same place (or the encounter itself for read-alouds), day and time. */
  function moveToScene(key: PlaceLinkedKey, index: number, scene: SessionEncounter) {
    const when = { day: scene.day, time: scene.time };
    if (key === "encounters") return;
    if (key === "readAloud") patchAt(key, index, { ...when, linkedType: "encounter", linkedTo: scene.name });
    else patchAt(key, index, { ...when, plannedLocation: scene.location || scene.name });
  }

  /**
   * Edits a scene. When its day, time or place changes, what is in the scene
   * moves with it, so the links that put it there keep matching.
   */
  function updateScene(scene: Scene, patch: Partial<SessionEncounter>) {
    const old = data.encounters[scene.index];
    const moved = patch.day !== undefined || patch.time !== undefined || (patch.location !== undefined && patch.location !== old.location);
    // The scene form changes one field at a time, so a move never renames.
    if (!moved) {
      updateEncounter(scene.index, patch);
      return;
    }
    const when: Record<string, unknown> = {};
    if (patch.day !== undefined) when.day = patch.day;
    if (patch.time !== undefined) when.time = patch.time;
    const relocate = (link: string): string | undefined =>
      patch.location !== undefined && old.location && link === old.location ? patch.location : undefined;
    const follow = <T extends Record<string, unknown>>(arr: T[], idx: number[], linkKey: "plannedLocation" | "linkedTo"): T[] =>
      arr.map((el, i) => {
        if (!idx.includes(i)) return el;
        const loc = relocate(String(el[linkKey] ?? ""));
        return { ...el, ...when, ...(loc !== undefined ? { [linkKey]: loc } : {}) };
      });
    onDataChange({
      encounters: data.encounters.map((e, i) => (i === scene.index ? { ...e, ...patch } : e)),
      npcs: follow(data.npcs, scene.npcs, "plannedLocation"),
      items: follow(data.items, scene.items, "plannedLocation"),
      equipment: follow(data.equipment, scene.equipment, "plannedLocation"),
      readAloud: follow(data.readAloud, scene.readAloud, "linkedTo"),
    });
  }

  /** Takes content out of every scene (no place, no encounter link). */
  function moveOutOfScene(key: PlaceLinkedKey, index: number) {
    if (key === "encounters") return;
    if (key === "readAloud") patchAt(key, index, { linkedType: null, linkedTo: "" });
    else patchAt(key, index, { plannedLocation: "" });
  }

  function changeDay(kind: ContentKind, index: number, day: number | null) {
    patchAt(CONTENT_KEY[kind], index, { day: day ? String(day) : null });
  }

  function changeTime(kind: ContentKind, index: number, time: string | null) {
    patchAt(CONTENT_KEY[kind], index, { time });
  }

  return {
    placeNames, add, remove, updatePlace, updateEncounter, updateNpc, updateItem, updateEquipment, updateReadAloud,
    assignToPlace, moveToScene, moveOutOfScene, updateScene, changeDay, changeTime,
  };
}

export type SessionContent = ReturnType<typeof useSessionContent>;
