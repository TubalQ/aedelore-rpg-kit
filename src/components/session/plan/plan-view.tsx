"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import type { ContentKind, SessionData } from "@/lib/schemas/session";
import type { StashEntry } from "@/lib/schemas/stash";
import { buildScenePlan } from "@/lib/session/scenes";
import { useSessionContent, type ContentWhen } from "@/hooks/useSessionContent";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { PlanToolbar, type DayFilter, type PlanViewMode } from "./plan-toolbar";
import { PlanBoard } from "./plan-board";
import { PlanList } from "./plan-list";
import { ScenePanel, type SceneTab } from "./scene-panel";
import { LoosePanel } from "./loose-panel";
import { SessionPanel, type SessionMeta, type SessionTab } from "./session-panel";
import { StashPickDialog } from "./stash-pick-dialog";
import type { LooseTab, PlanSelection } from "./plan-selection";

interface PlanViewProps {
  campaignId: number;
  sessionNumber: number;
  data: SessionData;
  meta: SessionMeta;
  disabled: boolean;
  onDataChange: (patch: Partial<SessionData>) => void;
  onMetaChange: (field: string, value: string) => void;
  onRenamePlaceCascade: (index: number, newName: string) => void;
}

/**
 * Planning (B+ GM screen): the session's days as a board of scenes, with the
 * selected scene, loose content or the session itself in a side panel.
 */
export function PlanView({ campaignId, sessionNumber, data, meta, disabled, onDataChange, onMetaChange, onRenamePlaceCascade }: PlanViewProps) {
  const { t } = useT();
  const content = useSessionContent(data, onDataChange, onRenamePlaceCascade);
  const plan = useMemo(() => buildScenePlan(data), [data]);
  const wide = useMediaQuery("(min-width: 1024px)");

  const [view, setView] = useState<PlanViewMode>("board");
  const [dayFilter, setDayFilter] = useState<DayFilter>("all");
  const [rawSelection, setSelection] = useState<PlanSelection>(null);
  const [sceneTab, setSceneTab] = useState<SceneTab>("scene");
  const [looseTab, setLooseTab] = useState<LooseTab>("loose");
  const [sessionTab, setSessionTab] = useState<SessionTab>("prep");
  const [picking, setPicking] = useState(false);

  // A removed scene (or one undone away) closes its panel.
  const selection = rawSelection?.kind === "scene" && !plan.scenes[rawSelection.index] ? null : rawSelection;
  const scene = selection?.kind === "scene" ? plan.scenes[selection.index] : null;
  const days = dayFilter === "all" ? plan.days : [dayFilter];
  const numericDays = plan.days.filter((d): d is number => d !== null);

  const toDay = (d: number | null) => (d === null ? null : String(d));
  const focusDay = (): number | null => (typeof dayFilter === "number" ? dayFilter : numericDays.at(-1) ?? null);

  function select(next: PlanSelection) {
    setSelection(next);
    if (next?.kind === "loose" && next.tab) setLooseTab(next.tab);
  }

  function addScene(day: number | null) {
    const index = content.add("encounter", { day: toDay(day), time: null });
    setSceneTab("scene");
    select({ kind: "scene", index });
  }

  /** Where new content goes: into the open scene, else loose on the focused day. */
  function target(): { when: ContentWhen; readAloudLink: Record<string, unknown> } {
    if (scene) {
      const e = data.encounters[scene.index];
      const link = e.name ? { linkedType: "encounter", linkedTo: e.name } : {};
      return { when: { day: e.day, time: e.time, place: e.location || e.name }, readAloudLink: link };
    }
    return { when: { day: toDay(typeof dayFilter === "number" ? dayFilter : null), time: null }, readAloudLink: {} };
  }

  function create(kind: ContentKind) {
    if (kind === "encounter") return addScene(focusDay());
    if (kind === "place") {
      content.add("place", { day: toDay(typeof dayFilter === "number" ? dayFilter : null), time: null });
      return select({ kind: "loose", tab: "places" });
    }
    const { when, readAloudLink } = target();
    content.add(kind, when, kind === "readAloud" ? readAloudLink : {});
    if (scene) setSceneTab("inScene");
    else select({ kind: "loose", tab: "loose" });
  }

  function pick(entry: StashEntry) {
    const { when } = target();
    if (entry.kind === "quest") content.add("item", when, { stashId: entry.id, name: entry.data.name, description: entry.data.description });
    else content.add("equipment", when, { ...entry.data, stashId: entry.id });
    setPicking(false);
    if (scene) setSceneTab("inScene");
    else select({ kind: "loose", tab: "loose" });
  }

  const close = () => setSelection(null);
  let panel: ReactNode = null;
  if (scene) {
    panel = (
      <ScenePanel data={data} plan={plan} scene={scene} content={content} disabled={disabled} tab={sceneTab} onTab={setSceneTab}
        onAdd={create} onPickFromStash={() => setPicking(true)} onClose={close} />
    );
  } else if (selection?.kind === "loose") {
    panel = <LoosePanel data={data} plan={plan} content={content} disabled={disabled} tab={looseTab} onTab={setLooseTab} onClose={close} />;
  } else if (selection?.kind === "session") {
    panel = (
      <SessionPanel sessionNumber={sessionNumber} data={data} meta={meta} disabled={disabled} tab={sessionTab} onTab={setSessionTab}
        onDataChange={onDataChange} onMetaChange={onMetaChange} onClose={close} />
    );
  }

  const hasScenes = plan.scenes.length > 0;
  return (
    <div className="flex flex-col gap-4">
      <PlanToolbar
        days={plan.days}
        dayFilter={dayFilter}
        view={view}
        disabled={disabled}
        sessionOpen={selection?.kind === "session"}
        onDayFilter={setDayFilter}
        onView={setView}
        onCreate={create}
        onPickFromStash={() => setPicking(true)}
        onAddDay={() => addScene((numericDays.at(-1) ?? 0) + 1)}
        onOpenSession={() => select(selection?.kind === "session" ? null : { kind: "session" })}
      />
      <div className={panel && wide ? "grid grid-cols-[minmax(0,1fr)_30rem] items-start gap-5" : ""}>
        <div className="min-w-0">
          {!hasScenes && <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-faint">{t("plan.empty")}</p>}
          {view === "board" ? (
            <PlanBoard data={data} plan={plan} days={days} selection={selection} disabled={disabled} onSelect={select} onAddScene={addScene} />
          ) : (
            <PlanList data={data} plan={plan} days={days} selection={selection} onSelect={select} />
          )}
        </div>
        {panel && wide && (
          <aside className="sticky top-20 flex h-[calc(100dvh-6rem)] flex-col overflow-hidden rounded-xl border border-border bg-bg-surface">{panel}</aside>
        )}
      </div>
      {panel && !wide && <div className="fixed inset-0 z-40 flex flex-col bg-bg-surface">{panel}</div>}
      {picking && (
        <StashPickDialog campaignId={campaignId} data={data} sceneName={scene ? data.encounters[scene.index].name || t("plan.untitledScene") : null}
          onPick={pick} onClose={() => setPicking(false)} />
      )}
    </div>
  );
}
