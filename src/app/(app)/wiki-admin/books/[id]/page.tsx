"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { BookEditForm } from "./book-edit-form";
import { BookContentList } from "./book-content-list";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

type AdminBook = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  authorNote: string | null;
  sortOrder: number;
};

type Params = { params: Promise<{ id: string }> };

export default function BookEditorPage({ params }: Params) {
  const { id } = use(params);
  const bookId = Number(id);
  const { t } = useT();

  const { data: book, isLoading, error } = useQuery({
    queryKey: ["wiki-book", bookId],
    queryFn: () => api<AdminBook>(`/api/wiki/admin/books/${bookId}`),
    enabled: !Number.isNaN(bookId),
  });

  if (isLoading) {
    return <div className="text-text-muted p-8">{t("common.loading")}</div>;
  }

  if (error) {
    const msg = error instanceof ApiError ? error.message : t("error.unexpected");
    return <div className="text-accent-red p-8">{msg}</div>;
  }

  if (!book) {
    return <div className="text-text-muted p-8">{t("wikiAdmin.bookNotFound")}</div>;
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-text-muted">
        <Link
          href="/wiki-admin"
          className="hover:text-accent-gold transition-colors"
        >
          {t("wikiAdmin.title")}
        </Link>
        <ChevronRight size={14} />
        <span className="text-text-base">{book.title}</span>
      </nav>

      <BookEditForm book={book} />

      <hr className="border-border" />

      <BookContentList bookId={book.id} />
    </div>
  );
}
