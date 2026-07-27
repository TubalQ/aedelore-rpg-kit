"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import WikiEditor from "@/components/wiki/WikiEditor";
import ImageUploadBar from "@/components/wiki/ImageUploadBar";
import type { WikiPage, WikiChapter } from "@/lib/schemas/wiki";

export default function EditPagePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useT();

  const { data, isLoading, error } = useQuery({
    queryKey: ["wiki-page", id],
    queryFn: () => api<WikiPage>(`/api/wiki/admin/pages/${id}`),
  });

  const chapters = useQuery({
    queryKey: ["wiki-chapters-for-book", data?.bookId],
    queryFn: () => api<WikiChapter[]>(`/api/wiki/admin/chapters?bookId=${data!.bookId}`),
    enabled: !!data?.bookId,
  });

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [authorNote, setAuthorNote] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [chapterId, setChapterId] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (data) {
      setTitle(data.title);
      setSummary(data.summary ?? "");
      setAuthorNote(data.authorNote ?? "");
      setTagsStr(data.tags?.join(", ") ?? "");
      setSortOrder(data.sortOrder);
      setChapterId(data.chapterId);
      setContent(data.content ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => {
      const tags = tagsStr.split(",").map((tag) => tag.trim()).filter(Boolean);
      return api(`/api/wiki/admin/pages/${id}`, {
        method: "PATCH",
        body: {
          title,
          summary: summary || null,
          authorNote: authorNote || null,
          tags: tags.length > 0 ? tags : null,
          sortOrder,
          chapterId: chapterId || null,
          content: content || null,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wiki-page", id] });
      setStatus(t("wikiAdmin.saved"));
      setTimeout(() => setStatus(null), 2000);
    },
    onError: (err) => {
      setStatus(err instanceof ApiError ? err.message : t("wikiAdmin.saveError"));
    },
  });

  const remove = useMutation({
    mutationFn: () => api(`/api/wiki/admin/pages/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      if (data) router.push(`/wiki-admin/books/${data.bookId}`);
    },
    onError: (err) => {
      setStatus(err instanceof ApiError ? err.message : t("wikiAdmin.deleteError"));
    },
  });

  if (isLoading) return <p className="text-text-muted p-8">{t("common.loading")}</p>;
  if (error || !data) return <p className="text-accent-red p-8">{t("wikiAdmin.pageNotFound")}</p>;

  const INPUT = "w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-text-base focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href={`/wiki-admin/books/${data.bookId}`} className="text-text-muted hover:text-text-base text-sm">
        {t("wikiAdmin.backToBook")}
      </Link>
      <h1 className="font-display text-2xl text-accent-gold">{t("wikiAdmin.editPage")}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={t("wikiAdmin.bookTitle")}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} />
        </Field>
        <Field label={t("wikiAdmin.slug")}>
          <input value={data.slug} readOnly className={`${INPUT} text-text-muted opacity-60 cursor-not-allowed`} />
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
        <div className="md:col-span-2">
          <Field label={t("wikiAdmin.authorNote")}>
            <textarea value={authorNote} onChange={(e) => setAuthorNote(e.target.value)} rows={2} className={INPUT} />
          </Field>
        </div>
      </div>

      <ImageUploadBar onError={(msg) => setStatus(msg)} />
      <WikiEditor content={content} onChange={setContent} placeholder={t("wikiAdmin.contentPlaceholder")} />

      <div className="flex items-center gap-4 pt-2">
        <button onClick={() => save.mutate()} disabled={save.isPending} className="bg-accent-gold text-bg-base font-semibold rounded-lg px-4 py-2 hover:bg-accent-gold/80 disabled:opacity-50">
          {save.isPending ? t("wikiAdmin.saving") : t("wikiAdmin.save")}
        </button>
        <button
          onClick={() => { if (!confirmDelete) { setConfirmDelete(true); return; } remove.mutate(); }}
          className="text-accent-red hover:bg-accent-red/10 rounded-lg px-4 py-2"
        >
          {confirmDelete ? t("wikiAdmin.confirmDeleteAction") : t("wikiAdmin.delete")}
        </button>
        {status && (
          <span className={`text-sm ${status === t("wikiAdmin.saved") ? "text-accent-green" : "text-accent-red"}`}>{status}</span>
        )}
      </div>
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
