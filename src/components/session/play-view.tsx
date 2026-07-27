"use client";

import { useState } from "react";
import type { SessionData, SessionEvent, SessionTurningPoint, SessionEquipment, SessionItem } from "@/lib/schemas/session";
import { TIMES_OF_DAY, TIME_LABELS, LINKABLE_TYPES, LINKABLE_LABELS } from "@/lib/domain/time";
import type { TimeOfDay, LinkableType } from "@/lib/domain/time";
import { DaySection } from "./day-section";
import { VisibilityToggle } from "./cards/visibility-toggle";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { AutoTextarea } from "@/components/ui/auto-textarea";

interface PlayViewProps {
  data: SessionData;
  disabled: boolean;
  onDataChange: (patch: Partial<SessionData>, immediate?: boolean) => void;
  characterNames?: string[];
  onGiveEquipmentToCharacter?: (equipment: SessionEquipment) => void;
  onGiveItemToCharacter?: (item: SessionItem) => void;
}

function getLinkableNames(data: SessionData, type: LinkableType): string[] {
  if (type === "place") return data.places.filter((p) => p.name).map((p) => p.name);
  if (type === "encounter") return data.encounters.filter((e) => e.name).map((e) => e.name);
  return data.npcs.filter((n) => n.name).map((n) => n.name);
}

function LinkBadge({ linkedType, linkedTo }: { linkedType: string | null; linkedTo: string }) {
  if (!linkedType || !linkedTo) return null;
  const colors: Record<string, string> = { place: "text-cyan-400", encounter: "text-red-400", npc: "text-blue-400" };
  const icons: Record<string, string> = { place: "📍", encounter: "⚔️", npc: "👤" };
  return (
    <span className={`text-[10px] ${colors[linkedType] ?? "text-text-faint"}`}>
      {icons[linkedType]} {linkedTo}
    </span>
  );
}

export function PlayView({ data, disabled, onDataChange, characterNames, onGiveEquipmentToCharacter, onGiveItemToCharacter }: PlayViewProps) {
  const { t } = useT();
  const [eventText, setEventText] = useState("");
  const [eventLinkType, setEventLinkType] = useState<LinkableType | "">("");
  const [eventLinkTo, setEventLinkTo] = useState("");

  const [tpText, setTpText] = useState("");
  const [tpConsequence, setTpConsequence] = useState("");
  const [tpLinkType, setTpLinkType] = useState<LinkableType | "">("");
  const [tpLinkTo, setTpLinkTo] = useState("");

  const [editingEvent, setEditingEvent] = useState<number | null>(null);
  const [editingTp, setEditingTp] = useState<number | null>(null);

  const usedDays = new Set<number>();
  for (const key of ["places", "encounters", "npcs", "items", "equipment", "readAloud"] as const) {
    for (const item of data[key]) {
      const d = (item as Record<string, unknown>).day;
      if (typeof d === "number" || (typeof d === "string" && d !== "")) {
        usedDays.add(Number(d));
      }
    }
  }
  const sortedDays = Array.from(usedDays).sort((a, b) => a - b);

  const hasUnscheduled = (["places", "encounters", "npcs", "items", "equipment", "readAloud"] as const).some(
    (key) => data[key].some((item: Record<string, unknown>) => !item.day),
  );

  function addEvent() {
    if (!eventText.trim()) return;
    onDataChange({
      eventLog: [
        ...data.eventLog,
        {
          text: eventText.trim(),
          timestamp: new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }),
          day: null,
          time: null,
          linkedType: eventLinkType || null,
          linkedTo: eventLinkType ? eventLinkTo : "",
          visibleTo: "all",
        },
      ],
    });
    setEventText("");
    setEventLinkType("");
    setEventLinkTo("");
  }

  function updateEvent(index: number, patch: Partial<SessionEvent>) {
    onDataChange({
      eventLog: data.eventLog.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    });
  }

  function removeEvent(index: number) {
    onDataChange({ eventLog: data.eventLog.filter((_, i) => i !== index) });
  }

  function addTurningPoint() {
    if (!tpText.trim()) return;
    onDataChange({
      turningPoints: [
        ...data.turningPoints,
        {
          description: tpText.trim(),
          consequence: tpConsequence.trim(),
          linkedType: tpLinkType || null,
          linkedTo: tpLinkType ? tpLinkTo : "",
          day: null,
          time: null,
          visibleTo: "all",
        },
      ],
    });
    setTpText("");
    setTpConsequence("");
    setTpLinkType("");
    setTpLinkTo("");
  }

  function updateTurningPoint(index: number, patch: Partial<SessionTurningPoint>) {
    onDataChange({
      turningPoints: data.turningPoints.map((tp, i) => (i === index ? { ...tp, ...patch } : tp)),
    });
  }

  function removeTurningPoint(index: number) {
    onDataChange({ turningPoints: data.turningPoints.filter((_, i) => i !== index) });
  }

  const noopAdd = () => {};
  const noopRemove = () => {};

  const dayProps = {
    mode: "play" as const,
    disabled,
    placeNames: data.places.filter((p) => p.name).map((p) => p.name),
    onUpdatePlace: (i: number, patch: Record<string, unknown>) =>
      onDataChange({ places: data.places.map((p, j) => (j === i ? { ...p, ...patch } : p)) }),
    onUpdateEncounter: (i: number, patch: Record<string, unknown>) =>
      onDataChange({ encounters: data.encounters.map((e, j) => (j === i ? { ...e, ...patch } : e)) }),
    onUpdateNpc: (i: number, patch: Record<string, unknown>) =>
      onDataChange({ npcs: data.npcs.map((n, j) => (j === i ? { ...n, ...patch } : n)) }),
    onUpdateItem: (i: number, patch: Record<string, unknown>) =>
      onDataChange({ items: data.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }),
    onUpdateEquipment: (i: number, patch: Record<string, unknown>) =>
      onDataChange({ equipment: data.equipment.map((eq, j) => (j === i ? { ...eq, ...patch } : eq)) }),
    onUpdateReadAloud: (i: number, patch: Record<string, unknown>) =>
      onDataChange({ readAloud: data.readAloud.map((r, j) => (j === i ? { ...r, ...patch } : r)) }),
    onRemoveContent: noopRemove,
    characterNames: characterNames ?? [],
    onGiveEquipmentToCharacter,
    onGiveItemToCharacter,
    onAssignToPlace: () => {},
    onChangeDay: () => {},
    onChangeTime: () => {},
    onAddContent: noopAdd,
  };

  return (
    <div className="space-y-6">
      {/* Quick-add toolbar */}
      {!disabled && (
        <div className="rounded-lg border border-green-900/50 bg-green-950/20 p-3 space-y-3">
          <h3 className="text-sm font-semibold text-green-400">{t("session.quickLog")}</h3>

          {/* Event input */}
          <div className="space-y-1">
            <div className="flex gap-2">
              <AutoTextarea
                rows={1}
                value={eventText}
                onChange={(e) => setEventText(e.target.value)}
                onKeyDown={(e) => {
                  // Enter skickar (som förr), Shift+Enter ger ny rad för längre händelser
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addEvent(); }
                }}
                className="flex-1 rounded border border-green-900/30 bg-bg-base px-2 py-1.5 text-sm text-text-base focus:border-green-600 focus:outline-none"
                placeholder={t("session.eventPlaceholder")}
              />
              <button
                onClick={addEvent}
                disabled={!eventText.trim()}
                className="rounded bg-green-800/50 px-3 py-1.5 text-xs text-green-300 hover:bg-green-800/70 disabled:opacity-50 shrink-0"
              >
                {t("session.event")}
              </button>
            </div>
            <div className="flex gap-2 items-center">
              <select
                value={eventLinkType}
                onChange={(e) => { setEventLinkType(e.target.value as LinkableType | ""); setEventLinkTo(""); }}
                className="rounded border border-green-900/30 bg-bg-base px-2 py-1 text-xs text-text-base"
              >
                <option value="">{t("session.linkTo")}</option>
                {LINKABLE_TYPES.map((t) => (
                  <option key={t} value={t}>{LINKABLE_LABELS[t]}</option>
                ))}
              </select>
              {eventLinkType && (
                <select
                  value={eventLinkTo}
                  onChange={(e) => setEventLinkTo(e.target.value)}
                  className="rounded border border-green-900/30 bg-bg-base px-2 py-1 text-xs text-text-base flex-1"
                >
                  <option value="">{t("common.selectPlaceholder")}</option>
                  {getLinkableNames(data, eventLinkType).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Turning point input */}
          <div className="space-y-1">
            <div className="flex flex-col sm:flex-row gap-2">
              <AutoTextarea
                rows={1}
                value={tpText}
                onChange={(e) => setTpText(e.target.value)}
                className="flex-1 rounded border border-green-900/30 bg-bg-base px-2 py-1.5 text-sm text-text-base focus:border-green-600 focus:outline-none"
                placeholder={t("session.turningPointPlaceholder")}
              />
              <AutoTextarea
                rows={1}
                value={tpConsequence}
                onChange={(e) => setTpConsequence(e.target.value)}
                className="flex-1 rounded border border-green-900/30 bg-bg-base px-2 py-1.5 text-sm text-text-base focus:border-green-600 focus:outline-none"
                placeholder={t("session.consequencePlaceholder")}
              />
              <button
                onClick={addTurningPoint}
                disabled={!tpText.trim()}
                className="rounded bg-green-800/50 px-3 py-1.5 text-xs text-green-300 hover:bg-green-800/70 disabled:opacity-50 shrink-0"
              >
                {t("session.turningPoint")}
              </button>
            </div>
            <div className="flex gap-2 items-center">
              <select
                value={tpLinkType}
                onChange={(e) => { setTpLinkType(e.target.value as LinkableType | ""); setTpLinkTo(""); }}
                className="rounded border border-green-900/30 bg-bg-base px-2 py-1 text-xs text-text-base"
              >
                <option value="">{t("session.linkTo")}</option>
                {LINKABLE_TYPES.map((t) => (
                  <option key={t} value={t}>{LINKABLE_LABELS[t]}</option>
                ))}
              </select>
              {tpLinkType && (
                <select
                  value={tpLinkTo}
                  onChange={(e) => setTpLinkTo(e.target.value)}
                  className="rounded border border-green-900/30 bg-bg-base px-2 py-1 text-xs text-text-base flex-1"
                >
                  <option value="">{t("common.selectPlaceholder")}</option>
                  {getLinkableNames(data, tpLinkType).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Day sections in play mode */}
      {sortedDays.map((day) => (
        <DaySection key={day} day={day} data={data} {...dayProps} />
      ))}
      {hasUnscheduled && (
        <DaySection day={null} data={data} {...dayProps} />
      )}

      {/* Event log */}
      <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-2">
        <h3 className="text-sm font-semibold text-text-base">
          {t("session.eventLog")} ({data.eventLog.length})
        </h3>
        {data.eventLog.length === 0 && (
          <p className="text-xs text-text-faint">{t("session.noEvents")}</p>
        )}
        {[...data.eventLog].reverse().map((evt, ri) => {
          const i = data.eventLog.length - 1 - ri;
          const isEditing = editingEvent === i;
          return (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-text-faint font-mono shrink-0 w-14">{evt.timestamp}</span>
              {isEditing ? (
                <div className="flex-1 space-y-1">
                  <AutoTextarea
                    rows={1}
                    value={evt.text}
                    onChange={(e) => updateEvent(i, { text: e.target.value })}
                    className="w-full rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base focus:outline-none"
                  />
                  <div className="flex gap-2 items-center">
                    <select
                      value={evt.linkedType ?? ""}
                      onChange={(e) => updateEvent(i, { linkedType: e.target.value || null, linkedTo: "" })}
                      className="rounded border border-border bg-bg-base px-1 py-0.5 text-[10px] text-text-base"
                    >
                      <option value="">{t("session.noLink")}</option>
                      {LINKABLE_TYPES.map((t) => (
                        <option key={t} value={t}>{LINKABLE_LABELS[t]}</option>
                      ))}
                    </select>
                    {evt.linkedType && (
                      <select
                        value={evt.linkedTo}
                        onChange={(e) => updateEvent(i, { linkedTo: e.target.value })}
                        className="rounded border border-border bg-bg-base px-1 py-0.5 text-[10px] text-text-base"
                      >
                        <option value="">{t("common.selectPlaceholder")}</option>
                        {getLinkableNames(data, evt.linkedType as LinkableType).map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    )}
                    <button onClick={() => setEditingEvent(null)} className="text-accent-gold hover:text-accent-gold/80">{t("common.done")}</button>
                  </div>
                </div>
              ) : (
                <span
                  className="text-text-base flex-1 cursor-pointer hover:text-accent-gold"
                  onClick={() => !disabled && setEditingEvent(i)}
                >
                  {evt.text}
                </span>
              )}
              <LinkBadge linkedType={evt.linkedType} linkedTo={evt.linkedTo} />
              <VisibilityToggle visibleTo={evt.visibleTo} disabled={disabled} onChange={(v) => updateEvent(i, { visibleTo: v })} />
              {!disabled && (
                <button onClick={() => removeEvent(i)} aria-label={t("common.remove")} className="p-2 -m-2 text-red-400 hover:text-red-300 shrink-0"><X size={14} /></button>
              )}
            </div>
          );
        })}
      </section>

      {/* Turning points */}
      <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-2">
        <h3 className="text-sm font-semibold text-text-base">
          {t("session.turningPoints")} ({data.turningPoints.length})
        </h3>
        {data.turningPoints.length === 0 && (
          <p className="text-xs text-text-faint">{t("session.noTurningPoints")}</p>
        )}
        {data.turningPoints.map((tp, i) => {
          const isEditing = editingTp === i;
          return (
            <div key={i} className="border-l-2 border-accent-gold/50 pl-2 space-y-1">
              {isEditing ? (
                <div className="space-y-1">
                  <AutoTextarea
                    rows={1}
                    value={tp.description}
                    onChange={(e) => updateTurningPoint(i, { description: e.target.value })}
                    className="w-full rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base focus:outline-none"
                    placeholder={t("common.description")}
                  />
                  <AutoTextarea
                    rows={1}
                    value={tp.consequence}
                    onChange={(e) => updateTurningPoint(i, { consequence: e.target.value })}
                    className="w-full rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-muted focus:outline-none"
                    placeholder={t("session.consequencePlaceholder")}
                  />
                  <div className="flex gap-2 items-center">
                    <select
                      value={tp.linkedType ?? ""}
                      onChange={(e) => updateTurningPoint(i, { linkedType: e.target.value || null, linkedTo: "" })}
                      className="rounded border border-border bg-bg-base px-1 py-0.5 text-[10px] text-text-base"
                    >
                      <option value="">{t("session.noLink")}</option>
                      {LINKABLE_TYPES.map((t) => (
                        <option key={t} value={t}>{LINKABLE_LABELS[t]}</option>
                      ))}
                    </select>
                    {tp.linkedType && (
                      <select
                        value={tp.linkedTo}
                        onChange={(e) => updateTurningPoint(i, { linkedTo: e.target.value })}
                        className="rounded border border-border bg-bg-base px-1 py-0.5 text-[10px] text-text-base"
                      >
                        <option value="">{t("common.selectPlaceholder")}</option>
                        {getLinkableNames(data, tp.linkedType as LinkableType).map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    )}
                    <button onClick={() => setEditingTp(null)} className="text-[10px] text-accent-gold hover:text-accent-gold/80">{t("common.done")}</button>
                  </div>
                </div>
              ) : (
                <div
                  className="flex items-start gap-2 text-xs cursor-pointer hover:bg-bg-base/50 rounded px-1 -mx-1"
                  onClick={() => !disabled && setEditingTp(i)}
                >
                  <div className="flex-1">
                    <p className="text-text-base">{tp.description}</p>
                    {tp.consequence && <p className="text-text-muted mt-0.5">{tp.consequence}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <LinkBadge linkedType={tp.linkedType} linkedTo={tp.linkedTo} />
                    <VisibilityToggle visibleTo={tp.visibleTo} disabled={disabled} onChange={(v) => updateTurningPoint(i, { visibleTo: v })} />
                    {tp.day && <span className="text-[10px] text-text-faint">{t("session.dayN", { n: tp.day })}</span>}
                    {!disabled && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeTurningPoint(i); }}
                        aria-label={t("common.remove")}
                        className="p-2 -m-2 text-red-400 hover:text-red-300"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
