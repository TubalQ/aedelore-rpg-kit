"use client";

import { useState } from "react";
import type { SessionData, SessionNpc, SessionPlace, SessionEncounter, SessionItem, SessionEquipment, SessionReadAloud } from "@/lib/schemas/session";
import { TIMES_OF_DAY, TIME_LABELS, TIME_ORDER } from "@/lib/domain/time";
import type { TimeOfDay } from "@/lib/domain/time";
import { useT } from "@/lib/i18n";
import { PlaceCard } from "./cards/place-card";
import { EncounterCard } from "./cards/encounter-card";
import { NpcCard } from "./cards/npc-card";
import { ItemCard } from "./cards/item-card";
import { EquipmentCard } from "./cards/equipment-card";
import { ReadAloudCard } from "./cards/read-aloud-card";

type ContentKind = "place" | "encounter" | "npc" | "item" | "equipment" | "readAloud";

interface DaySectionProps {
  day: number | null;
  data: SessionData;
  mode: "prep" | "play";
  disabled: boolean;
  placeNames: string[];
  onUpdatePlace: (index: number, patch: Partial<SessionPlace>) => void;
  onUpdateEncounter: (index: number, patch: Partial<SessionEncounter>) => void;
  onUpdateNpc: (index: number, patch: Partial<SessionNpc>) => void;
  onUpdateItem: (index: number, patch: Partial<SessionItem>) => void;
  onUpdateEquipment: (index: number, patch: Partial<SessionEquipment>) => void;
  onUpdateReadAloud: (index: number, patch: Partial<SessionReadAloud>) => void;
  onRemoveContent: (kind: ContentKind, index: number) => void;
  onAssignToPlace: (kind: "encounters" | "npcs" | "items" | "equipment" | "readAloud", index: number, placeName: string) => void;
  onChangeDay: (kind: ContentKind, index: number, day: number | null) => void;
  onChangeTime: (kind: ContentKind, index: number, time: string | null) => void;
  onAddContent: (kind: ContentKind, day: number | null, time: string | null, placeName?: string) => void;
  characterNames?: string[];
  onGiveEquipmentToCharacter?: (equipment: SessionEquipment) => void;
  onGiveItemToCharacter?: (item: SessionItem) => void;
}

type IndexedItem<T> = T & { _index: number };

function matchesDay(itemDay: unknown, sectionDay: number | null): boolean {
  if (sectionDay === null) return !itemDay;
  return Number(itemDay) === sectionDay;
}

export function DaySection({
  day, data, mode, disabled, placeNames,
  onUpdatePlace, onUpdateEncounter, onUpdateNpc, onUpdateItem, onUpdateEquipment, onUpdateReadAloud,
  onRemoveContent, onAssignToPlace, onChangeDay, onChangeTime, onAddContent,
  characterNames, onGiveEquipmentToCharacter, onGiveItemToCharacter,
}: DaySectionProps) {
  const { t } = useT();
  const [collapsed, setCollapsed] = useState(false);

  // Filter content for this day, preserving original index
  const places: IndexedItem<SessionPlace>[] = data.places
    .map((p, i) => ({ ...p, _index: i }))
    .filter((p) => matchesDay(p.day, day));
  const encounters: IndexedItem<SessionEncounter>[] = data.encounters
    .map((e, i) => ({ ...e, _index: i }))
    .filter((e) => matchesDay(e.day, day));
  const npcs: IndexedItem<SessionNpc>[] = data.npcs
    .map((n, i) => ({ ...n, _index: i }))
    .filter((n) => matchesDay(n.day, day));
  const items: IndexedItem<SessionItem>[] = data.items
    .map((it, i) => ({ ...it, _index: i }))
    .filter((it) => matchesDay(it.day, day));
  const equipment: IndexedItem<SessionEquipment>[] = data.equipment
    .map((eq, i) => ({ ...eq, _index: i }))
    .filter((eq) => matchesDay(eq.day, day));
  const readAloud: IndexedItem<SessionReadAloud>[] = data.readAloud
    .map((r, i) => ({ ...r, _index: i }))
    .filter((r) => matchesDay(r.day, day));

  const totalCount = places.length + encounters.length + npcs.length + items.length + equipment.length + readAloud.length;
  if (totalCount === 0) return null;

  // Group by time of day
  type TimeGroup = {
    places: IndexedItem<SessionPlace>[];
    encounters: IndexedItem<SessionEncounter>[];
    npcs: IndexedItem<SessionNpc>[];
    items: IndexedItem<SessionItem>[];
    equipment: IndexedItem<SessionEquipment>[];
    readAloud: IndexedItem<SessionReadAloud>[];
  };

  const timeGroups: Record<string, TimeGroup> = {};
  const noTime: TimeGroup = { places: [], encounters: [], npcs: [], items: [], equipment: [], readAloud: [] };

  function getGroup(time: string | null): TimeGroup {
    if (!time || !(time in TIME_ORDER)) return noTime;
    if (!timeGroups[time]) {
      timeGroups[time] = { places: [], encounters: [], npcs: [], items: [], equipment: [], readAloud: [] };
    }
    return timeGroups[time];
  }

  places.forEach((p) => getGroup(p.time).places.push(p));
  encounters.forEach((e) => getGroup(e.time).encounters.push(e));
  npcs.forEach((n) => getGroup(n.time).npcs.push(n));
  items.forEach((it) => getGroup(it.time).items.push(it));
  equipment.forEach((eq) => getGroup(eq.time).equipment.push(eq));
  readAloud.forEach((r) => getGroup(r.time).readAloud.push(r));

  const sortedTimes = Object.keys(timeGroups).sort(
    (a, b) => TIME_ORDER[a as TimeOfDay] - TIME_ORDER[b as TimeOfDay],
  );

  const hasNoTime = noTime.places.length + noTime.encounters.length + noTime.npcs.length + noTime.items.length + noTime.equipment.length + noTime.readAloud.length > 0;

  const dayLabel = day === null ? t("session.unscheduled") : t("session.dayN", { n: day });
  const borderColor = day === null ? "border-text-faint/30" : "border-accent-purple/50";

  return (
    <div className={`border-l-4 ${borderColor} pl-4 space-y-3`}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 text-text-base hover:text-accent-purple w-full text-left"
      >
        <span className={`text-xs transition-transform ${collapsed ? "" : "rotate-90"}`}>
          {"▶"}
        </span>
        <h3 className="text-base font-semibold">{dayLabel}</h3>
        <span className="text-xs text-text-faint">({totalCount})</span>
      </button>

      {!collapsed && (
        <div className="space-y-4">
          {sortedTimes.map((time) => (
            <TimeGroupSection
              key={time}
              time={time as TimeOfDay}
              group={timeGroups[time]}
              day={day}
              mode={mode}
              disabled={disabled}
              placeNames={placeNames}
              characterNames={characterNames}
              allEncounters={data.encounters}
              allNpcs={data.npcs}
              allItems={data.items}
              allEquipment={data.equipment}
              allReadAloud={data.readAloud}
              onUpdatePlace={onUpdatePlace}
              onUpdateEncounter={onUpdateEncounter}
              onUpdateNpc={onUpdateNpc}
              onUpdateItem={onUpdateItem}
              onUpdateEquipment={onUpdateEquipment}
              onUpdateReadAloud={onUpdateReadAloud}
              onRemoveContent={onRemoveContent}
              onAssignToPlace={onAssignToPlace}
              onChangeDay={onChangeDay}
              onChangeTime={onChangeTime}
              onGiveEquipmentToCharacter={onGiveEquipmentToCharacter}
              onGiveItemToCharacter={onGiveItemToCharacter}
            />
          ))}

          {hasNoTime && (
            <TimeGroupSection
              time={null}
              group={noTime}
              day={day}
              mode={mode}
              disabled={disabled}
              placeNames={placeNames}
              characterNames={characterNames}
              allEncounters={data.encounters}
              allNpcs={data.npcs}
              allItems={data.items}
              allEquipment={data.equipment}
              allReadAloud={data.readAloud}
              onUpdatePlace={onUpdatePlace}
              onUpdateEncounter={onUpdateEncounter}
              onUpdateNpc={onUpdateNpc}
              onUpdateItem={onUpdateItem}
              onUpdateEquipment={onUpdateEquipment}
              onUpdateReadAloud={onUpdateReadAloud}
              onRemoveContent={onRemoveContent}
              onAssignToPlace={onAssignToPlace}
              onChangeDay={onChangeDay}
              onChangeTime={onChangeTime}
              onGiveEquipmentToCharacter={onGiveEquipmentToCharacter}
              onGiveItemToCharacter={onGiveItemToCharacter}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Time Group ──────────────────────────────────────────

interface TimeGroupSectionProps {
  time: TimeOfDay | null;
  group: {
    places: IndexedItem<SessionPlace>[];
    encounters: IndexedItem<SessionEncounter>[];
    npcs: IndexedItem<SessionNpc>[];
    items: IndexedItem<SessionItem>[];
    equipment: IndexedItem<SessionEquipment>[];
    readAloud: IndexedItem<SessionReadAloud>[];
  };
  day: number | null;
  mode: "prep" | "play";
  disabled: boolean;
  placeNames: string[];
  characterNames?: string[];
  allEncounters: SessionEncounter[];
  allNpcs: SessionNpc[];
  allItems: SessionItem[];
  allEquipment: SessionEquipment[];
  allReadAloud: SessionReadAloud[];
  onUpdatePlace: (index: number, patch: Partial<SessionPlace>) => void;
  onUpdateEncounter: (index: number, patch: Partial<SessionEncounter>) => void;
  onUpdateNpc: (index: number, patch: Partial<SessionNpc>) => void;
  onUpdateItem: (index: number, patch: Partial<SessionItem>) => void;
  onUpdateEquipment: (index: number, patch: Partial<SessionEquipment>) => void;
  onUpdateReadAloud: (index: number, patch: Partial<SessionReadAloud>) => void;
  onRemoveContent: (kind: ContentKind, index: number) => void;
  onAssignToPlace: (kind: "encounters" | "npcs" | "items" | "equipment" | "readAloud", index: number, placeName: string) => void;
  onChangeDay: (kind: ContentKind, index: number, day: number | null) => void;
  onChangeTime: (kind: ContentKind, index: number, time: string | null) => void;
  onGiveEquipmentToCharacter?: (equipment: SessionEquipment) => void;
  onGiveItemToCharacter?: (item: SessionItem) => void;
}

function TimeGroupSection({
  time, group, day, mode, disabled, placeNames, characterNames,
  allEncounters, allNpcs, allItems, allEquipment, allReadAloud,
  onUpdatePlace, onUpdateEncounter, onUpdateNpc, onUpdateItem, onUpdateEquipment, onUpdateReadAloud,
  onRemoveContent, onAssignToPlace, onChangeDay, onChangeTime, onGiveEquipmentToCharacter, onGiveItemToCharacter,
}: TimeGroupSectionProps) {
  const { t } = useT();
  const TIME_LABEL_KEYS: Record<string, string> = {
    dawn: "session.timeDawn",
    morning: "session.timeMorning",
    noon: "session.timeNoon",
    afternoon: "session.timeAfternoon",
    dusk: "session.timeDusk",
    evening: "session.timeEvening",
    night: "session.timeNight",
  };
  const label = time ? t(TIME_LABEL_KEYS[time] as any) : t("session.noTime");

  // Build place-based hierarchy: each place shows its linked content nested underneath
  const placeGroups = group.places.map((place) => {
    const linked = {
      encounters: group.encounters.filter((e) => e.location === place.name),
      npcs: group.npcs.filter((n) => n.plannedLocation === place.name),
      items: group.items.filter((it) => it.plannedLocation === place.name),
      equipment: group.equipment.filter((eq) => eq.plannedLocation === place.name),
      readAloud: group.readAloud.filter((r) => r.linkedType === "place" && r.linkedTo === place.name),
    };
    return { place, linked };
  });

  // Unlinked content (not attached to any place in this time group)
  const linkedEncounterIndices = new Set(placeGroups.flatMap((pg) => pg.linked.encounters.map((e) => e._index)));
  const linkedNpcIndices = new Set(placeGroups.flatMap((pg) => pg.linked.npcs.map((n) => n._index)));
  const linkedItemIndices = new Set(placeGroups.flatMap((pg) => pg.linked.items.map((it) => it._index)));
  const linkedEquipIndices = new Set(placeGroups.flatMap((pg) => pg.linked.equipment.map((eq) => eq._index)));
  const linkedRaIndices = new Set(placeGroups.flatMap((pg) => pg.linked.readAloud.map((r) => r._index)));

  // readAloud can also be linked to an encounter/npc - nest it under that card.
  // Only treat it as "nested here" when its target is in THIS time group, so a
  // link to content in another group falls back to the unlinked list (visible,
  // never lost).
  const groupEncNames = new Set(group.encounters.map((e) => e.name));
  const groupNpcNames = new Set(group.npcs.map((n) => n.name));
  const isNestedRa = (r: SessionReadAloud) =>
    (r.linkedType === "encounter" && groupEncNames.has(r.linkedTo)) ||
    (r.linkedType === "npc" && groupNpcNames.has(r.linkedTo));

  const unlinked = {
    encounters: group.encounters.filter((e) => !linkedEncounterIndices.has(e._index)),
    npcs: group.npcs.filter((n) => !linkedNpcIndices.has(n._index)),
    items: group.items.filter((it) => !linkedItemIndices.has(it._index)),
    equipment: group.equipment.filter((eq) => !linkedEquipIndices.has(eq._index)),
    readAloud: group.readAloud.filter((r) => !linkedRaIndices.has(r._index) && !isNestedRa(r)),
  };
  const hasUnlinked = unlinked.encounters.length + unlinked.npcs.length + unlinked.items.length + unlinked.equipment.length + unlinked.readAloud.length > 0;

  const encounterNames = allEncounters.map((e) => e.name).filter(Boolean);
  const npcNames = allNpcs.map((n) => n.name).filter(Boolean);
  const raForEncounter = (name: string) =>
    group.readAloud.filter((r) => r.linkedType === "encounter" && r.linkedTo === name);
  const raForNpc = (name: string) =>
    group.readAloud.filter((r) => r.linkedType === "npc" && r.linkedTo === name);

  const renderReadAloud = (list: IndexedItem<SessionReadAloud>[]) =>
    list.map((ra) => (
      <ReadAloudCard
        key={ra._index}
        readAloud={ra}
        mode={mode}
        disabled={disabled}
        onUpdate={(patch) => onUpdateReadAloud(ra._index, patch)}
        onRemove={() => onRemoveContent("readAloud", ra._index)}
        placeNames={placeNames}
        encounterNames={encounterNames}
        npcNames={npcNames}
        onChangeDay={(d) => onChangeDay("readAloud", ra._index, d)}
        onChangeTime={(t) => onChangeTime("readAloud", ra._index, t)}
      />
    ));

  return (
    <div className="ml-2">
      <p className="text-xs text-text-faint font-medium mb-2">{label}</p>
      <div className="space-y-3">
        {placeGroups.map(({ place, linked }) => (
          <div key={place._index} className="rounded-lg border border-cyan-900/40 bg-cyan-950/10 p-3 space-y-2">
            <PlaceCard
              place={place}
              mode={mode}
              disabled={disabled}
              onUpdate={(patch) => onUpdatePlace(place._index, patch)}
              onRemove={() => onRemoveContent("place", place._index)}
              onChangeDay={(d) => onChangeDay("place", place._index, d)}
              onChangeTime={(t) => onChangeTime("place", place._index, t)}
            />
            {/* Nested linked content */}
            <div className="ml-4 space-y-2">
              {linked.encounters.map((enc) => (
                <div key={enc._index} className="space-y-2">
                  <EncounterCard
                    encounter={enc}
                    mode={mode}
                    disabled={disabled}
                    onUpdate={(patch) => onUpdateEncounter(enc._index, patch)}
                    onRemove={() => onRemoveContent("encounter", enc._index)}
                    placeNames={placeNames}
                    onAssignToPlace={(p) => onAssignToPlace("encounters", enc._index, p)}
                    onChangeDay={(d) => onChangeDay("encounter", enc._index, d)}
                    onChangeTime={(t) => onChangeTime("encounter", enc._index, t)}
                  />
                  {raForEncounter(enc.name).length > 0 && (
                    <div className="ml-4 space-y-2">{renderReadAloud(raForEncounter(enc.name))}</div>
                  )}
                </div>
              ))}
              {linked.npcs.map((npc) => (
                <div key={npc._index} className="space-y-2">
                  <NpcCard
                    npc={npc}
                    mode={mode}
                    disabled={disabled}
                    onUpdate={(patch) => onUpdateNpc(npc._index, patch)}
                    onRemove={() => onRemoveContent("npc", npc._index)}
                    placeNames={placeNames}
                    onAssignToPlace={(p) => onAssignToPlace("npcs", npc._index, p)}
                    onChangeDay={(d) => onChangeDay("npc", npc._index, d)}
                    onChangeTime={(t) => onChangeTime("npc", npc._index, t)}
                  />
                  {raForNpc(npc.name).length > 0 && (
                    <div className="ml-4 space-y-2">{renderReadAloud(raForNpc(npc.name))}</div>
                  )}
                </div>
              ))}
              {linked.items.map((item) => (
                <ItemCard
                  key={item._index}
                  item={item}
                  mode={mode}
                  disabled={disabled}
                  onUpdate={(patch) => onUpdateItem(item._index, patch)}
                  onRemove={() => onRemoveContent("item", item._index)}
                  placeNames={placeNames}
                  characterNames={characterNames ?? []}
                  onAssignToPlace={(p) => onAssignToPlace("items", item._index, p)}
                  onChangeDay={(d) => onChangeDay("item", item._index, d)}
                  onChangeTime={(t) => onChangeTime("item", item._index, t)}
                  onGiveToCharacter={onGiveItemToCharacter}
                />
              ))}
              {linked.equipment.map((eq) => (
                <EquipmentCard
                  key={eq._index}
                  equipment={eq}
                  mode={mode}
                  disabled={disabled}
                  onUpdate={(patch) => onUpdateEquipment(eq._index, patch)}
                  onRemove={() => onRemoveContent("equipment", eq._index)}
                  placeNames={placeNames}
                  characterNames={characterNames ?? []}
                  onAssignToPlace={(p) => onAssignToPlace("equipment", eq._index, p)}
                  onChangeDay={(d) => onChangeDay("equipment", eq._index, d)}
                  onChangeTime={(t) => onChangeTime("equipment", eq._index, t)}
                  onGiveToCharacter={onGiveEquipmentToCharacter}
                />
              ))}
              {renderReadAloud(linked.readAloud)}
            </div>
          </div>
        ))}

        {/* Unlinked content */}
        {hasUnlinked && (
          <div className="space-y-2">
            {unlinked.encounters.map((enc) => (
              <div key={enc._index} className="space-y-2">
                <EncounterCard
                  encounter={enc}
                  mode={mode}
                  disabled={disabled}
                  onUpdate={(patch) => onUpdateEncounter(enc._index, patch)}
                  onRemove={() => onRemoveContent("encounter", enc._index)}
                  placeNames={placeNames}
                  onAssignToPlace={(p) => onAssignToPlace("encounters", enc._index, p)}
                  onChangeDay={(d) => onChangeDay("encounter", enc._index, d)}
                  onChangeTime={(t) => onChangeTime("encounter", enc._index, t)}
                />
                {raForEncounter(enc.name).length > 0 && (
                  <div className="ml-4 space-y-2">{renderReadAloud(raForEncounter(enc.name))}</div>
                )}
              </div>
            ))}
            {unlinked.npcs.map((npc) => (
              <div key={npc._index} className="space-y-2">
                <NpcCard
                  npc={npc}
                  mode={mode}
                  disabled={disabled}
                  onUpdate={(patch) => onUpdateNpc(npc._index, patch)}
                  onRemove={() => onRemoveContent("npc", npc._index)}
                  placeNames={placeNames}
                  onAssignToPlace={(p) => onAssignToPlace("npcs", npc._index, p)}
                  onChangeDay={(d) => onChangeDay("npc", npc._index, d)}
                  onChangeTime={(t) => onChangeTime("npc", npc._index, t)}
                />
                {raForNpc(npc.name).length > 0 && (
                  <div className="ml-4 space-y-2">{renderReadAloud(raForNpc(npc.name))}</div>
                )}
              </div>
            ))}
            {unlinked.items.map((item) => (
              <ItemCard
                key={item._index}
                item={item}
                mode={mode}
                disabled={disabled}
                onUpdate={(patch) => onUpdateItem(item._index, patch)}
                onRemove={() => onRemoveContent("item", item._index)}
                placeNames={placeNames}
                characterNames={characterNames ?? []}
                onAssignToPlace={(p) => onAssignToPlace("items", item._index, p)}
                onChangeDay={(d) => onChangeDay("item", item._index, d)}
                onChangeTime={(t) => onChangeTime("item", item._index, t)}
                onGiveToCharacter={onGiveItemToCharacter}
              />
            ))}
            {unlinked.equipment.map((eq) => (
              <EquipmentCard
                key={eq._index}
                equipment={eq}
                mode={mode}
                disabled={disabled}
                onUpdate={(patch) => onUpdateEquipment(eq._index, patch)}
                onRemove={() => onRemoveContent("equipment", eq._index)}
                placeNames={placeNames}
                characterNames={characterNames ?? []}
                onAssignToPlace={(p) => onAssignToPlace("equipment", eq._index, p)}
                onChangeDay={(d) => onChangeDay("equipment", eq._index, d)}
                onChangeTime={(t) => onChangeTime("equipment", eq._index, t)}
                onGiveToCharacter={onGiveEquipmentToCharacter}
              />
            ))}
            {renderReadAloud(unlinked.readAloud)}
          </div>
        )}
      </div>
    </div>
  );
}
