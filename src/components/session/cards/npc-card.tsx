"use client";

import { useState } from "react";
import type { SessionNpc } from "@/lib/schemas/session";
import { ContentMeta } from "./content-meta";
import { VisibilityToggle } from "./visibility-toggle";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { AutoTextarea } from "@/components/ui/auto-textarea";

interface NpcCardProps {
  npc: SessionNpc;
  mode: "prep" | "play";
  disabled: boolean;
  onUpdate: (patch: Partial<SessionNpc>) => void;
  onRemove: () => void;
  placeNames: string[];
  onAssignToPlace: (place: string) => void;
  onChangeDay: (day: number | null) => void;
  onChangeTime: (time: string | null) => void;
}

export function NpcCard({
  npc, mode, disabled, onUpdate, onRemove,
  placeNames, onAssignToPlace, onChangeDay, onChangeTime,
}: NpcCardProps) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(mode === "prep");

  return (
    <div className="rounded border border-accent-blue/30 bg-accent-blue/5 p-2 space-y-1">
      <div className="flex items-center gap-2">
        <button onClick={() => setExpanded(!expanded)} className="p-2 -m-2 text-xs text-accent-blue shrink-0">
          {expanded ? "▼" : "▶"}
        </button>
        <span className="text-xs text-accent-blue shrink-0">NPC</span>
        <input
          type="text"
          value={npc.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-text-base border-b border-transparent focus:border-accent-blue focus:outline-none disabled:opacity-50"
          placeholder={t("sessionCard.npc.namePlaceholder")} aria-label={t("sessionCard.npc.namePlaceholder")}
        />
        {mode === "play" && (
          <button
            onClick={() => onUpdate({ status: npc.status === "unused" ? "used" : "unused" })}
            disabled={disabled}
            className={`rounded px-2 py-0.5 text-xs shrink-0 ${
              npc.status === "used" ? "bg-accent-green/10 text-accent-green" : "bg-bg-base text-text-faint"
            } disabled:opacity-50`}
          >
            {npc.status === "used" ? t("sessionCard.npc.used") : t("sessionCard.npc.unused")}
          </button>
        )}
        <VisibilityToggle visibleTo={npc.visibleTo} disabled={disabled} onChange={(v) => onUpdate({ visibleTo: v })} />
        {!disabled && mode === "prep" && (
          <button onClick={onRemove} aria-label={t("common.remove")} className="p-2 -m-2 text-accent-red hover:text-accent-red shrink-0"><X size={14} /></button>
        )}
      </div>
      {expanded && (
        <div className="ml-5 space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <input
              type="text"
              value={npc.role}
              onChange={(e) => onUpdate({ role: e.target.value })}
              disabled={disabled}
              className="rounded border border-border bg-bg-base px-2 py-0.5 text-xs text-text-base disabled:opacity-50 focus:outline-none"
              placeholder={t("sessionCard.npc.rolePlaceholder")} aria-label={t("sessionCard.npc.rolePlaceholder")}
            />
            <input
              type="text"
              value={npc.disposition}
              onChange={(e) => onUpdate({ disposition: e.target.value })}
              disabled={disabled}
              className="rounded border border-border bg-bg-base px-2 py-0.5 text-xs text-text-base disabled:opacity-50 focus:outline-none"
              placeholder={t("sessionCard.npc.dispositionPlaceholder")} aria-label={t("sessionCard.npc.dispositionPlaceholder")}
            />
          </div>
          {mode === "play" && (
            <input
              type="text"
              value={npc.actualLocation}
              onChange={(e) => onUpdate({ actualLocation: e.target.value })}
              disabled={disabled}
              className="w-full rounded border border-border bg-bg-base px-2 py-0.5 text-xs text-text-base disabled:opacity-50 focus:outline-none"
              placeholder={t("sessionCard.npc.actualLocationPlaceholder")} aria-label={t("sessionCard.npc.actualLocationPlaceholder")}
            />
          )}
          <AutoTextarea
            value={npc.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            disabled={disabled}
            rows={2}
            className="w-full rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base disabled:opacity-50 focus:outline-none"
            placeholder={t("common.description")} aria-label={t("common.description")}
          />
          {mode === "prep" && (
            <AutoTextarea
              value={npc.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              disabled={disabled}
              rows={1}
              className="w-full rounded border border-accent-gold/20 bg-bg-base px-2 py-1 text-xs text-accent-gold/80 disabled:opacity-50 focus:border-accent-gold focus:outline-none"
              placeholder={t("sessionCard.notesLabel")} aria-label={t("sessionCard.notesLabel")}
            />
          )}
          {mode === "prep" && (
            <ContentMeta
              day={npc.day}
              time={npc.time}
              disabled={disabled}
              placeNames={placeNames}
              currentPlace={npc.plannedLocation}
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
