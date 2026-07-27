"use client";

import Link from "next/link";
import { Trash2, AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { WikiBook } from "@/lib/schemas/wiki";

type Props = {
  book: WikiBook;
  onDelete: () => void;
  isConfirming: boolean;
};

export function BookCard({ book, onDelete, isConfirming }: Props) {
  const { t } = useT();

  return (
    <div className="flex flex-col justify-between bg-bg-surface border border-border rounded-lg p-4">
      <Link href={`/wiki-admin/books/${book.id}`} className="group">
        <h2 className="text-lg font-semibold text-text-base group-hover:text-accent-gold transition-colors">
          {book.title}
        </h2>
        {book.description && (
          <p className="mt-1 text-sm text-text-muted line-clamp-2">
            {book.description}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3 text-xs text-text-faint">
          <span>/{book.slug}</span>
          <span>{t("wikiAdmin.sortOrder")}: {book.sortOrder}</span>
        </div>
      </Link>

      <div className="mt-3 flex justify-end">
        <button
          onClick={onDelete}
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
}
