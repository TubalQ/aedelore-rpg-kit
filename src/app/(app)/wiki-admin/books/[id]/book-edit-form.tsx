"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { CoverImageInput } from "@/components/wiki/CoverImageInput";
import { Check } from "lucide-react";

type AdminBook = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  authorNote: string | null;
  sortOrder: number;
};

type Props = { book: AdminBook };

export function BookEditForm({ book }: Props) {
  const { t } = useT();
  const qc = useQueryClient();

  const [title, setTitle] = useState(book.title);
  const [description, setDescription] = useState(book.description ?? "");
  const [coverImage, setCoverImage] = useState(book.coverImage ?? "");
  const [authorNote, setAuthorNote] = useState(book.authorNote ?? "");
  const [sortOrder, setSortOrder] = useState(book.sortOrder);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const update = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api<AdminBook>(`/api/wiki/admin/books/${book.id}`, {
        method: "PATCH",
        body: data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wiki-book", book.id] });
      qc.invalidateQueries({ queryKey: ["wiki-books"] });
      setSaved(true);
      setFormError(null);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : t("error.unexpected"));
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) return;
    update.mutate({
      title: title.trim(),
      description: description.trim() || null,
      coverImage: coverImage.trim() || null,
      authorNote: authorNote.trim() || null,
      sortOrder,
    });
  }

  const inputClass =
    "w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-text-base focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-bg-surface border border-border rounded-lg p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm text-text-muted mb-1">
              {t("wikiAdmin.bookTitle")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-1">{t("wikiAdmin.slug")}</label>
            <input
              type="text"
              value={book.slug}
              readOnly
              className={`${inputClass} opacity-50 cursor-not-allowed`}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-1">
            {t("wikiAdmin.description")}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>

        <CoverImageInput
          value={coverImage}
          onChange={setCoverImage}
          label={t("wikiAdmin.coverImage")}
        />

        <div>
          <label className="block text-sm text-text-muted mb-1">
            {t("wikiAdmin.authorNote")}
          </label>
          <textarea
            value={authorNote}
            onChange={(e) => setAuthorNote(e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="w-32">
          <label className="block text-sm text-text-muted mb-1">
            {t("wikiAdmin.sortOrder")}
          </label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            min={0}
            className={inputClass}
          />
        </div>
      </div>

      {formError && (
        <p className="text-sm text-accent-red">{formError}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={update.isPending}
          className="flex items-center gap-2 rounded-lg bg-accent-gold px-4 py-2 text-sm font-semibold text-bg-base transition-colors hover:bg-accent-gold/80 disabled:opacity-50"
        >
          {update.isPending ? t("common.saving") : t("common.save")}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-accent-green">
            <Check size={14} />
            {t("common.saved")}
          </span>
        )}
      </div>
    </form>
  );
}
