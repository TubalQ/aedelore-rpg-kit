"use client";

import { useState } from "react";
import type { SessionEncounter } from "@/lib/schemas/session";
import { EnemyList } from "./enemy-list";
import { STATUS_LABEL_KEYS, STATUS_STYLES, nextStatus } from "./encounter-status";
import { ContentMeta } from "./content-meta";
import { VisibilityToggle } from "./visibility-toggle";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { AutoTextarea } from "@/components/ui/auto-textarea";

interface EncounterCardProps {
  encounter: SessionEncounter;
  mode: "prep" | "play";
  disabled: boolean;
  onUpdate: (patch: Partial<SessionEncounter>) => void;
  onRemove: () => void;
  placeNames: string[];
  onAssignToPlace: (place: string) => void;
  onChangeDay: (day: number | null) => void;
  onChangeTime: (time: string | null) => void;
}

export function EncounterCard({
  encounter, mode, disabled, onUpdate, onRemove,
  placeNames, onAssignToPlace, onChangeDay, onChangeTime,
}: EncounterCardProps) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(mode === "prep");

  return (
    <div className="rounded border border-accent-red/30 bg-accent-red/5 p-2 space-y-1">
      <div className="flex items-center gap-2">
        <button onClick={() => setExpanded(!expanded)} className="p-2 -m-2 text-xs text-accent-red shrink-0">
          {expanded ? "▼" : "▶"}
        </button>
        <span className="text-xs text-accent-red shrink-0">{t("sessionCard.badge.encounter")}</span>
        <input
          type="text"
          value={encounter.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-text-base border-b border-transparent focus:border-accent-red focus:outline-none disabled:opacity-50"
          placeholder={t("sessionCard.encounter.namePlaceholder")} aria-label={t("sessionCard.encounter.namePlaceholder")}
        />
        <button
          onClick={() => onUpdate({ status: nextStatus(encounter.status) })}
          disabled={disabled}
          className={`rounded px-2 py-0.5 text-xs shrink-0 ${STATUS_STYLES[encounter.status]} disabled:opacity-50`}
        >
          {t(STATUS_LABEL_KEYS[encounter.status])}
        </button>
        <VisibilityToggle visibleTo={encounter.visibleTo} disabled={disabled} onChange={(v) => onUpdate({ visibleTo: v })} />
        {!disabled && mode === "prep" && (
          <button onClick={onRemove} aria-label={t("common.remove")} className="p-2 -m-2 text-accent-red hover:text-accent-red shrink-0"><X size={14} /></button>
        )}
      </div>
      {expanded && (
        <div className="ml-5 space-y-2">
          {/* Loot kan vara en lista med flera föremål - autosize i stället för enradig input */}
          <AutoTextarea
            value={encounter.loot}
            onChange={(e) => onUpdate({ loot: e.target.value })}
            disabled={disabled}
            rows={1}
            className="w-full rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base disabled:opacity-50 focus:border-accent-red focus:outline-none"
            placeholder={t("sessionCard.encounter.lootPlaceholder")} aria-label={t("sessionCard.encounter.lootPlaceholder")}
          />
          <AutoTextarea
            value={encounter.tactics}
            onChange={(e) => onUpdate({ tactics: e.target.value })}
            disabled={disabled}
            rows={2}
            className="w-full rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base disabled:opacity-50 focus:border-accent-red focus:outline-none"
            placeholder={t("sessionCard.encounter.tacticsPlaceholder")} aria-label={t("sessionCard.encounter.tacticsPlaceholder")}
          />
          {mode === "prep" && (
            <AutoTextarea
              value={encounter.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              disabled={disabled}
              rows={1}
              className="w-full rounded border border-accent-gold/20 bg-bg-base px-2 py-1 text-xs text-accent-gold/80 disabled:opacity-50 focus:border-accent-gold focus:outline-none"
              placeholder={t("sessionCard.notesLabel")} aria-label={t("sessionCard.notesLabel")}
            />
          )}

          <EnemyList enemies={encounter.enemies} mode={mode} disabled={disabled} onChange={(enemies) => onUpdate({ enemies })} />

          {mode === "prep" && (
            <ContentMeta
              day={encounter.day}
              time={encounter.time}
              disabled={disabled}
              placeNames={placeNames}
              currentPlace={encounter.location}
              onChangeDay={onChangeDay}
              onChangeTime={onChangeTime}
              onAssignToPlace={onAssignToPlace}
            />
          )}
        </div>
      )}
    </div>
  );
}
