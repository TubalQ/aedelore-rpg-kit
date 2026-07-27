"use client";

import { useState } from "react";
import type { SessionData, SessionNpc, SessionPlace, SessionEncounter, SessionItem, SessionEquipment, SessionReadAloud } from "@/lib/schemas/session";
import { TIMES_OF_DAY, TIME_LABELS, TIME_ORDER } from "@/lib/domain/time";
import type { TimeOfDay } from "@/lib/domain/time";
import { DaySection } from "./day-section";
import { useT } from "@/lib/i18n";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import type { TranslationKey } from "@/lib/i18n";

interface PrepViewProps {
  data: SessionData;
  disabled: boolean;
  onDataChange: (patch: Partial<SessionData>) => void;
  onRenamePlaceCascade: (index: number, newName: string) => void;
}

type ContentKind = "place" | "encounter" | "npc" | "item" | "equipment" | "readAloud";

export function PrepView({ data, disabled, onDataChange, onRenamePlaceCascade }: PrepViewProps) {
  const { t } = useT();
  const [dayFilter, setDayFilter] = useState<number | "all" | "unscheduled">("all");

  // Collect all days used across content
  const usedDays = new Set<number>();
  for (const key of ["places", "encounters", "npcs", "items", "equipment", "readAloud"] as const) {
    for (const item of data[key]) {
      const d = (item as Record<string, unknown>).day;
      if (typeof d === "number" || (typeof d === "string" && d !== "")) {
        usedDays.add(Number(d));
      }
    }
  }
  const sortedDays = Array.from(usedDays).sort((a, b) => a - b);

  const hasUnscheduled = (["places", "encounters", "npcs", "items", "equipment", "readAloud"] as const).some(
    (key) => data[key].some((item: Record<string, unknown>) => !item.day),
  );

  // Content helpers
  function placeNames(): string[] {
    return data.places.filter((p) => p.name).map((p) => p.name);
  }

  function addContent(kind: ContentKind, day: number | null, time: string | null, placeName?: string) {
    if (kind === "place") {
      onDataChange({
        places: [
          ...data.places,
          { name: "", description: "", visited: false, day: day ? String(day) : null, time, notes: "", visibleTo: "all" },
        ],
      });
    } else if (kind === "encounter") {
      onDataChange({
        encounters: [
          ...data.encounters,
          {
            name: "", location: placeName ?? "", enemies: [], tactics: "", loot: "",
            status: "planned", day: day ? String(day) : null, time, notes: "", visibleTo: "all",
          },
        ],
      });
    } else if (kind === "npc") {
      onDataChange({
        npcs: [
          ...data.npcs,
          {
            name: "", role: "", description: "", plannedLocation: placeName ?? "", actualLocation: "",
            disposition: "", status: "unused", day: day ? String(day) : null, time, notes: "", visibleTo: "all",
          },
        ],
      });
    } else if (kind === "item") {
      onDataChange({
        items: [
          ...data.items,
          {
            name: "", description: "", plannedLocation: placeName ?? "", actualLocation: "",
            found: false, givenTo: "", day: day ? String(day) : null, time, notes: "", visibleTo: "all",
          },
        ],
      });
    } else if (kind === "equipment") {
      onDataChange({
        equipment: [
          ...data.equipment,
          {
            name: "", type: "misc", baseWeapon: "", atkBonus: "", damage: "", range: "",
            breakVal: "", advantage: "", baseArmor: "", bodypart: "", hp: 0, ac: 0,
            disadvantage: "", description: "", bonuses: [], specialEffect: "", rarity: "common",
            givenTo: "", plannedLocation: placeName ?? "",
            day: day ? String(day) : null, time, notes: "", visibleTo: "dm",
          },
        ],
      });
    } else if (kind === "readAloud") {
      onDataChange({
        readAloud: [
          ...data.readAloud,
          {
            title: "", text: "", read: false, day: day ? String(day) : null, time,
            linkedType: placeName ? "place" : null, linkedTo: placeName ?? "", visibleTo: "all",
          },
        ],
      });
    }
  }

  function removeContent(kind: ContentKind, index: number) {
    const key = kind === "place" ? "places" : kind === "encounter" ? "encounters" : kind === "npc" ? "npcs" : kind === "item" ? "items" : kind === "equipment" ? "equipment" : "readAloud";
    onDataChange({ [key]: data[key].filter((_: unknown, i: number) => i !== index) });
  }

  function updatePlace(index: number, patch: Partial<SessionPlace>) {
    if (patch.name !== undefined && patch.name !== data.places[index].name) {
      onRenamePlaceCascade(index, patch.name);
      return;
    }
    onDataChange({
      places: data.places.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    });
  }

  // Relink readAloud/eventLog/turningPoints whose linkedType matches when an
  // npc/encounter is renamed, so links don't silently break (mirrors places).
  function relinkOnRename(linkType: "npc" | "encounter", oldName: string, newName: string) {
    const relink = <T extends { linkedType: string | null; linkedTo: string }>(arr: T[]): T[] =>
      arr.map((x) => (x.linkedType === linkType && x.linkedTo === oldName ? { ...x, linkedTo: newName } : x));
    return {
      readAloud: relink(data.readAloud),
      eventLog: relink(data.eventLog),
      turningPoints: relink(data.turningPoints),
    };
  }

  function updateEncounter(index: number, patch: Partial<SessionEncounter>) {
    const oldName = data.encounters[index].name;
    const encounters = data.encounters.map((e, i) => (i === index ? { ...e, ...patch } : e));
    if (patch.name !== undefined && patch.name !== oldName) {
      onDataChange({ encounters, ...relinkOnRename("encounter", oldName, patch.name) });
      return;
    }
    onDataChange({ encounters });
  }

  function updateNpc(index: number, patch: Partial<SessionNpc>) {
    const oldName = data.npcs[index].name;
    const npcs = data.npcs.map((n, i) => (i === index ? { ...n, ...patch } : n));
    if (patch.name !== undefined && patch.name !== oldName) {
      onDataChange({ npcs, ...relinkOnRename("npc", oldName, patch.name) });
      return;
    }
    onDataChange({ npcs });
  }

  function updateItem(index: number, patch: Partial<SessionItem>) {
    onDataChange({
      items: data.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    });
  }

  function updateEquipment(index: number, patch: Partial<SessionEquipment>) {
    onDataChange({
      equipment: data.equipment.map((eq, i) => (i === index ? { ...eq, ...patch } : eq)),
    });
  }

  function updateReadAloud(index: number, patch: Partial<SessionReadAloud>) {
    onDataChange({
      readAloud: data.readAloud.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });
  }

  function assignToPlace(kind: "encounters" | "npcs" | "items" | "equipment" | "readAloud", index: number, placeName: string) {
    const item = data[kind][index] as Record<string, unknown>;
    const place = data.places.find((p) => p.name === placeName);
    const patch: Record<string, unknown> = {};
    if (kind === "encounters") {
      patch.location = placeName;
    } else if (kind === "readAloud") {
      // Must set linkedType too, else rename-cascade and place grouping (which
      // scope by linkedType === "place") won't recognise the link.
      patch.linkedTo = placeName;
      patch.linkedType = placeName ? "place" : null;
    } else {
      patch.plannedLocation = placeName;
    }
    if (place) {
      if (place.day) patch.day = place.day;
      if (place.time) patch.time = place.time;
    }
    const updated = data[kind].map((el: Record<string, unknown>, i: number) =>
      i === index ? { ...el, ...patch } : el,
    );
    onDataChange({ [kind]: updated });
  }

  function changeDay(kind: ContentKind, index: number, day: number | null) {
    const key = kind === "place" ? "places" : kind === "encounter" ? "encounters" : kind === "npc" ? "npcs" : kind === "item" ? "items" : kind === "equipment" ? "equipment" : "readAloud";
    const updated = data[key].map((el: Record<string, unknown>, i: number) =>
      i === index ? { ...el, day: day ? String(day) : null } : el,
    );
    onDataChange({ [key]: updated });
  }

  function changeTime(kind: ContentKind, index: number, time: string | null) {
    const key = kind === "place" ? "places" : kind === "encounter" ? "encounters" : kind === "npc" ? "npcs" : kind === "item" ? "items" : kind === "equipment" ? "equipment" : "readAloud";
    const updated = data[key].map((el: Record<string, unknown>, i: number) =>
      i === index ? { ...el, time } : el,
    );
    onDataChange({ [key]: updated });
  }

  // Determine which days to render
  const daysToRender: (number | null)[] = [];
  if (dayFilter === "all") {
    daysToRender.push(...sortedDays);
    if (hasUnscheduled) daysToRender.push(null);
  } else if (dayFilter === "unscheduled") {
    daysToRender.push(null);
  } else {
    daysToRender.push(dayFilter);
  }

  // Add new day
  function addDay() {
    const nextDay = sortedDays.length > 0 ? sortedDays[sortedDays.length - 1] + 1 : 1;
    addContent("place", nextDay, null);
    setDayFilter(nextDay);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: add content + day filter */}
      <div className="flex flex-wrap items-center gap-2">
        {!disabled && (
          <>
            <span className="text-xs text-text-faint mr-1">{t("session.addLabel")}</span>
            {(["place", "encounter", "npc", "item", "equipment", "readAloud"] as const).map((kind) => {
              const labelKeys: Record<ContentKind, TranslationKey> = {
                place: "session.place",
                encounter: "session.encounter",
                npc: "session.npc",
                item: "session.item",
                equipment: "session.equipment",
                readAloud: "session.readAloud",
              };
              const colors: Record<ContentKind, string> = {
                place: "text-cyan-400 hover:bg-cyan-950",
                encounter: "text-red-400 hover:bg-red-950",
                npc: "text-blue-400 hover:bg-blue-950",
                item: "text-amber-400 hover:bg-amber-950",
                equipment: "text-emerald-400 hover:bg-emerald-950",
                readAloud: "text-purple-400 hover:bg-purple-950",
              };
              return (
                <button
                  key={kind}
                  onClick={() => {
                    const day = typeof dayFilter === "number" ? dayFilter : null;
                    addContent(kind, day, null);
                  }}
                  className={`rounded border border-border px-2 py-1 text-xs ${colors[kind]}`}
                >
                  + {t(labelKeys[kind])}
                </button>
              );
            })}
            <button
              onClick={addDay}
              className="rounded border border-border px-2 py-1 text-xs text-accent-gold hover:bg-accent-gold/10"
            >
              + {t("session.addDay")}
            </button>
          </>
        )}
      </div>

      {/* Day filter tabs */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setDayFilter("all")}
          className={`rounded px-3 py-1 text-xs font-medium ${
            dayFilter === "all" ? "bg-accent-purple text-white" : "bg-bg-surface text-text-muted hover:text-text-base"
          }`}
        >
          {t("session.allDays")}
        </button>
        {sortedDays.map((day) => (
          <button
            key={day}
            onClick={() => setDayFilter(day)}
            className={`rounded px-3 py-1 text-xs font-medium ${
              dayFilter === day ? "bg-accent-purple text-white" : "bg-bg-surface text-text-muted hover:text-text-base"
            }`}
          >
            {t("session.dayN", { n: day })}
          </button>
        ))}
        {hasUnscheduled && (
          <button
            onClick={() => setDayFilter("unscheduled")}
            className={`rounded px-3 py-1 text-xs font-medium ${
              dayFilter === "unscheduled" ? "bg-accent-purple text-white" : "bg-bg-surface text-text-muted hover:text-text-base"
            }`}
          >
            {t("session.unscheduled")}
          </button>
        )}
      </div>

      {/* Day sections */}
      {daysToRender.length === 0 && (
        <div className="text-center py-8 text-text-faint">
          <p>{t("session.noContent")}</p>
        </div>
      )}

      {daysToRender.map((day) => (
        <DaySection
          key={day ?? "unscheduled"}
          day={day}
          data={data}
          mode="prep"
          disabled={disabled}
          placeNames={placeNames()}
          onUpdatePlace={updatePlace}
          onUpdateEncounter={updateEncounter}
          onUpdateNpc={updateNpc}
          onUpdateItem={updateItem}
          onUpdateEquipment={updateEquipment}
          onUpdateReadAloud={updateReadAloud}
          onRemoveContent={removeContent}
          onAssignToPlace={assignToPlace}
          onChangeDay={changeDay}
          onChangeTime={changeTime}
          onAddContent={addContent}
        />
      ))}

      {/* DM Notes (always in prep, not day-based) */}
      <section className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-amber-200">
            {t("session.dmNotes")} {data.dmNotes.length > 0 && `(${data.dmNotes.length})`}
          </h2>
          {!disabled && (
            <button
              onClick={() =>
                onDataChange({
                  dmNotes: [
                    ...data.dmNotes,
                    { timestamp: new Date().toISOString(), text: "", category: "plan" },
                  ],
                })
              }
              className="rounded bg-amber-800/30 px-3 py-1 text-xs text-amber-300 hover:bg-amber-800/50"
            >
              {t("common.add")}
            </button>
          )}
        </div>
        <p className="text-xs text-amber-400/60">{t("session.dmNotesHelp")}</p>
        {data.dmNotes.map((note, i) => (
          <div key={i} className="flex gap-2 items-start">
            <select
              value={note.category}
              onChange={(e) => {
                const updated = data.dmNotes.map((n, j) =>
                  j === i ? { ...n, category: e.target.value as typeof note.category } : n,
                );
                onDataChange({ dmNotes: updated });
              }}
              disabled={disabled}
              className="rounded border border-amber-900/30 bg-bg-base px-2 py-1 text-xs text-text-base disabled:opacity-50 shrink-0"
            >
              <option value="plot">{t("session.notePlot")}</option>
              <option value="mechanic">{t("session.noteMechanic")}</option>
              <option value="npc">{t("session.noteNpc")}</option>
              <option value="plan">{t("session.notePlan")}</option>
              <option value="reminder">{t("session.noteReminder")}</option>
            </select>
            <AutoTextarea
              value={note.text}
              onChange={(e) => {
                const updated = data.dmNotes.map((n, j) => (j === i ? { ...n, text: e.target.value } : n));
                onDataChange({ dmNotes: updated });
              }}
              disabled={disabled}
              rows={2}
              className="flex-1 rounded border border-amber-900/30 bg-bg-base px-2 py-1 text-xs text-text-base disabled:opacity-50 focus:border-amber-600 focus:outline-none"
              placeholder={t("session.notePlaceholder")}
            />
            {!disabled && (
              <button
                onClick={() => onDataChange({ dmNotes: data.dmNotes.filter((_, j) => j !== i) })}
                className="text-xs text-red-400 hover:text-red-300 shrink-0"
              >
                X
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
