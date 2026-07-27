"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import type { WikiChapter } from "@/lib/schemas/wiki";

type ChapterData = WikiChapter & { authorNote: string | null };

export default function EditChapterPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useT();

  const { data, isLoading, error } = useQuery({
    queryKey: ["wiki-chapter", id],
    queryFn: () => api<ChapterData>(`/api/wiki/admin/chapters/${id}`),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [authorNote, setAuthorNote] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (data) {
      setTitle(data.title);
      setDescription(data.description ?? "");
      setAuthorNote(data.authorNote ?? "");
      setSortOrder(data.sortOrder);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api(`/api/wiki/admin/chapters/${id}`, {
        method: "PATCH",
        body: {
          title,
          description: description || null,
          authorNote: authorNote || null,
          sortOrder,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wiki-chapter", id] });
      setStatus(t("wikiAdmin.saved"));
      setTimeout(() => setStatus(null), 2000);
    },
    onError: (err) => {
      setStatus(err instanceof ApiError ? err.message : t("wikiAdmin.saveError"));
    },
  });

  const remove = useMutation({
    mutationFn: () =>
      api(`/api/wiki/admin/chapters/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      if (data) router.push(`/wiki-admin/books/${data.bookId}`);
    },
    onError: (err) => {
      setStatus(err instanceof ApiError ? err.message : t("wikiAdmin.deleteError"));
    },
  });

  if (isLoading) return <p className="text-text-muted p-8">{t("common.loading")}</p>;
  if (error || !data) return <p className="text-accent-red p-8">{t("wikiAdmin.chapterNotFound")}</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={`/wiki-admin/books/${data.bookId}`}
        className="text-text-muted hover:text-text-base text-sm"
      >
        {t("wikiAdmin.backToBook")}
      </Link>

      <h1 className="font-display text-2xl text-accent-gold">{t("wikiAdmin.editChapter")}</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-text-muted mb-1">{t("wikiAdmin.bookTitle")}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-text-base focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
          />
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-1">{t("wikiAdmin.slug")}</label>
          <input
            value={data.slug}
            readOnly
            className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-text-muted opacity-60 cursor-not-allowed"
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

      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="bg-accent-gold text-bg-base font-semibold rounded-lg px-4 py-2 hover:bg-accent-gold/80 disabled:opacity-50"
        >
          {save.isPending ? t("wikiAdmin.saving") : t("wikiAdmin.save")}
        </button>

        <button
          onClick={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            remove.mutate();
          }}
          className="text-accent-red hover:bg-accent-red/10 rounded-lg px-4 py-2"
        >
          {confirmDelete ? t("wikiAdmin.confirmDeleteAction") : t("wikiAdmin.delete")}
        </button>

        {status && (
          <span className={`text-sm ${status === t("wikiAdmin.saved") ? "text-accent-green" : "text-accent-red"}`}>
            {status}
          </span>
        )}
      </div>
    </div>
  );
}
