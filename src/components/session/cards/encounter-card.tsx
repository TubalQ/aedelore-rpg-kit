"use client";

import { useState } from "react";
import type { SessionEncounter } from "@/lib/schemas/session";
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

const STATUS_LABEL_KEYS = { planned: "sessionCard.encounter.statusPlanned", started: "sessionCard.encounter.statusStarted", completed: "sessionCard.encounter.statusCompleted" } as const;
const STATUS_STYLES = {
  planned: "bg-bg-base text-text-faint",
  started: "bg-yellow-900/30 text-yellow-400",
  completed: "bg-green-900/30 text-green-400",
} as const;

type EncounterStatus = "planned" | "started" | "completed";

function nextStatus(s: EncounterStatus): EncounterStatus {
  const order: EncounterStatus[] = ["planned", "started", "completed"];
  return order[(order.indexOf(s) + 1) % order.length];
}

export function EncounterCard({
  encounter, mode, disabled, onUpdate, onRemove,
  placeNames, onAssignToPlace, onChangeDay, onChangeTime,
}: EncounterCardProps) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(mode === "prep");

  function addEnemy() {
    onUpdate({ enemies: [...encounter.enemies, { name: "", hp: 0, maxHp: 0, notes: "" }] });
  }

  function updateEnemy(i: number, patch: Record<string, unknown>) {
    onUpdate({ enemies: encounter.enemies.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  }

  function removeEnemy(i: number) {
    onUpdate({ enemies: encounter.enemies.filter((_, j) => j !== i) });
  }

  return (
    <div className="rounded border border-red-900/40 bg-red-950/10 p-2 space-y-1">
      <div className="flex items-center gap-2">
        <button onClick={() => setExpanded(!expanded)} className="p-2 -m-2 text-xs text-red-400 shrink-0">
          {expanded ? "▼" : "▶"}
        </button>
        <span className="text-xs text-red-400 shrink-0">{t("sessionCard.badge.encounter")}</span>
        <input
          type="text"
          value={encounter.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm font-medium text-text-base border-b border-transparent focus:border-red-600 focus:outline-none disabled:opacity-50"
          placeholder={t("sessionCard.encounter.namePlaceholder")}
        />
        <button
          onClick={() => onUpdate({ status: nextStatus(encounter.status) })}
          disabled={disabled}
          className={`rounded px-2 py-0.5 text-xs shrink-0 ${STATUS_STYLES[encounter.status]} disabled:opacity-50`}
        >
          {t(STATUS_LABEL_KEYS[encounter.status] as any)}
        </button>
        <VisibilityToggle visibleTo={encounter.visibleTo} disabled={disabled} onChange={(v) => onUpdate({ visibleTo: v })} />
        {!disabled && mode === "prep" && (
          <button onClick={onRemove} aria-label={t("common.remove")} className="p-2 -m-2 text-red-400 hover:text-red-300 shrink-0"><X size={14} /></button>
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
            className="w-full rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base disabled:opacity-50 focus:border-red-600 focus:outline-none"
            placeholder={t("sessionCard.encounter.lootPlaceholder")}
          />
          <AutoTextarea
            value={encounter.tactics}
            onChange={(e) => onUpdate({ tactics: e.target.value })}
            disabled={disabled}
            rows={2}
            className="w-full rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base disabled:opacity-50 focus:border-red-600 focus:outline-none"
            placeholder={t("sessionCard.encounter.tacticsPlaceholder")}
          />
          {mode === "prep" && (
            <AutoTextarea
              value={encounter.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              disabled={disabled}
              rows={1}
              className="w-full rounded border border-amber-900/30 bg-bg-base px-2 py-1 text-xs text-amber-200/80 disabled:opacity-50 focus:border-amber-600 focus:outline-none"
              placeholder={t("sessionCard.notesLabel")}
            />
          )}

          {/* Enemies */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-faint">{t("sessionCard.encounter.enemies")} ({encounter.enemies.length})</span>
              {!disabled && (
                <button onClick={addEnemy} className="text-xs text-red-400 hover:text-red-300">{t("sessionCard.encounter.addEnemy")}</button>
              )}
            </div>
            {encounter.enemies.map((enemy, i) => (
              <div key={i}>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={enemy.name}
                    onChange={(e) => updateEnemy(i, { name: e.target.value })}
                    disabled={disabled}
                    className="flex-1 rounded border border-border bg-bg-base px-1.5 py-0.5 text-xs text-text-base disabled:opacity-50 focus:outline-none"
                    placeholder={t("sessionCard.encounter.enemyNamePlaceholder")}
                  />
                  {mode === "play" && (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => updateEnemy(i, { hp: Math.max(0, enemy.hp - 1) })}
                        disabled={disabled}
                        className="rounded bg-bg-surface px-1 py-1 pointer-coarse:px-2.5 pointer-coarse:py-2.5 text-xs text-red-400 disabled:opacity-50"
                      >
                        -
                      </button>
                      <span className={`w-8 text-center text-xs font-mono ${
                        enemy.maxHp > 0 && enemy.hp <= 0 ? "text-red-400" :
                        enemy.maxHp > 0 && enemy.hp <= enemy.maxHp * 0.25 ? "text-red-400" :
                        enemy.maxHp > 0 && enemy.hp <= enemy.maxHp * 0.5 ? "text-yellow-400" : "text-green-400"
                      }`}>
                        {enemy.hp}
                      </span>
                      <span className="text-xs text-text-faint">/</span>
                      <input
                        type="number"
                        value={enemy.maxHp}
                        onChange={(e) => updateEnemy(i, { maxHp: Number(e.target.value) })}
                        disabled={disabled}
                        className="w-10 rounded border border-border bg-bg-base px-1 py-0.5 text-xs text-text-base disabled:opacity-50 focus:outline-none text-center"
                      />
                      <button
                        onClick={() => updateEnemy(i, { hp: Math.min(enemy.maxHp, enemy.hp + 1) })}
                        disabled={disabled}
                        className="rounded bg-bg-surface px-1 py-1 pointer-coarse:px-2.5 pointer-coarse:py-2.5 text-xs text-green-400 disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                  )}
                  {mode === "prep" && (
                    <>
                      <input
                        type="number"
                        value={enemy.hp}
                        onChange={(e) => updateEnemy(i, { hp: Number(e.target.value) })}
                        disabled={disabled}
                        className="w-12 rounded border border-border bg-bg-base px-1 py-0.5 text-xs text-text-base disabled:opacity-50 focus:outline-none"
                        placeholder="HP"
                      />
                      <span className="text-xs text-text-faint">/</span>
                      <input
                        type="number"
                        value={enemy.maxHp}
                        onChange={(e) => updateEnemy(i, { maxHp: Number(e.target.value) })}
                        disabled={disabled}
                        className="w-12 rounded border border-border bg-bg-base px-1 py-0.5 text-xs text-text-base disabled:opacity-50 focus:outline-none"
                        placeholder="Max"
                      />
                    </>
                  )}
                  {!disabled && (
                    <button onClick={() => removeEnemy(i)} aria-label={t("common.remove")} className="p-2 -m-2 text-red-400 hover:text-red-300"><X size={14} /></button>
                  )}
                </div>
                {mode === "prep" && (
                  <AutoTextarea
                    value={enemy.notes}
                    onChange={(e) => updateEnemy(i, { notes: e.target.value })}
                    disabled={disabled}
                    rows={1}
                    className="mt-0.5 w-full rounded border border-amber-900/30 bg-bg-base px-1.5 py-0.5 text-[10px] text-amber-200/80 disabled:opacity-50 focus:outline-none"
                    placeholder={t("sessionCard.notesLabel")}
                  />
                )}
                {mode === "play" && enemy.maxHp > 0 && (
                  <div className="h-1.5 rounded-full bg-bg-surface overflow-hidden mt-0.5">
                    <div
                      className={`h-full rounded-full transition-all ${
                        enemy.hp <= 0 ? "bg-gray-600" :
                        enemy.hp / enemy.maxHp <= 0.25 ? "bg-red-500" :
                        enemy.hp / enemy.maxHp <= 0.5 ? "bg-yellow-500" : "bg-green-500"
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100))}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

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
