"use client";

import { useT } from "@/lib/i18n";
import type { SessionData } from "@/lib/schemas/session";
import { scenesOnDay, type ScenePlan } from "@/lib/session/scenes";
import { cn } from "@/lib/utils/cn";
import { useSceneSummary, useTimeLabel } from "./scene-card";
import type { PlanSelection } from "./plan-selection";

interface PlanListProps {
  data: SessionData;
  plan: ScenePlan;
  days: (number | null)[];
  selection: PlanSelection;
  onSelect: (selection: PlanSelection) => void;
}

/** The same scenes as the board, as compact rows per day. */
export function PlanList({ data, plan, days, selection, onSelect }: PlanListProps) {
  const { t } = useT();
  const summary = useSceneSummary();
  const timeLabel = useTimeLabel();

  return (
    <div className="flex flex-col gap-5">
      {days.map((day) => {
        const scenes = scenesOnDay(plan, data, day);
        if (scenes.length === 0) return null;
        return (
          <section key={day ?? "none"} className="flex flex-col gap-1">
            <h3 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
              {day === null ? t("plan.noDay") : t("session.dayN", { n: day })}
            </h3>
            {scenes.map((scene) => {
              const e = data.encounters[scene.index];
              const active = selection?.kind === "scene" && selection.index === scene.index;
              return (
                <button
                  key={scene.index}
                  type="button"
                  onClick={() => onSelect({ kind: "scene", index: scene.index })}
                  aria-pressed={active}
                  className={cn(
                    "grid min-h-11 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 rounded-lg px-3 py-2 text-left sm:grid-cols-[5.5rem_minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)]",
                    active ? "bg-accent-gold/10" : "hover:bg-bg-elevated",
                  )}
                >
                  <span className="text-xs text-text-faint">{timeLabel(e.time)}</span>
                  <span className="truncate text-sm font-medium text-text-base">{e.name || t("plan.untitledScene")}</span>
                  <span className="col-start-2 truncate text-xs text-text-muted sm:col-start-auto">{e.location}</span>
                  <span className="col-start-2 truncate text-xs text-text-faint sm:col-start-auto">{summary(scene, e)}</span>
                </button>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
