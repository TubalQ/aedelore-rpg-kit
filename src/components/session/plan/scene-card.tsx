"use client";

import { EyeOff } from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n";
import { isDmOnly, type SessionEncounter } from "@/lib/schemas/session";
import type { Scene } from "@/lib/session/scenes";
import { TIME_LABEL_KEYS, asTimeOfDay } from "@/lib/domain/time";
import { STATUS_LABEL_KEYS, STATUS_STYLES } from "../cards/encounter-status";
import { cn } from "@/lib/utils/cn";

/** "1 NPC · 2 föremål · 3 fiender": what a scene holds, for cards and rows. */
export function useSceneSummary() {
  const { t } = useT();
  return (scene: Scene, encounter: SessionEncounter): string => {
    const parts: [number, TranslationKey][] = [
      [scene.npcs.length, "plan.countNpcs"],
      [scene.readAloud.length, "plan.countReadAloud"],
      [scene.items.length, "plan.countItems"],
      [scene.equipment.length, "plan.countEquipment"],
      [encounter.enemies.length, "plan.countEnemies"],
    ];
    return parts.filter(([n]) => n > 0).map(([n, key]) => t(key, { n })).join(" · ");
  };
}

export function useTimeLabel() {
  const { t } = useT();
  return (time: string | null): string => {
    const tod = asTimeOfDay(time);
    return tod ? t(TIME_LABEL_KEYS[tod]) : "";
  };
}

interface SceneCardProps {
  scene: Scene;
  encounter: SessionEncounter;
  selected: boolean;
  onSelect: () => void;
}

export function SceneCard({ scene, encounter, selected, onSelect }: SceneCardProps) {
  const { t } = useT();
  const summary = useSceneSummary()(scene, encounter);
  const time = useTimeLabel()(encounter.time);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full flex-col gap-1.5 rounded-xl border bg-bg-surface p-3.5 text-left transition-colors",
        selected ? "border-accent-gold ring-1 ring-accent-gold/40" : "border-border hover:border-border-hover",
      )}
    >
      <span className="flex min-h-5 items-center justify-between gap-2 text-xs text-text-faint">
        <span>{time}</span>
        <span className="flex items-center gap-1.5">
          {isDmOnly(encounter.visibleTo) && <EyeOff size={13} className="text-accent-purple" aria-label={t("visibility.dmOnly")} />}
          {encounter.status !== "planned" && (
            <span className={cn("rounded-full px-2 py-0.5 text-[11px]", STATUS_STYLES[encounter.status])}>{t(STATUS_LABEL_KEYS[encounter.status])}</span>
          )}
          {encounter.enemies.length > 0 && (
            <span className="rounded-full bg-accent-red/15 px-2 py-0.5 text-[11px] font-medium text-accent-red">{t("plan.tagCombat")}</span>
          )}
        </span>
      </span>
      <span className="font-display text-lg font-semibold leading-tight text-text-base">{encounter.name || t("plan.untitledScene")}</span>
      {encounter.location && <span className="text-xs text-text-muted">{encounter.location}</span>}
      {summary && <span className="text-xs text-text-faint">{summary}</span>}
    </button>
  );
}
