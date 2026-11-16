"use client";

import { useT } from "@/lib/i18n";
import type { SessionData } from "@/lib/schemas/session";
import { LINKABLE_LABEL_KEYS, LINKABLE_TYPES, asLinkableType, type LinkableType } from "@/lib/domain/time";

export function linkableNames(data: SessionData, type: LinkableType | null): string[] {
  if (!type) return [];
  const names =
    type === "place" ? data.places.map((p) => p.name) : type === "encounter" ? data.encounters.map((e) => e.name) : data.npcs.map((n) => n.name);
  return [...new Set(names.filter(Boolean))];
}

interface LinkSelectProps {
  data: SessionData;
  linkedType: string | null;
  linkedTo: string;
  disabled?: boolean;
  onChange: (link: { linkedType: string | null; linkedTo: string }) => void;
}

const select = "min-h-9 min-w-0 rounded-lg border border-border bg-bg-base px-2 text-xs text-text-base disabled:opacity-50";

/** What a log entry is about: a place, a scene or an NPC. */
export function LinkSelect({ data, linkedType, linkedTo, disabled, onChange }: LinkSelectProps) {
  const { t } = useT();
  const type = asLinkableType(linkedType);
  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      <select className={select} value={type ?? ""} disabled={disabled} aria-label={t("play.link")}
        onChange={(e) => onChange({ linkedType: asLinkableType(e.target.value), linkedTo: "" })}>
        <option value="">{t("session.noLink")}</option>
        {LINKABLE_TYPES.map((lt) => <option key={lt} value={lt}>{t(LINKABLE_LABEL_KEYS[lt])}</option>)}
      </select>
      {type && (
        <div className="min-w-0 flex-1">
          <select className={`${select} w-full`} value={linkedTo} disabled={disabled} aria-label={t(LINKABLE_LABEL_KEYS[type])}
            onChange={(e) => onChange({ linkedType: type, linkedTo: e.target.value })}>
            <option value="">{t("common.selectPlaceholder")}</option>
            {linkableNames(data, type).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
