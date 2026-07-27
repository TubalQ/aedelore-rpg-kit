"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { CoverImageInput } from "@/components/wiki/CoverImageInput";
import type { WikiBook } from "@/lib/schemas/wiki";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type Props = { onDone: () => void };

export function CreateBookForm({ onDone }: Props) {
  const { t } = useT();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (data: {
      title: string;
      slug: string;
      description: string | null;
      coverImage: string | null;
      sortOrder: number;
    }) => api<WikiBook>("/api/wiki/admin/books", { method: "POST", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wiki-books"] });
      onDone();
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : t("error.unexpected"));
    },
  });

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugEdited) {
      setSlug(slugify(value));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!title.trim() || !slug.trim()) return;
    create.mutate({
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      coverImage: coverImage.trim() || null,
      sortOrder,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-bg-surface border border-border rounded-lg p-4 space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm text-text-muted mb-1">
            {t("wikiAdmin.bookTitle")}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-text-base focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-text-muted mb-1">{t("wikiAdmin.slug")}</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugEdited(true);
            }}
            className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-text-base focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
            required
            pattern="^[a-z0-9-]+$"
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
          rows={2}
          className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-text-base focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold resize-none"
        />
      </div>

      <CoverImageInput value={coverImage} onChange={setCoverImage} />

      <div className="w-32">
        <label className="block text-sm text-text-muted mb-1">
          {t("wikiAdmin.sortOrder")}
        </label>
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          min={0}
          className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-text-base focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
        />
      </div>

      {formError && (
        <p className="text-sm text-accent-red">{formError}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-lg bg-accent-gold px-4 py-2 text-sm font-semibold text-bg-base transition-colors hover:bg-accent-gold/80 disabled:opacity-50"
        >
          {create.isPending ? t("common.saving") : t("wikiAdmin.createBook")}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:bg-bg-elevated"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
