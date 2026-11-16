"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import Link from "next/link";
import { FileText, Layers } from "lucide-react";
import type { WikiChapter, WikiPageSummary } from "@/lib/schemas/wiki";

type Props = { bookId: number };

export function BookContentList({ bookId }: Props) {
  const { t } = useT();

  const { data: chapters, isLoading: chaptersLoading } = useQuery({
    queryKey: ["wiki-chapters", bookId],
    queryFn: () => api<WikiChapter[]>(`/api/wiki/admin/chapters?bookId=${bookId}`),
  });

  const { data: pages, isLoading: pagesLoading } = useQuery({
    queryKey: ["wiki-pages", bookId],
    queryFn: () => api<WikiPageSummary[]>(`/api/wiki/admin/pages?bookId=${bookId}`),
  });

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-text-base">
            {t("wikiAdmin.chapters")}
          </h2>
          <Link
            href={`/wiki-admin/chapters/new?bookId=${bookId}`}
            className="text-sm text-accent-gold hover:text-accent-gold/80 transition-colors"
          >
            + {t("wikiAdmin.newChapter")}
          </Link>
        </div>

        {chaptersLoading && (
          <p className="text-sm text-text-muted">{t("common.loading")}</p>
        )}

        {chapters && chapters.length === 0 && (
          <p className="text-sm text-text-faint">{t("wikiAdmin.noChapters")}</p>
        )}

        {chapters && chapters.length > 0 && (
          <div className="space-y-2">
            {chapters.map((ch) => (
              <Link
                key={ch.id}
                href={`/wiki-admin/chapters/${ch.id}`}
                className="flex items-center gap-3 p-3 bg-bg-surface border border-border rounded-lg hover:border-accent-gold/30 transition-colors"
              >
                <Layers size={16} className="text-text-faint shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-text-base">{ch.title}</span>
                  {ch.description && (
                    <p className="text-xs text-text-muted truncate">{ch.description}</p>
                  )}
                </div>
                <span className="text-xs text-text-faint shrink-0">#{ch.sortOrder}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-text-base">
            {t("wikiAdmin.pages")}
          </h2>
          <Link
            href={`/wiki-admin/pages/new?bookId=${bookId}`}
            className="text-sm text-accent-gold hover:text-accent-gold/80 transition-colors"
          >
            + {t("wikiAdmin.newPage")}
          </Link>
        </div>

        {pagesLoading && (
          <p className="text-sm text-text-muted">{t("common.loading")}</p>
        )}

        {pages && pages.length === 0 && (
          <p className="text-sm text-text-faint">{t("wikiAdmin.noPages")}</p>
        )}

        {pages && pages.length > 0 && (
          <div className="space-y-2">
            {pages.map((pg) => (
              <Link
                key={pg.id}
                href={`/wiki-admin/pages/${pg.id}`}
                className="flex items-center gap-3 p-3 bg-bg-surface border border-border rounded-lg hover:border-accent-gold/30 transition-colors"
              >
                <FileText size={16} className="text-text-faint shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-text-base">{pg.title}</span>
                  {pg.summary && (
                    <p className="text-xs text-text-muted truncate">{pg.summary}</p>
                  )}
                </div>
                <span className="text-xs text-text-faint shrink-0">#{pg.sortOrder}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
