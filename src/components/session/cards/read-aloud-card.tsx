"use client";

import { useState } from "react";
import type { SessionReadAloud } from "@/lib/schemas/session";
import { ContentMeta } from "./content-meta";
import { VisibilityToggle } from "./visibility-toggle";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { AutoTextarea } from "@/components/ui/auto-textarea";

interface ReadAloudCardProps {
  readAloud: SessionReadAloud;
  mode: "prep" | "play";
  disabled: boolean;
  onUpdate: (patch: Partial<SessionReadAloud>) => void;
  onRemove: () => void;
  placeNames: string[];
  encounterNames: string[];
  npcNames: string[];
  onChangeDay: (day: number | null) => void;
  onChangeTime: (time: string | null) => void;
}

export function ReadAloudCard({
  readAloud, mode, disabled, onUpdate, onRemove,
  placeNames, encounterNames, npcNames, onChangeDay, onChangeTime,
}: ReadAloudCardProps) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(mode === "prep" || mode === "play");

  const targetNames =
    readAloud.linkedType === "place" ? placeNames :
    readAloud.linkedType === "encounter" ? encounterNames :
    readAloud.linkedType === "npc" ? npcNames : [];

  return (
    <div className="rounded border border-accent-purple/30 bg-accent-purple/5 p-2 space-y-1">
      <div className="flex items-center gap-2">
        <button onClick={() => setExpanded(!expanded)} className="p-2 -m-2 text-xs text-accent-purple shrink-0">
          {expanded ? "▼" : "▶"}
        </button>
        <span className="text-xs text-accent-purple shrink-0">{t("sessionCard.badge.readAloud")}</span>
        <input
          type="text"
          value={readAloud.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-text-base border-b border-transparent focus:border-accent-purple focus:outline-none disabled:opacity-50"
          placeholder={t("sessionCard.readAloud.titlePlaceholder")} aria-label={t("sessionCard.readAloud.titlePlaceholder")}
        />
        {mode === "play" && (
          <button
            onClick={() => onUpdate({ read: !readAloud.read })}
            disabled={disabled}
            className={`rounded px-2 py-0.5 text-xs shrink-0 ${
              readAloud.read ? "bg-accent-green/10 text-accent-green" : "bg-bg-base text-text-faint"
            } disabled:opacity-50`}
          >
            {readAloud.read ? t("sessionCard.readAloud.read") : t("sessionCard.readAloud.notRead")}
          </button>
        )}
        <VisibilityToggle visibleTo={readAloud.visibleTo} disabled={disabled} onChange={(v) => onUpdate({ visibleTo: v })} />
        {!disabled && mode === "prep" && (
          <button onClick={onRemove} aria-label={t("common.remove")} className="p-2 -m-2 text-accent-red hover:text-accent-red shrink-0"><X size={14} /></button>
        )}
      </div>
      {expanded && (
        <div className="ml-5 space-y-1">
          <AutoTextarea
            value={readAloud.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            disabled={disabled}
            rows={4}
            className="w-full rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base disabled:opacity-50 focus:outline-none italic"
            placeholder={t("sessionCard.readAloud.textPlaceholder")} aria-label={t("sessionCard.readAloud.textPlaceholder")}
          />
          {mode === "prep" && (
            <>
              <ContentMeta
                day={readAloud.day}
                time={readAloud.time}
                disabled={disabled}
                onChangeDay={onChangeDay}
                onChangeTime={onChangeTime}
              />
              {/* Link the boxed text to a place, encounter or NPC so it nests
                  under its trigger in the reading order. */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-text-faint">{t("sessionCard.readAloud.linkLabel")}</span>
                <select
                  value={readAloud.linkedType ?? ""}
                  onChange={(e) => onUpdate({ linkedType: e.target.value || null, linkedTo: "" })}
                  disabled={disabled}
                  className="rounded border border-border bg-bg-base px-1.5 py-0.5 text-[10px] text-text-muted disabled:opacity-50"
                >
                  <option value="">{t("sessionCard.readAloud.linkNone")}</option>
                  <option value="place">{t("session.place")}</option>
                  <option value="encounter">{t("session.encounter")}</option>
                  <option value="npc">{t("session.npc")}</option>
                </select>
                {readAloud.linkedType && (
                  <select
                    value={readAloud.linkedTo}
                    onChange={(e) => onUpdate({ linkedTo: e.target.value })}
                    disabled={disabled}
                    className="rounded border border-border bg-bg-base px-1.5 py-0.5 text-[10px] text-text-muted disabled:opacity-50"
                  >
                    <option value="">{t("sessionCard.readAloud.linkTargetPlaceholder")}</option>
                    {targetNames.filter(Boolean).map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
