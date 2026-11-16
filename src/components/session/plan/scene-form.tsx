"use client";

import { Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { ENCOUNTER_STATUSES, VISIBLE_TO_ALL, VISIBLE_TO_DM, isDmOnly, type SessionData } from "@/lib/schemas/session";
import { TIMES_OF_DAY, TIME_LABEL_KEYS } from "@/lib/domain/time";
import type { Scene } from "@/lib/session/scenes";
import type { SessionContent } from "@/hooks/useSessionContent";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { STATUS_LABEL_KEYS } from "../cards/encounter-status";
import { PlaceCard } from "../cards/place-card";

export const fieldClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-border bg-bg-base px-3 text-sm text-text-base focus:border-accent-gold focus:outline-none disabled:opacity-50";
export const labelClass = "flex min-w-0 flex-col gap-1.5 text-xs text-text-muted";

interface SceneFormProps {
  data: SessionData;
  scene: Scene;
  content: SessionContent;
  disabled: boolean;
  onDeleted: () => void;
}

/** The scene itself: name, where and when, status, who sees it, DM notes, and its place. */
export function SceneForm({ data, scene, content, disabled, onDeleted }: SceneFormProps) {
  const { t } = useT();
  const e = data.encounters[scene.index];
  const set = (patch: Parameters<SessionContent["updateScene"]>[1]) => content.updateScene(scene, patch);
  // The place entries this scene happens at: same name, same day first.
  const places = data.places.map((p, i) => ({ p, i })).filter(({ p }) => e.location && p.name === e.location);
  const shownPlaces = places.filter(({ p }) => p.day === e.day).length ? places.filter(({ p }) => p.day === e.day) : places;

  return (
    <div className="flex flex-col gap-4">
      <label className={labelClass}>
        {t("plan.name")}
        <input className={`${fieldClass} font-display text-lg`} value={e.name} disabled={disabled} maxLength={200}
          onChange={(ev) => set({ name: ev.target.value })} placeholder={t("sessionCard.encounter.namePlaceholder")} />
      </label>
      <label className={labelClass}>
        {t("plan.place")}
        <input className={fieldClass} value={e.location} disabled={disabled} list="plan-place-names" maxLength={200}
          onChange={(ev) => set({ location: ev.target.value })} placeholder={t("plan.noPlace")} />
        <datalist id="plan-place-names">
          {[...new Set(content.placeNames)].map((n) => <option key={n} value={n} />)}
        </datalist>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          {t("plan.day")}
          <input className={fieldClass} type="number" min={1} inputMode="numeric" value={e.day ?? ""} disabled={disabled}
            onChange={(ev) => set({ day: ev.target.value ? String(Math.max(1, Number(ev.target.value))) : null })} placeholder={t("plan.noDay")} />
        </label>
        <label className={labelClass}>
          {t("plan.time")}
          <select className={fieldClass} value={e.time ?? ""} disabled={disabled} onChange={(ev) => set({ time: ev.target.value || null })}>
            <option value="">{t("plan.noTime")}</option>
            {TIMES_OF_DAY.map((tod) => <option key={tod} value={tod}>{t(TIME_LABEL_KEYS[tod])}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          {t("plan.status")}
          <select className={fieldClass} value={e.status} disabled={disabled} onChange={(ev) => set({ status: ENCOUNTER_STATUSES.find((s) => s === ev.target.value) ?? e.status })}>
            {ENCOUNTER_STATUSES.map((s) => <option key={s} value={s}>{t(STATUS_LABEL_KEYS[s])}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          {t("plan.playersSee")}
          <select className={fieldClass} value={isDmOnly(e.visibleTo) ? VISIBLE_TO_DM : VISIBLE_TO_ALL} disabled={disabled}
            onChange={(ev) => set({ visibleTo: ev.target.value })}>
            <option value={VISIBLE_TO_ALL}>{t("visibility.all")}</option>
            <option value={VISIBLE_TO_DM}>{t("visibility.dmOnly")}</option>
          </select>
        </label>
      </div>
      <label className={labelClass}>
        {t("plan.notes")}
        <AutoTextarea rows={3} value={e.notes} disabled={disabled} onChange={(ev) => set({ notes: ev.target.value })}
          className="w-full rounded-lg border border-accent-gold/25 bg-bg-base px-3 py-2 text-sm text-text-base focus:border-accent-gold focus:outline-none disabled:opacity-50" />
      </label>

      {shownPlaces.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">{t("plan.place")}</h4>
          {shownPlaces.map(({ p, i }) => (
            <PlaceCard key={i} place={p} mode="prep" disabled={disabled} onUpdate={(patch) => content.updatePlace(i, patch)}
              onRemove={() => content.remove("place", i)} onChangeDay={(d) => content.changeDay("place", i, d)} onChangeTime={(tm) => content.changeTime("place", i, tm)} />
          ))}
        </section>
      )}

      {!disabled && (
        <div className="border-t border-border pt-4">
          <button type="button" onClick={() => { content.remove("encounter", scene.index); onDeleted(); }}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-accent-red hover:bg-accent-red/10">
            <Trash2 size={15} aria-hidden="true" />
            {t("plan.deleteScene")}
          </button>
        </div>
      )}
    </div>
  );
}
