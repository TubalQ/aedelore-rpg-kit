"use client";

import { useT } from "@/lib/i18n";
import type { SessionData } from "@/lib/schemas/session";
import type { Scene } from "@/lib/session/scenes";
import type { SessionContent } from "@/hooks/useSessionContent";
import { cn } from "@/lib/utils/cn";
import { STATUS_LABEL_KEYS, STATUS_STYLES, nextStatus } from "../cards/encounter-status";
import { VisibilityToggle } from "../cards/visibility-toggle";
import { useTimeLabel } from "../plan/scene-card";

interface SceneHeaderProps {
  data: SessionData;
  scene: Scene;
  content: SessionContent;
  disabled: boolean;
}

/** Name, when and where of the active scene, its status and the DM's note. */
export function SceneHeader({ data, scene, content, disabled }: SceneHeaderProps) {
  const { t } = useT();
  const time = useTimeLabel();
  const e = data.encounters[scene.index];
  const kicker = [e.day ? t("session.dayN", { n: e.day }) : "", time(e.time), e.location].filter(Boolean).join(" · ");
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">{t("play.activeScene")}{kicker && ` · ${kicker}`}</p>
          <h2 className="font-display text-2xl font-bold leading-tight text-text-base sm:text-3xl">{e.name || t("plan.untitledScene")}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <VisibilityToggle visibleTo={e.visibleTo} disabled={disabled} onChange={(v) => content.updateEncounter(scene.index, { visibleTo: v })} />
          <button type="button" disabled={disabled} title={t("play.statusHint")}
            onClick={() => content.updateEncounter(scene.index, { status: nextStatus(e.status) })}
            className={cn("min-h-9 rounded-full px-3 text-xs font-medium disabled:opacity-50", STATUS_STYLES[e.status])}>
            {t(STATUS_LABEL_KEYS[e.status])}
          </button>
        </div>
      </div>
      {e.notes && (
        <p className="whitespace-pre-line rounded-lg border border-accent-gold/25 bg-accent-gold/5 px-3 py-2 text-sm text-text-muted">
          <span className="mr-1 font-medium text-accent-gold">{t("play.dmNote")}:</span>
          {e.notes}
        </p>
      )}
    </header>
  );
}
