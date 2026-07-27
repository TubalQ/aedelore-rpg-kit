"use client";

import { useState } from "react";
import type { SessionPlace } from "@/lib/schemas/session";
import { ContentMeta } from "./content-meta";
import { VisibilityToggle } from "./visibility-toggle";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { AutoTextarea } from "@/components/ui/auto-textarea";

interface PlaceCardProps {
  place: SessionPlace;
  mode: "prep" | "play";
  disabled: boolean;
  onUpdate: (patch: Partial<SessionPlace>) => void;
  onRemove: () => void;
  onChangeDay: (day: number | null) => void;
  onChangeTime: (time: string | null) => void;
}

export function PlaceCard({ place, mode, disabled, onUpdate, onRemove, onChangeDay, onChangeTime }: PlaceCardProps) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <div className="flex items-center gap-2">
        <button onClick={() => setExpanded(!expanded)} className="p-2 -m-2 text-xs text-cyan-400 shrink-0">
          {expanded ? "▼" : "▶"}
        </button>
        <span className="text-xs text-cyan-400 shrink-0">{t("session.place")}</span>
        <input
          type="text"
          value={place.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm font-medium text-text-base border-b border-transparent focus:border-cyan-600 focus:outline-none disabled:opacity-50"
          placeholder={t("sessionCard.place.namePlaceholder")}
        />
        {mode === "play" && (
          <button
            onClick={() => onUpdate({ visited: !place.visited })}
            disabled={disabled}
            className={`rounded px-2 py-0.5 text-xs shrink-0 ${
              place.visited ? "bg-green-900/30 text-green-400" : "bg-bg-base text-text-faint"
            } disabled:opacity-50`}
          >
            {place.visited ? t("sessionCard.place.visited") : t("sessionCard.place.notVisited")}
          </button>
        )}
        <VisibilityToggle visibleTo={place.visibleTo} disabled={disabled} onChange={(v) => onUpdate({ visibleTo: v })} />
        {!disabled && mode === "prep" && (
          <button onClick={onRemove} aria-label={t("common.remove")} className="p-2 -m-2 text-red-400 hover:text-red-300 shrink-0"><X size={14} /></button>
        )}
      </div>
      {expanded && (
        <div className="mt-1 ml-5 space-y-1">
          <AutoTextarea
            value={place.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            disabled={disabled}
            rows={2}
            className="w-full rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base disabled:opacity-50 focus:border-cyan-600 focus:outline-none"
            placeholder={t("common.description")}
          />
          {mode === "prep" && (
            <AutoTextarea
              value={place.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              disabled={disabled}
              rows={1}
              className="w-full rounded border border-amber-900/30 bg-bg-base px-2 py-1 text-xs text-amber-200/80 disabled:opacity-50 focus:border-amber-600 focus:outline-none"
              placeholder={t("sessionCard.notesLabel")}
            />
          )}
          {mode === "prep" && (
            <ContentMeta
              day={place.day}
              time={place.time}
              disabled={disabled}
              onChangeDay={onChangeDay}
              onChangeTime={onChangeTime}
            />
          )}
        </div>
      )}
    </div>
  );
}
