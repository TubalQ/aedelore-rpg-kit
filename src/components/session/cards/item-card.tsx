"use client";

import { useState } from "react";
import type { SessionItem } from "@/lib/schemas/session";
import { ContentMeta } from "./content-meta";
import { VisibilityToggle } from "./visibility-toggle";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { AutoTextarea } from "@/components/ui/auto-textarea";

interface ItemCardProps {
  item: SessionItem;
  mode: "prep" | "play";
  disabled: boolean;
  onUpdate: (patch: Partial<SessionItem>) => void;
  onRemove: () => void;
  placeNames: string[];
  characterNames: string[];
  onAssignToPlace: (place: string) => void;
  onChangeDay: (day: number | null) => void;
  onChangeTime: (time: string | null) => void;
  onGiveToCharacter?: (item: SessionItem) => void;
}

export function ItemCard({
  item, mode, disabled, onUpdate, onRemove,
  placeNames, characterNames, onAssignToPlace, onChangeDay, onChangeTime,
  onGiveToCharacter,
}: ItemCardProps) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(mode === "prep");

  return (
    <div className="rounded border border-amber-900/40 bg-amber-950/10 p-2 space-y-1">
      <div className="flex items-center gap-2">
        <button onClick={() => setExpanded(!expanded)} className="p-2 -m-2 text-xs text-amber-400 shrink-0">
          {expanded ? "▼" : "▶"}
        </button>
        <span className="text-xs text-amber-400 shrink-0">{t("session.item")}</span>
        <input
          type="text"
          value={item.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm font-medium text-text-base border-b border-transparent focus:border-amber-600 focus:outline-none disabled:opacity-50"
          placeholder={t("sessionCard.item.namePlaceholder")}
        />
        {mode === "play" && (
          <button
            onClick={() => onUpdate({ found: !item.found })}
            disabled={disabled}
            className={`rounded px-2 py-0.5 text-xs shrink-0 ${
              item.found ? "bg-green-900/30 text-green-400" : "bg-bg-base text-text-faint"
            } disabled:opacity-50`}
          >
            {item.found ? t("sessionCard.item.found") : t("sessionCard.item.notFound")}
          </button>
        )}
        <VisibilityToggle visibleTo={item.visibleTo} disabled={disabled} onChange={(v) => onUpdate({ visibleTo: v })} />
        {!disabled && mode === "prep" && (
          <button onClick={onRemove} aria-label={t("common.remove")} className="p-2 -m-2 text-red-400 hover:text-red-300 shrink-0"><X size={14} /></button>
        )}
      </div>
      {expanded && (
        <div className="ml-5 space-y-1">
          <AutoTextarea
            value={item.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            disabled={disabled}
            rows={2}
            className="w-full rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base disabled:opacity-50 focus:outline-none"
            placeholder={t("common.description")}
          />
          {mode === "prep" && (
            <AutoTextarea
              value={item.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              disabled={disabled}
              rows={1}
              className="w-full rounded border border-amber-900/30 bg-bg-base px-2 py-1 text-xs text-amber-200/80 disabled:opacity-50 focus:border-amber-600 focus:outline-none"
              placeholder={t("sessionCard.notesLabel")}
            />
          )}
          {mode === "play" && (
            <div className="flex items-center gap-2">
              <select
                value={item.givenTo}
                onChange={(e) => onUpdate({ givenTo: e.target.value })}
                disabled={disabled}
                className="flex-1 rounded border border-border bg-bg-base px-2 py-0.5 text-xs text-text-base disabled:opacity-50 focus:outline-none"
              >
                <option value="">{t("sessionCard.item.notGiven")}</option>
                {characterNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {onGiveToCharacter && item.name && item.givenTo && (
                <button
                  onClick={() => onGiveToCharacter(item)}
                  disabled={disabled}
                  className="shrink-0 rounded bg-emerald-800/30 px-2 py-0.5 text-xs text-emerald-400 hover:bg-emerald-800/50 disabled:opacity-50"
                >
                  {t("sessionCard.item.giveToCharacter")}
                </button>
              )}
            </div>
          )}
          {mode === "prep" && (
            <ContentMeta
              day={item.day}
              time={item.time}
              disabled={disabled}
              placeNames={placeNames}
              currentPlace={item.plannedLocation}
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
