"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import type { SessionData, SessionEvent, SessionTurningPoint } from "@/lib/schemas/session";
import { VISIBLE_TO_ALL } from "@/lib/schemas/session";
import { useUndoableRemove } from "@/hooks/useUndoableRemove";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { cn } from "@/lib/utils/cn";
import { EventRow, TurningPointRow } from "./log-entries";
import { LinkSelect } from "./link-select";

type LogKind = "event" | "turningPoint";
type LogFilter = "all" | "events" | "turningPoints";

export type LogContext = { linkedType: string | null; linkedTo: string; day: string | null; time: string | null };

interface LogPanelProps {
  data: SessionData;
  disabled: boolean;
  /** New entries are linked to the active scene (changeable before logging). */
  context: LogContext;
  onDataChange: (patch: Partial<SessionData>) => void;
}

const chip = (active: boolean) =>
  cn("min-h-8 rounded-full border px-3 text-xs", active ? "border-accent-gold bg-accent-gold/15 text-accent-gold" : "border-border text-text-muted hover:text-text-base");

/** The session log: quick entry of events and turning points, filters, and the entries. */
export function LogPanel({ data, disabled, context, onDataChange }: LogPanelProps) {
  const { t } = useT();
  const [kind, setKind] = useState<LogKind>("event");
  const [text, setText] = useState("");
  const [consequence, setConsequence] = useState("");
  const [link, setLink] = useState<{ linkedType: string | null; linkedTo: string } | null>(null);
  const [filter, setFilter] = useState<LogFilter>("all");
  // Until the DM picks a link, new entries follow the active scene.
  const activeLink = link ?? { linkedType: context.linkedType, linkedTo: context.linkedTo };

  const removeEvent = useUndoableRemove(data.eventLog, (eventLog) => onDataChange({ eventLog }));
  const removeTp = useUndoableRemove(data.turningPoints, (turningPoints) => onDataChange({ turningPoints }));

  function add() {
    if (!text.trim()) return;
    const base = { ...activeLink, linkedTo: activeLink.linkedType ? activeLink.linkedTo : "", day: context.day, time: context.time, visibleTo: VISIBLE_TO_ALL };
    if (kind === "event") {
      const timestamp = new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
      onDataChange({ eventLog: [...data.eventLog, { ...base, text: text.trim(), timestamp }] });
    } else {
      onDataChange({ turningPoints: [...data.turningPoints, { ...base, description: text.trim(), consequence: consequence.trim() }] });
    }
    setText("");
    setConsequence("");
    setLink(null);
  }

  const updateEvent = (i: number, patch: Partial<SessionEvent>) =>
    onDataChange({ eventLog: data.eventLog.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const updateTp = (i: number, patch: Partial<SessionTurningPoint>) =>
    onDataChange({ turningPoints: data.turningPoints.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  const area = "w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-base focus:border-accent-gold focus:outline-none";

  return (
    <div className="flex flex-col gap-3">
      {!disabled && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-bg-base p-3">
          <div className="flex gap-1 rounded-lg border border-border p-0.5 text-xs" role="group">
            {(["event", "turningPoint"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
                className={cn("min-h-8 flex-1 rounded-md", kind === k ? "bg-bg-elevated font-medium text-text-base" : "text-text-muted")}>
                {k === "event" ? t("play.logEvent") : t("play.logTurningPoint")}
              </button>
            ))}
          </div>
          <AutoTextarea rows={1} value={text} onChange={(e) => setText(e.target.value)} className={area}
            placeholder={t("play.whatHappened")} aria-label={t("play.whatHappened")}
            onKeyDown={(e) => {
              // Enter logs, Shift+Enter gives a new line for longer entries.
              if (e.key === "Enter" && !e.shiftKey && kind === "event") { e.preventDefault(); add(); }
            }} />
          {kind === "turningPoint" && (
            <AutoTextarea rows={1} value={consequence} onChange={(e) => setConsequence(e.target.value)} className={area}
              placeholder={t("session.consequencePlaceholder")} aria-label={t("session.consequencePlaceholder")} />
          )}
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1"><LinkSelect data={data} {...activeLink} onChange={setLink} /></div>
            <button type="button" onClick={add} disabled={!text.trim()}
              className="min-h-9 shrink-0 rounded-lg bg-accent-gold px-4 text-sm font-semibold text-bg-base disabled:opacity-50">
              {t("play.logAdd")}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-1.5" role="group">
        {([["all", "play.filterAll"], ["events", "play.filterEvents"], ["turningPoints", "play.filterTurningPoints"]] as const).map(([f, key]) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={chip(filter === f)}>{t(key)}</button>
        ))}
      </div>

      <ul className="flex flex-col divide-y divide-border/60">
        {filter !== "events" && data.turningPoints.map((tp, i) => (
          <TurningPointRow key={`tp${i}`} data={data} entry={tp} disabled={disabled} onUpdate={(p) => updateTp(i, p)} onRemove={() => removeTp(i, tp.description.slice(0, 30))} />
        ))}
        {filter !== "turningPoints" && data.eventLog.map((_, ri) => {
          const i = data.eventLog.length - 1 - ri;
          const evt = data.eventLog[i];
          return <EventRow key={`e${i}`} data={data} entry={evt} disabled={disabled} onUpdate={(p) => updateEvent(i, p)} onRemove={() => removeEvent(i, evt.text.slice(0, 30))} />;
        })}
      </ul>
      {data.eventLog.length + data.turningPoints.length === 0 && <p className="text-sm text-text-faint">{t("play.logEmpty")}</p>}
    </div>
  );
}
