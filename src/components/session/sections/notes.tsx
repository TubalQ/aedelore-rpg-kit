"use client";

import type { SessionNotes } from "@/lib/schemas/session";
import { useT } from "@/lib/i18n";
import { AutoTextarea } from "@/components/ui/auto-textarea";

interface SessionNotesSectionProps {
  hook: string;
  prolog: string;
  sessionNotes: SessionNotes;
  disabled: boolean;
  onHookChange: (hook: string) => void;
  onPrologChange: (prolog: string) => void;
  onSessionNotesChange: (notes: SessionNotes) => void;
}

export function SessionNotesSection({
  hook,
  prolog,
  sessionNotes,
  disabled,
  onHookChange,
  onPrologChange,
  onSessionNotesChange,
}: SessionNotesSectionProps) {
  const { t } = useT();

  function updateNote(field: keyof SessionNotes, value: string) {
    onSessionNotesChange({ ...sessionNotes, [field]: value });
  }

  return (
    <div className="space-y-6">
      {/* Hook & Prolog */}
      <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
        <h2 className="text-lg font-semibold text-text-base">{t("session.hookAndProlog")}</h2>
        <div>
          <label className="block text-xs text-text-faint mb-1">{t("session.hookLabel")}</label>
          <AutoTextarea
            value={hook}
            onChange={(e) => onHookChange(e.target.value)}
            disabled={disabled}
            rows={3}
            className="w-full rounded border border-border bg-bg-base px-2 py-1.5 text-sm text-text-base disabled:opacity-50 focus:border-accent-gold focus:outline-none"
            placeholder={t("session.hookPlaceholder")}
          />
        </div>
        <div>
          <label className="block text-xs text-text-faint mb-1">{t("session.prologLabel")}</label>
          <AutoTextarea
            value={prolog}
            onChange={(e) => onPrologChange(e.target.value)}
            disabled={disabled}
            rows={4}
            className="w-full rounded border border-border bg-bg-base px-2 py-1.5 text-sm text-text-base disabled:opacity-50 focus:border-accent-gold focus:outline-none"
            placeholder={t("session.prologPlaceholder")}
          />
        </div>
      </section>

      {/* Session Notes (post-session) */}
      <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
        <h2 className="text-lg font-semibold text-text-base">{t("session.sessionNotes")}</h2>
        <div>
          <label className="block text-xs text-text-faint mb-1">{t("session.summaryLabel")}</label>
          <AutoTextarea
            value={sessionNotes.summary}
            onChange={(e) => updateNote("summary", e.target.value)}
            disabled={disabled}
            rows={3}
            className="w-full rounded border border-border bg-bg-base px-2 py-1.5 text-sm text-text-base disabled:opacity-50 focus:border-accent-gold focus:outline-none"
            placeholder={t("session.summaryPlaceholder")}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-faint mb-1">{t("session.wentWell")}</label>
            <AutoTextarea
              value={sessionNotes.wentWell}
              onChange={(e) => updateNote("wentWell", e.target.value)}
              disabled={disabled}
              rows={3}
              className="w-full rounded border border-border bg-bg-base px-2 py-1.5 text-sm text-text-base disabled:opacity-50 focus:border-accent-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-text-faint mb-1">{t("session.canImprove")}</label>
            <AutoTextarea
              value={sessionNotes.improve}
              onChange={(e) => updateNote("improve", e.target.value)}
              disabled={disabled}
              rows={3}
              className="w-full rounded border border-border bg-bg-base px-2 py-1.5 text-sm text-text-base disabled:opacity-50 focus:border-accent-gold focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-faint mb-1">{t("session.followUpLabel")}</label>
          <AutoTextarea
            value={sessionNotes.followUp}
            onChange={(e) => updateNote("followUp", e.target.value)}
            disabled={disabled}
            rows={3}
            className="w-full rounded border border-border bg-bg-base px-2 py-1.5 text-sm text-text-base disabled:opacity-50 focus:border-accent-gold focus:outline-none"
            placeholder={t("session.followUpPlaceholder")}
          />
        </div>
      </section>
    </div>
  );
}
