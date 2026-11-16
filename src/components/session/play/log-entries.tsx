"use client";

import { useState } from "react";
import { MapPin, Swords, User, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { SessionData, SessionEvent, SessionTurningPoint } from "@/lib/schemas/session";
import { asLinkableType } from "@/lib/domain/time";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { VisibilityToggle } from "../cards/visibility-toggle";
import { LinkSelect } from "./link-select";

const LINK_ICON = { place: MapPin, encounter: Swords, npc: User } as const;

function LinkBadge({ linkedType, linkedTo }: { linkedType: string | null; linkedTo: string }) {
  const type = asLinkableType(linkedType);
  if (!type || !linkedTo) return null;
  const Icon = LINK_ICON[type];
  return (
    <span className="inline-flex max-w-full items-center gap-1 truncate text-[11px] text-text-faint">
      <Icon size={11} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{linkedTo}</span>
    </span>
  );
}

const area = "w-full rounded-lg border border-border bg-bg-base px-2.5 py-1.5 text-sm text-text-base focus:border-accent-gold focus:outline-none";

interface RowProps<T> {
  data: SessionData;
  entry: T;
  disabled: boolean;
  onUpdate: (patch: Partial<T>) => void;
  onRemove: () => void;
}

export function EventRow({ data, entry, disabled, onUpdate, onRemove }: RowProps<SessionEvent>) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  return (
    <li className="flex gap-3 py-2">
      <span className="w-11 shrink-0 pt-0.5 font-mono text-xs text-text-faint">{entry.timestamp}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {editing ? (
          <>
            <AutoTextarea rows={1} autoFocus value={entry.text} onChange={(e) => onUpdate({ text: e.target.value })} className={area} aria-label={t("play.logEvent")} />
            <div className="flex flex-wrap items-center gap-2">
              <LinkSelect data={data} linkedType={entry.linkedType} linkedTo={entry.linkedTo} onChange={onUpdate} />
              <button type="button" onClick={() => setEditing(false)} className="min-h-9 px-2 text-xs font-medium text-accent-gold">{t("common.done")}</button>
            </div>
          </>
        ) : (
          <button type="button" disabled={disabled} onClick={() => setEditing(true)} className="text-left text-sm leading-snug text-text-base hover:text-accent-gold disabled:hover:text-text-base">
            {entry.text}
          </button>
        )}
        <LinkBadge linkedType={entry.linkedType} linkedTo={entry.linkedTo} />
      </div>
      <div className="flex shrink-0 items-start gap-2">
        <VisibilityToggle visibleTo={entry.visibleTo} disabled={disabled} onChange={(v) => onUpdate({ visibleTo: v })} />
        {!disabled && (
          <button type="button" onClick={onRemove} aria-label={t("common.remove")} className="-m-1.5 p-1.5 text-text-faint hover:text-accent-red"><X size={14} /></button>
        )}
      </div>
    </li>
  );
}

export function TurningPointRow({ data, entry, disabled, onUpdate, onRemove }: RowProps<SessionTurningPoint>) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  return (
    <li className="flex gap-3 border-l-2 border-accent-gold/60 py-2 pl-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-gold">{t("play.logTurningPoint")}</span>
        {editing ? (
          <>
            <AutoTextarea rows={1} autoFocus value={entry.description} onChange={(e) => onUpdate({ description: e.target.value })} className={area} aria-label={t("common.description")} />
            <AutoTextarea rows={1} value={entry.consequence} onChange={(e) => onUpdate({ consequence: e.target.value })} className={area}
              placeholder={t("session.consequencePlaceholder")} aria-label={t("session.consequencePlaceholder")} />
            <div className="flex flex-wrap items-center gap-2">
              <LinkSelect data={data} linkedType={entry.linkedType} linkedTo={entry.linkedTo} onChange={onUpdate} />
              <button type="button" onClick={() => setEditing(false)} className="min-h-9 px-2 text-xs font-medium text-accent-gold">{t("common.done")}</button>
            </div>
          </>
        ) : (
          <button type="button" disabled={disabled} onClick={() => setEditing(true)} className="flex flex-col gap-0.5 text-left hover:text-accent-gold">
            <span className="text-sm leading-snug text-text-base">{entry.description}</span>
            {entry.consequence && <span className="text-xs text-text-muted">{entry.consequence}</span>}
          </button>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <LinkBadge linkedType={entry.linkedType} linkedTo={entry.linkedTo} />
          {entry.day && <span className="text-[11px] text-text-faint">{t("session.dayN", { n: entry.day })}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-start gap-2">
        <VisibilityToggle visibleTo={entry.visibleTo} disabled={disabled} onChange={(v) => onUpdate({ visibleTo: v })} />
        {!disabled && (
          <button type="button" onClick={onRemove} aria-label={t("common.remove")} className="-m-1.5 p-1.5 text-text-faint hover:text-accent-red"><X size={14} /></button>
        )}
      </div>
    </li>
  );
}
