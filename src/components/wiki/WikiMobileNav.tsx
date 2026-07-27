"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";

interface WikiMobileNavProps {
  books: { slug: string; title: string }[];
}

export function WikiMobileNav({ books }: WikiMobileNavProps) {
  const router = useRouter();
  const { t } = useT();

  return (
    <select
      onChange={(e) => {
        if (e.target.value) router.push(`/wiki/${e.target.value}`);
      }}
      defaultValue=""
      className="max-w-[40vw] truncate rounded border border-border bg-bg-elevated px-2 py-1.5 text-sm text-text-muted focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
    >
      <option value="" disabled>
        {t("wiki.selectBook")}
      </option>
      {books.map((book) => (
        <option key={book.slug} value={book.slug}>
          {book.title}
        </option>
      ))}
    </select>
  );
}
