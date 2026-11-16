"use client";

import { useMemo, useState } from "react";
import { useT, type TranslationKey } from "@/lib/i18n";
import type { SessionData, SessionEquipment, SessionItem } from "@/lib/schemas/session";
import type { GiveKind, GiveMode } from "@/lib/session/give";
import type { Holder } from "@/hooks/useGiveInPlay";
import type { CampaignCharacter } from "@/lib/db/queries/campaigns";
import { tClass, tRace } from "@/lib/i18n/game-terms";
import { buildScenePlan, scenesOnDay } from "@/lib/session/scenes";
import { useSessionContent } from "@/hooks/useSessionContent";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils/cn";
import { SceneList, type ActiveScene } from "./scene-list";
import { SceneHeader } from "./active-scene";
import { SceneContent } from "./scene-content";
import { SceneCombat } from "./scene-combat";
import { PartyPanel } from "./party-panel";
import { LogPanel, type LogContext } from "./log-panel";
import type { GiveHandlers, GiveTarget } from "./give-to";

type MobileTab = "scene" | "combat" | "party" | "log";
const MOBILE_TABS: [MobileTab, TranslationKey][] = [["scene", "play.tabScene"], ["combat", "play.tabCombat"], ["party", "play.tabParty"], ["log", "play.tabLog"]];

interface PlayViewProps {
  campaignId: number;
  data: SessionData;
  characters: CampaignCharacter[];
  disabled: boolean;
  onDataChange: (patch: Partial<SessionData>) => void;
  onRenamePlaceCascade: (index: number, newName: string) => void;
  onGive: (kind: GiveKind, index: number, entry: SessionItem | SessionEquipment, target: GiveTarget, mode: GiveMode) => void;
  onTakeBack: (kind: GiveKind, index: number, entry: SessionItem | SessionEquipment, holder: Holder) => void;
}

const column = "sticky top-20 flex h-[calc(100dvh-6rem)] min-h-0 flex-col overflow-y-auto overscroll-contain";
const heading = "text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint";

/** Play (B+ GM screen): scenes, the active scene with give-to, combat, the party and the log. */
export function PlayView({ campaignId, data, characters, disabled, onDataChange, onRenamePlaceCascade, onGive, onTakeBack }: PlayViewProps) {
  const { t, locale } = useT();
  const content = useSessionContent(data, onDataChange, onRenamePlaceCascade);
  const plan = useMemo(() => buildScenePlan(data), [data]);
  const wide = useMediaQuery("(min-width: 1024px)");
  const [picked, setPicked] = useState<ActiveScene | null>(null);
  const [tab, setTab] = useState<MobileTab>("scene");

  const ordered = plan.days.flatMap((d) => scenesOnDay(plan, data, d));
  // Start where play is: the scene in progress, else the next planned one.
  const fallback: ActiveScene =
    (ordered.find((s) => data.encounters[s.index].status === "started") ?? ordered.find((s) => data.encounters[s.index].status === "planned") ?? ordered[0])?.index ??
    "loose";
  const active: ActiveScene = picked === "loose" || (typeof picked === "number" && plan.scenes[picked]) ? picked : fallback;
  const scene = active === "loose" ? null : plan.scenes[active];
  const encounter = scene ? data.encounters[scene.index] : null;

  const places = scene && encounter?.location
    ? (() => {
        const all = data.places.map((p, i) => ({ p, i })).filter(({ p }) => p.name === encounter.location);
        const sameDay = all.filter(({ p }) => p.day === encounter.day);
        return (sameDay.length ? sameDay : all).map(({ i }) => i);
      })()
    : scene ? [] : plan.loose.places;

  const giveTargets: GiveTarget[] = characters.map((c) => ({
    id: c.id,
    name: c.name,
    subtitle: [c.data.race && tRace(c.data.race, locale), c.data.class && tClass(c.data.class, locale)].filter(Boolean).join(" · "),
  }));

  // Holders are stored by character name (like visibleTo). A name nobody in
  // the campaign has any more can still be cleared from the card.
  function giveFor(kind: GiveKind, index: number): GiveHandlers {
    const entry = data[kind][index];
    return {
      targets: giveTargets,
      onGive: (target, mode) => onGive(kind, index, entry, target, mode),
      onTakeBack: (name) => onTakeBack(kind, index, entry, { id: characters.find((c) => c.name === name)?.id ?? null, name }),
    };
  }

  const logContext: LogContext = encounter
    ? { linkedType: encounter.name ? "encounter" : null, linkedTo: encounter.name, day: encounter.day, time: encounter.time }
    : { linkedType: null, linkedTo: "", day: null, time: null };

  const sceneBody = (
    <div className="flex flex-col gap-6">
      {scene ? <SceneHeader data={data} scene={scene} content={content} disabled={disabled} /> : <h2 className="font-display text-2xl font-bold text-text-base">{t("plan.loose")}</h2>}
      <SceneContent data={data} members={scene ?? plan.loose} places={places} content={content} disabled={disabled} giveFor={giveFor} emptyText={scene ? undefined : t("play.looseEmpty")} />
    </div>
  );
  const combat = encounter && scene ? (
    <SceneCombat encounter={encounter} disabled={disabled} onUpdate={(p) => content.updateEncounter(scene.index, p)} />
  ) : <p className="text-sm text-text-faint">{t("play.noCombat")}</p>;
  const party = <PartyPanel campaignId={campaignId} characters={characters} disabled={disabled} />;
  const log = <LogPanel data={data} disabled={disabled} context={logContext} onDataChange={onDataChange} />;

  if (wide) {
    return (
      <div className="grid grid-cols-[15rem_minmax(0,1fr)_21rem] items-start gap-5">
        <aside className={cn(column, "gap-2 rounded-xl border border-border bg-bg-surface p-2")}>
          <h3 className={cn(heading, "px-2.5 pt-2")}>{t("play.scenes")}</h3>
          {ordered.length === 0 && <p className="px-2.5 text-xs text-text-faint">{t("play.noScenes")}</p>}
          <SceneList data={data} plan={plan} active={active} onSelect={setPicked} />
        </aside>
        <section className="flex min-w-0 flex-col gap-6 rounded-xl border border-border bg-bg-surface p-5">
          {sceneBody}
          {scene && (
            <section className="flex flex-col gap-3 border-t border-border pt-5">
              <h3 className={heading}>{t("play.combat")}</h3>
              {combat}
            </section>
          )}
        </section>
        <aside className={cn(column, "gap-6 rounded-xl border border-border bg-bg-surface p-4")}>
          <section className="flex flex-col gap-3"><h3 className={heading}>{t("play.party")}</h3>{party}</section>
          <section className="flex flex-col gap-3"><h3 className={heading}>{t("play.log")}</h3>{log}</section>
        </aside>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <select value={String(active)} onChange={(e) => setPicked(e.target.value === "loose" ? "loose" : Number(e.target.value))} aria-label={t("play.pickScene")}
          className="min-h-11 w-full rounded-lg border border-border bg-bg-base px-3 text-sm text-text-base">
          {ordered.map((s) => {
            const e = data.encounters[s.index];
            return <option key={s.index} value={s.index}>{`${s.day === null ? t("plan.noDay") : t("session.dayN", { n: s.day })} · ${e.name || t("plan.untitledScene")}`}</option>;
          })}
          <option value="loose">{t("plan.loose")}</option>
        </select>
      </div>
      <div role="tablist" className="sticky top-16 z-20 -mx-4 flex border-b border-border bg-bg-base/95 px-2 backdrop-blur">
        {MOBILE_TABS.map(([k, key]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("min-h-11 flex-1 border-b-2 text-sm", tab === k ? "border-accent-gold font-medium text-text-base" : "border-transparent text-text-muted")}>
            {t(key)}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "scene" && sceneBody}
        {tab === "combat" && combat}
        {tab === "party" && party}
        {tab === "log" && log}
      </div>
    </div>
  );
}
