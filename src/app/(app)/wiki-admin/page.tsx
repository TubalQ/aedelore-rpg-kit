"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { useToastStore } from "@/stores/toast-store";
import { BookCard } from "./book-card";
import { CreateBookForm } from "./create-book-form";
import { useState } from "react";
import { Plus, BookOpen } from "lucide-react";
import type { WikiBook } from "@/lib/schemas/wiki";

export default function WikiAdminPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const [showCreate, setShowCreate] = useState(false);

  const { data: books, isLoading, error } = useQuery({
    queryKey: ["wiki-books"],
    queryFn: () => api<WikiBook[]>("/api/wiki"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      api<void>(`/api/wiki/admin/books/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wiki-books"] }),
    onError: (e) => addToast(e instanceof Error ? e.message : t("common.deleteFailed"), "error"),
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  function handleDelete(id: number) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    deleteMutation.mutate(id);
    setConfirmDeleteId(null);
  }

  if (isLoading) {
    return <div className="text-text-muted p-8">{t("common.loading")}</div>;
  }

  if (error) {
    const msg = error instanceof ApiError ? error.message : t("error.unexpected");
    return <div className="text-accent-red p-8">{msg}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-accent-gold">
          {t("wikiAdmin.title")}
        </h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-lg bg-accent-gold px-4 py-2 text-sm font-semibold text-bg-base transition-colors hover:bg-accent-gold/80"
        >
          <Plus size={16} />
          {t("wikiAdmin.newBook")}
        </button>
      </div>

      {showCreate && (
        <CreateBookForm onDone={() => setShowCreate(false)} />
      )}

      {books && books.length === 0 && !showCreate && (
        <div className="text-center py-16">
          <BookOpen className="mx-auto text-text-faint mb-4" size={40} />
          <p className="text-text-muted">{t("wikiAdmin.noBooks")}</p>
        </div>
      )}

      {books && books.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onDelete={() => handleDelete(book.id)}
              isConfirming={confirmDeleteId === book.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
