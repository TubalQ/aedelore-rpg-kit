"use client";

import { useT } from "@/lib/i18n";

interface SessionMetaSectionProps {
  meta: { title: string; date: string; location: string; gameLocation: string };
  disabled: boolean;
  onChange: (field: string, value: string) => void;
}

export function SessionMetaSection({ meta, disabled, onChange }: SessionMetaSectionProps) {
  const { t } = useT();
  return (
    <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
      <h2 className="text-lg font-semibold text-text-base">{t("session.sessionInfo")}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-text-faint mb-1">{t("session.titleLabel")}</label>
          <input
            type="text"
            value={meta.title}
            onChange={(e) => onChange("title", e.target.value)}
            disabled={disabled}
            className="w-full rounded border border-border bg-bg-base px-2 py-1.5 text-sm text-text-base disabled:opacity-50 focus:border-accent-gold focus:outline-none"
            placeholder={t("session.titlePlaceholder")}
          />
        </div>
        <div>
          <label className="block text-xs text-text-faint mb-1">{t("session.date")}</label>
          <input
            type="date"
            value={meta.date}
            onChange={(e) => onChange("date", e.target.value)}
            disabled={disabled}
            className="w-full rounded border border-border bg-bg-base px-2 py-1.5 text-sm text-text-base disabled:opacity-50 focus:border-accent-gold focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-text-faint mb-1">{t("session.locationIrl")}</label>
          <input
            type="text"
            value={meta.location}
            onChange={(e) => onChange("location", e.target.value)}
            disabled={disabled}
            className="w-full rounded border border-border bg-bg-base px-2 py-1.5 text-sm text-text-base disabled:opacity-50 focus:border-accent-gold focus:outline-none"
            placeholder={t("session.locationIrlPlaceholder")}
          />
        </div>
        <div>
          <label className="block text-xs text-text-faint mb-1">{t("session.locationInGame")}</label>
          <input
            type="text"
            value={meta.gameLocation}
            onChange={(e) => onChange("gameLocation", e.target.value)}
            disabled={disabled}
            className="w-full rounded border border-border bg-bg-base px-2 py-1.5 text-sm text-text-base disabled:opacity-50 focus:border-accent-gold focus:outline-none"
            placeholder="Aedelheim..."
          />
        </div>
      </div>
    </section>
  );
}
