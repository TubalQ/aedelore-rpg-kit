"use client";

import { Inbox } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { SessionData } from "@/lib/schemas/session";
import { looseCount, scenesOnDay, type ScenePlan } from "@/lib/session/scenes";
import { cn } from "@/lib/utils/cn";
import { useTimeLabel } from "../plan/scene-card";

export type ActiveScene = number | "loose";

const STATUS_DOT = { planned: "bg-border", started: "bg-accent-gold", completed: "bg-accent-green" } as const;

interface SceneListProps {
  data: SessionData;
  plan: ScenePlan;
  active: ActiveScene | null;
  onSelect: (scene: ActiveScene) => void;
}

/** All scenes in play order, with status; the active one is highlighted. */
export function SceneList({ data, plan, active, onSelect }: SceneListProps) {
  const { t } = useT();
  const time = useTimeLabel();
  return (
    <nav aria-label={t("play.scenes")} className="flex flex-col gap-0.5">
      {plan.days.flatMap((day) =>
        scenesOnDay(plan, data, day).map((s) => {
          const e = data.encounters[s.index];
          const on = active === s.index;
          return (
            <button key={s.index} type="button" onClick={() => onSelect(s.index)} aria-current={on ? "true" : undefined}
              className={cn("flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left", on ? "bg-accent-gold/10 ring-1 ring-accent-gold/40" : "hover:bg-bg-elevated")}>
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", STATUS_DOT[e.status])} aria-hidden="true" />
              <span className="flex min-w-0 flex-col">
                <span className="text-[11px] text-text-faint">{[day === null ? t("plan.noDay") : t("session.dayN", { n: day }), time(e.time)].filter(Boolean).join(" · ")}</span>
                <span className={cn("truncate text-sm", on ? "font-medium text-text-base" : "text-text-muted", e.status === "completed" && !on && "text-text-faint")}>
                  {e.name || t("plan.untitledScene")}
                </span>
              </span>
            </button>
          );
        }),
      )}
      {looseCount(plan) > 0 && (
        <button type="button" onClick={() => onSelect("loose")} aria-current={active === "loose" ? "true" : undefined}
          className={cn("mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm", active === "loose" ? "bg-accent-gold/10 text-text-base ring-1 ring-accent-gold/40" : "text-text-muted hover:bg-bg-elevated")}>
          <Inbox size={14} className="shrink-0" aria-hidden="true" />
          {t("plan.loose")}
        </button>
      )}
    </nav>
  );
}
