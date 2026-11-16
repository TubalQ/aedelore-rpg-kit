"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { AutoTextarea } from "@/components/ui/auto-textarea";

interface StashQuestFormProps {
  initial?: { name: string; description: string };
  submitLabel: string;
  isPending: boolean;
  onSubmit: (data: { name: string; description: string }) => void;
  onCancel: () => void;
}

/** Name + description of a story item (create or edit in the stash). */
export function StashQuestForm({ initial, submitLabel, isPending, onSubmit, onCancel }: StashQuestFormProps) {
  const { t } = useT();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit({ name: name.trim(), description: description.trim() });
      }}
    >
      <label className="flex flex-col gap-1.5 text-xs text-text-muted">
        {t("stash.namePlaceholder")}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          maxLength={200}
          className="min-h-11 rounded-lg border border-border bg-bg-base px-3 font-display text-lg text-text-base focus:border-accent-gold focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs text-text-muted">
        {t("common.description")}
        <AutoTextarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-base focus:border-accent-gold focus:outline-none"
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={isPending || !name.trim()} className="min-h-10 rounded-lg bg-accent-gold px-4 text-sm font-semibold text-bg-base disabled:opacity-50">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="min-h-10 rounded-lg border border-border px-4 text-sm text-text-muted">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
