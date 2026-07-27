"use client";

import { TIMES_OF_DAY, TIME_LABELS } from "@/lib/domain/time";
import { useT } from "@/lib/i18n";

interface ContentMetaProps {
  day: string | null;
  time: string | null;
  disabled: boolean;
  placeNames?: string[];
  currentPlace?: string;
  onChangeDay: (day: number | null) => void;
  onChangeTime: (time: string | null) => void;
  onAssignToPlace?: (place: string) => void;
}

export function ContentMeta({
  day, time, disabled, placeNames, currentPlace,
  onChangeDay, onChangeTime, onAssignToPlace,
}: ContentMetaProps) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <select
        value={day ?? ""}
        onChange={(e) => onChangeDay(e.target.value ? Number(e.target.value) : null)}
        disabled={disabled}
        className="rounded border border-border bg-bg-base px-1.5 py-0.5 text-[10px] text-text-muted disabled:opacity-50"
      >
        <option value="">{t("contentMeta.noDay")}</option>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {t("contentMeta.dayN", { n: d })}
          </option>
        ))}
      </select>
      <select
        value={time ?? ""}
        onChange={(e) => onChangeTime(e.target.value || null)}
        disabled={disabled}
        className="rounded border border-border bg-bg-base px-1.5 py-0.5 text-[10px] text-text-muted disabled:opacity-50"
      >
        <option value="">{t("contentMeta.noTime")}</option>
        {TIMES_OF_DAY.map((tod) => (
          <option key={tod} value={tod}>
            {TIME_LABELS[tod]}
          </option>
        ))}
      </select>
      {placeNames && onAssignToPlace && (
        <select
          value={currentPlace ?? ""}
          onChange={(e) => onAssignToPlace!(e.target.value)}
          disabled={disabled}
          className="rounded border border-border bg-bg-base px-1.5 py-0.5 text-[10px] text-text-muted disabled:opacity-50"
        >
          <option value="">{t("contentMeta.noPlace")}</option>
          {placeNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
