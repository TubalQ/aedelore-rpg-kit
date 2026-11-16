"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

interface WikiBookMenuProps {
  books: { slug: string; title: string }[];
}

// Hamburger dropdown that replaces the long horizontal book row. One control on
// every screen size: a "Books" button that opens a panel listing every book,
// with the current book highlighted. Closes on outside-click, Escape, or navigation.
export function WikiBookMenu({ books }: WikiBookMenuProps) {
  const pathname = usePathname();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close whenever the route changes (a book was picked); adjusted during render.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const currentBook = pathname?.match(/^\/wiki\/([^/]+)/)?.[1];

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-accent-gold/50 hover:text-text-base"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
        </svg>
        <span className="font-medium">{t("wiki.books")}</span>
        <svg
          width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-lg border border-border bg-bg-overlay p-1.5 shadow-2xl"
        >
          {books.map((book) => {
            const active = book.slug === currentBook;
            return (
              <Link prefetch={false}
                key={book.slug}
                href={`/wiki/${book.slug}`}
                role="menuitem"
                className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-bg-elevated font-medium text-accent-gold"
                    : "text-text-muted hover:bg-bg-elevated hover:text-text-base"
                }`}
              >
                {book.title}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
