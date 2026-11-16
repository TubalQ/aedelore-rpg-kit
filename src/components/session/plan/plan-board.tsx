"use client";

import { Inbox, Plus } from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n";
import type { SessionData } from "@/lib/schemas/session";
import { looseCount, scenesOnDay, type ScenePlan } from "@/lib/session/scenes";
import { cn } from "@/lib/utils/cn";
import { SceneCard } from "./scene-card";
import type { PlanSelection } from "./plan-selection";

interface PlanBoardProps {
  data: SessionData;
  plan: ScenePlan;
  days: (number | null)[];
  selection: PlanSelection;
  disabled: boolean;
  onSelect: (selection: PlanSelection) => void;
  onAddScene: (day: number | null) => void;
}

/** One column per day with its scenes in time order; loose content last. */
export function PlanBoard({ data, plan, days, selection, disabled, onSelect, onAddScene }: PlanBoardProps) {
  const { t } = useT();
  const loose = looseCount(plan);
  const looseParts: [number, TranslationKey][] = [
    [plan.loose.npcs.length, "plan.countNpcs"],
    [plan.loose.readAloud.length, "plan.countReadAloud"],
    [plan.loose.items.length, "plan.countItems"],
    [plan.loose.equipment.length, "plan.countEquipment"],
  ];
  const looseSummary = looseParts
    .filter(([n]) => n > 0)
    .map(([n, key]) => t(key, { n }))
    .concat(plan.loose.places.length ? [t("plan.countPlaces", { n: plan.loose.places.length })] : [])
    .join(" · ");

  return (
    <div className="flex flex-col gap-6 pb-2 md:flex-row md:overflow-x-auto">
      {days.map((day) => {
        const label = day === null ? t("plan.noDay") : t("session.dayN", { n: day });
        return (
          <section key={day ?? "none"} className="flex flex-col gap-2.5 md:w-64 md:shrink-0" aria-label={label}>
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">{label}</h3>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onAddScene(day)}
                  aria-label={day === null ? t("plan.addSceneNoDay") : t("plan.addSceneOnDay", { n: day })}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-faint hover:bg-bg-elevated hover:text-text-base"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
            {scenesOnDay(plan, data, day).map((scene) => (
              <SceneCard
                key={scene.index}
                scene={scene}
                encounter={data.encounters[scene.index]}
                selected={selection?.kind === "scene" && selection.index === scene.index}
                onSelect={() => onSelect({ kind: "scene", index: scene.index })}
              />
            ))}
          </section>
        );
      })}
      {loose > 0 && (
        <section className="flex flex-col gap-2.5 md:w-64 md:shrink-0" aria-label={t("plan.loose")}>
          <h3 className="px-1 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">{t("plan.loose")}</h3>
          <button
            type="button"
            onClick={() => onSelect({ kind: "loose" })}
            aria-pressed={selection?.kind === "loose"}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-dashed bg-bg-base p-3.5 text-left text-sm text-text-muted",
              selection?.kind === "loose" ? "border-accent-gold" : "border-border hover:border-border-hover",
            )}
          >
            <Inbox size={18} className="shrink-0 text-text-faint" aria-hidden="true" />
            <span>
              {looseSummary}
            </span>
          </button>
        </section>
      )}
    </div>
  );
}
