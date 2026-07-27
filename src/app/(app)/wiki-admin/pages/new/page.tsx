"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import WikiEditor from "@/components/wiki/WikiEditor";
import ImageUploadBar from "@/components/wiki/ImageUploadBar";
import { toSlug } from "@/lib/utils/wiki-admin";
import type { WikiChapter, WikiPage } from "@/lib/schemas/wiki";

export default function NewPagePage() {
  return (
    <Suspense>
      <NewPageContent />
    </Suspense>
  );
}

function NewPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { t } = useT();
  const bookId = Number(params.get("bookId"));
  const initialChapterId = params.get("chapterId");

  const chapters = useQuery({
    queryKey: ["wiki-chapters-for-book", bookId],
    queryFn: () => api<WikiChapter[]>(`/api/wiki/admin/chapters?bookId=${bookId}`),
    enabled: !!bookId,
  });

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [summary, setSummary] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [chapterId, setChapterId] = useState<number | null>(
    initialChapterId ? Number(initialChapterId) : null,
  );
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      const tags = tagsStr.split(",").map((tag) => tag.trim()).filter(Boolean);
      return api<WikiPage>("/api/wiki/admin/pages", {
        method: "POST",
        body: {
          bookId,
          chapterId: chapterId || null,
          title,
          slug: slug || toSlug(title),
          summary: summary || null,
          tags: tags.length > 0 ? tags : null,
          content: content || null,
          sortOrder,
        },
      });
    },
    onSuccess: (data) => router.push(`/wiki-admin/pages/${data.id}`),
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : t("wikiAdmin.createPageError"));
    },
  });

  if (!bookId || Number.isNaN(bookId)) {
    return <p className="text-accent-red p-8">{t("wikiAdmin.invalidBookId")}</p>;
  }

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!slugTouched) setSlug(toSlug(v));
  }

  const INPUT = "w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-text-base focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href={`/wiki-admin/books/${bookId}`} className="text-text-muted hover:text-text-base text-sm">
        {t("wikiAdmin.backToBook")}
      </Link>
      <h1 className="font-display text-2xl text-accent-gold">{t("wikiAdmin.newPage")}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("wikiAdmin.bookTitle")}>
          <input value={title} onChange={(e) => handleTitleChange(e.target.value)} className={INPUT} />
        </Field>
        <Field label={t("wikiAdmin.slug")}>
          <input value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} className={INPUT} />
        </Field>
        <Field label={t("wikiAdmin.summary")}>
          <input value={summary} onChange={(e) => setSummary(e.target.value)} className={INPUT} />
        </Field>
        <Field label={t("wikiAdmin.tags")}>
          <input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} className={INPUT} />
        </Field>
        <Field label={t("wikiAdmin.chapter")}>
          <select value={chapterId ?? ""} onChange={(e) => setChapterId(e.target.value ? Number(e.target.value) : null)} className={INPUT}>
            <option value="">{t("wikiAdmin.noChapter")}</option>
            {chapters.data?.map((ch) => <option key={ch.id} value={ch.id}>{ch.title}</option>)}
          </select>
        </Field>
        <Field label={t("wikiAdmin.sortOrder")}>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={`w-32 ${INPUT}`} />
        </Field>
      </div>

      <ImageUploadBar onError={(msg) => setError(msg)} />
      <WikiEditor content={content} onChange={setContent} placeholder={t("wikiAdmin.contentPlaceholder")} />

      {error && <p className="text-sm text-accent-red">{error}</p>}

      <button
        onClick={() => create.mutate()}
        disabled={create.isPending || !title.trim()}
        className="bg-accent-gold text-bg-base font-semibold rounded-lg px-4 py-2 hover:bg-accent-gold/80 disabled:opacity-50"
      >
        {create.isPending ? t("wikiAdmin.creating") : t("wikiAdmin.createPage")}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-text-muted mb-1">{label}</label>
      {children}
    </div>
  );
}
