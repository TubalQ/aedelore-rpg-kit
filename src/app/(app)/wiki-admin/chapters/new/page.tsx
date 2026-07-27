"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { toSlug } from "@/lib/utils/wiki-admin";
import type { WikiChapter } from "@/lib/schemas/wiki";

export default function NewChapterPage() {
  return (
    <Suspense>
      <NewChapterContent />
    </Suspense>
  );
}

function NewChapterContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { t } = useT();
  const bookId = Number(params.get("bookId"));

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [authorNote, setAuthorNote] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api<WikiChapter>("/api/wiki/admin/chapters", {
        method: "POST",
        body: {
          bookId,
          title,
          slug: slug || toSlug(title),
          description: description || null,
          authorNote: authorNote || null,
          sortOrder,
        },
      }),
    onSuccess: (data) => {
      router.push(`/wiki-admin/chapters/${data.id}`);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : t("wikiAdmin.createChapterError"));
    },
  });

  if (!bookId || Number.isNaN(bookId)) {
    return <p className="text-accent-red p-8">{t("wikiAdmin.invalidBookId")}</p>;
  }

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!slugTouched) setSlug(toSlug(v));
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={`/wiki-admin/books/${bookId}`}
        className="text-text-muted hover:text-text-base text-sm"
      >
        {t("wikiAdmin.backToBook")}
      </Link>

      <h1 className="font-display text-2xl text-accent-gold">{t("wikiAdmin.newChapter")}</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-text-muted mb-1">{t("wikiAdmin.bookTitle")}</label>
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-text-base focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
          />
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-1">{t("wikiAdmin.slug")}</label>
          <input
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-text-base focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
          />
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-1">{t("wikiAdmin.description")}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-text-base focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
          />
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-1">{t("wikiAdmin.authorNote")}</label>
          <textarea
            value={authorNote}
            onChange={(e) => setAuthorNote(e.target.value)}
            rows={2}
            className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-text-base focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
          />
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-1">{t("wikiAdmin.sortOrder")}</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-32 bg-bg-base border border-border rounded-lg px-3 py-2 text-text-base focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
          />
        </div>
      </div>

      {error && <p className="text-sm text-accent-red">{error}</p>}

      <button
        onClick={() => create.mutate()}
        disabled={create.isPending || !title.trim()}
        className="bg-accent-gold text-bg-base font-semibold rounded-lg px-4 py-2 hover:bg-accent-gold/80 disabled:opacity-50"
      >
        {create.isPending ? t("wikiAdmin.creating") : t("wikiAdmin.createChapter")}
      </button>
    </div>
  );
}
