"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useToastStore } from "@/stores/toast-store";

type TrashData = {
  characters: { id: number; name: string; deletedAt: string }[];
  campaigns: { id: number; name: string; deletedAt: string }[];
  sessions: { id: number; title: string; deletedAt: string }[];
  wikiBooks?: { id: number; title: string; deletedAt: string }[];
  wikiChapters?: { id: number; title: string; bookTitle: string; deletedAt: string }[];
  wikiPages?: { id: number; title: string; bookTitle: string; deletedAt: string }[];
};

type TrashCategory = "characters" | "campaigns" | "sessions" | "wiki-books" | "wiki-chapters" | "wiki-pages";

export default function TrashPage() {
  const { t, locale } = useT();
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const { data, isLoading } = useQuery({
    queryKey: ["trash"],
    queryFn: () => api<TrashData>("/api/trash"),
  });

  const restore = useMutation({
    mutationFn: ({ type, id }: { type: TrashCategory; id: number }) =>
      api(`/api/trash/${type}/${id}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trash"] }),
    onError: (e) => addToast(e instanceof Error ? e.message : t("common.saveFailed"), "error"),
  });

  const permanentDelete = useMutation({
    mutationFn: ({ type, id }: { type: TrashCategory; id: number }) =>
      api(`/api/trash/${type}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trash"] }),
    onError: (e) => addToast(e instanceof Error ? e.message : t("common.deleteFailed"), "error"),
  });

  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="text-text-muted p-8">{t("common.loading")}</div>;
  }

  const hasWiki =
    (data?.wikiBooks?.length ?? 0) > 0 ||
    (data?.wikiChapters?.length ?? 0) > 0 ||
    (data?.wikiPages?.length ?? 0) > 0;

  const isEmpty =
    !data ||
    (data.characters.length === 0 &&
      data.campaigns.length === 0 &&
      data.sessions.length === 0 &&
      !hasWiki);

  function handleDelete(type: TrashCategory, id: number) {
    const key = `${type}-${id}`;
    if (confirmId !== key) {
      setConfirmId(key);
      return;
    }
    permanentDelete.mutate({ type, id });
    setConfirmId(null);
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(locale === "en" ? "en-GB" : "sv-SE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-accent-gold mb-6">{t("trash.title")}</h1>

      {isEmpty ? (
        <div className="text-center py-16">
          <Trash2 className="mx-auto text-text-faint mb-4" size={40} />
          <p className="text-text-muted">{t("trash.empty")}</p>
        </div>
      ) : (
        <div className="space-y-8">
          <TrashSection
            title={t("trash.characters")}
            items={data!.characters.map((c) => ({ id: c.id, name: c.name, deletedAt: c.deletedAt }))}
            type="characters"
            onRestore={(id) => restore.mutate({ type: "characters", id })}
            onDelete={(id) => handleDelete("characters", id)}
            confirmId={confirmId}
            formatDate={formatDate}
            t={t}
          />
          <TrashSection
            title={t("trash.campaigns")}
            items={data!.campaigns.map((c) => ({ id: c.id, name: c.name, deletedAt: c.deletedAt }))}
            type="campaigns"
            onRestore={(id) => restore.mutate({ type: "campaigns", id })}
            onDelete={(id) => handleDelete("campaigns", id)}
            confirmId={confirmId}
            formatDate={formatDate}
            t={t}
          />
          <TrashSection
            title={t("trash.sessions")}
            items={data!.sessions.map((s) => ({ id: s.id, name: s.title, deletedAt: s.deletedAt }))}
            type="sessions"
            onRestore={(id) => restore.mutate({ type: "sessions", id })}
            onDelete={(id) => handleDelete("sessions", id)}
            confirmId={confirmId}
            formatDate={formatDate}
            t={t}
          />

          {hasWiki && (
            <>
              <hr className="border-border" />
              <h2 className="font-display text-xl text-accent-gold">{t("trash.wikiHeading")}</h2>
              <TrashSection
                title={t("trash.wikiBooks")}
                items={(data!.wikiBooks ?? []).map((b) => ({ id: b.id, name: b.title, deletedAt: b.deletedAt }))}
                type="wiki-books"
                onRestore={(id) => restore.mutate({ type: "wiki-books", id })}
                onDelete={(id) => handleDelete("wiki-books", id)}
                confirmId={confirmId}
                formatDate={formatDate}
                t={t}
              />
              <TrashSection
                title={t("trash.wikiChapters")}
                items={(data!.wikiChapters ?? []).map((c) => ({ id: c.id, name: `${c.bookTitle} - ${c.title}`, deletedAt: c.deletedAt }))}
                type="wiki-chapters"
                onRestore={(id) => restore.mutate({ type: "wiki-chapters", id })}
                onDelete={(id) => handleDelete("wiki-chapters", id)}
                confirmId={confirmId}
                formatDate={formatDate}
                t={t}
              />
              <TrashSection
                title={t("trash.wikiPages")}
                items={(data!.wikiPages ?? []).map((p) => ({ id: p.id, name: `${p.bookTitle} - ${p.title}`, deletedAt: p.deletedAt }))}
                type="wiki-pages"
                onRestore={(id) => restore.mutate({ type: "wiki-pages", id })}
                onDelete={(id) => handleDelete("wiki-pages", id)}
                confirmId={confirmId}
                formatDate={formatDate}
                t={t}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TrashSection({
  title,
  items,
  type,
  onRestore,
  onDelete,
  confirmId,
  formatDate,
  t,
}: {
  title: string;
  items: { id: number; name: string; deletedAt: string }[];
  type: TrashCategory;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
  confirmId: string | null;
  formatDate: (d: string) => string;
  t: (key: import("@/lib/i18n").TranslationKey, vars?: Record<string, string | number>) => string;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <h2 className="font-display text-lg text-text-base mb-3">{title}</h2>
      <div className="space-y-2">
        {items.map((item) => {
          const isConfirming = confirmId === `${type}-${item.id}`;
          return (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-bg-surface border border-border rounded-lg"
            >
              <div>
                <span className="text-sm text-text-base">{item.name}</span>
                <span className="ml-3 text-xs text-text-faint">
                  {t("trash.deletedAt", { date: formatDate(item.deletedAt) })}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onRestore(item.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-accent-green hover:bg-accent-green/10 rounded transition-colors"
                >
                  <RotateCcw size={14} />
                  {t("common.restore")}
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors ${
                    isConfirming
                      ? "bg-accent-red/20 text-accent-red"
                      : "text-text-muted hover:text-accent-red hover:bg-accent-red/10"
                  }`}
                >
                  {isConfirming ? <AlertTriangle size={14} /> : <Trash2 size={14} />}
                  {isConfirming ? t("trash.confirmDelete") : t("common.delete")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
