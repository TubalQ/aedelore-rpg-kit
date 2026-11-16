"use client";

import { X } from "lucide-react";
import type { SessionData } from "@/lib/schemas/session";
import { useUndoableRemove } from "@/hooks/useUndoableRemove";
import { useT } from "@/lib/i18n";
import { AutoTextarea } from "@/components/ui/auto-textarea";

type DmNote = SessionData["dmNotes"][number];

interface DmNotesSectionProps {
  notes: DmNote[];
  disabled: boolean;
  onChange: (notes: DmNote[]) => void;
}

/** The DM's own notes for the session, each with a category. */
export function DmNotesSection({ notes, disabled, onChange }: DmNotesSectionProps) {
  const { t } = useT();
  const removeDmNote = useUndoableRemove(notes, onChange);

  return (
    <section className="rounded-lg border border-accent-gold/35 bg-accent-gold/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-accent-gold">
          {t("session.dmNotes")} {notes.length > 0 && `(${notes.length})`}
        </h2>
        {!disabled && (
          <button
            onClick={() =>
              onChange([...notes, { timestamp: new Date().toISOString(), text: "", category: "plan" }])
            }
            className="rounded bg-accent-gold/15 px-3 py-1 text-xs text-accent-gold hover:bg-accent-gold/25"
          >
            {t("common.add")}
          </button>
        )}
      </div>
      <p className="text-xs text-accent-gold/60">{t("session.dmNotesHelp")}</p>
      {notes.map((note, i) => (
        <div key={i} className="flex gap-2 items-start">
          <select
            value={note.category}
            onChange={(e) => {
              const updated = notes.map((n, j) =>
                j === i ? { ...n, category: e.target.value as typeof note.category } : n,
              );
              onChange(updated);
            }}
            disabled={disabled}
            className="rounded border border-accent-gold/20 bg-bg-base px-2 py-1 text-xs text-text-base disabled:opacity-50 shrink-0"
          >
            <option value="plot">{t("session.notePlot")}</option>
            <option value="mechanic">{t("session.noteMechanic")}</option>
            <option value="npc">{t("session.noteNpc")}</option>
            <option value="plan">{t("session.notePlan")}</option>
            <option value="reminder">{t("session.noteReminder")}</option>
          </select>
          <AutoTextarea
            value={note.text}
            onChange={(e) => {
              const updated = notes.map((n, j) => (j === i ? { ...n, text: e.target.value } : n));
              onChange(updated);
            }}
            disabled={disabled}
            rows={2}
            className="flex-1 rounded border border-accent-gold/20 bg-bg-base px-2 py-1 text-xs text-text-base disabled:opacity-50 focus:border-accent-gold focus:outline-none"
            placeholder={t("session.notePlaceholder")} aria-label={t("session.notePlaceholder")}
          />
          {!disabled && (
            <button
              onClick={() => removeDmNote(i, note.text.slice(0, 30))}
              aria-label={t("common.remove")}
              className="p-2 -m-1 text-accent-red hover:text-accent-red shrink-0"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
