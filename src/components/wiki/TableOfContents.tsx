"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9åäöü\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

interface TableOfContentsProps {
  /** "sidebar" (default) = sticky högerspalt ≥lg; "inline" = hopfällbar
      dropdown <lg - mobil/platta saknade tidigare TOC helt. */
  variant?: "sidebar" | "inline";
}

export function TableOfContents({ variant = "sidebar" }: TableOfContentsProps) {
  const { t } = useT();
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const container = document.querySelector(".wiki-content");
    if (!container) return;

    // W9: empty headings are skipped, and each anchor is unique (two
    // headings "Notes" got the same id, and one without text got none).
    const headings = Array.from(container.querySelectorAll<HTMLElement>("h2, h3")).filter((h) => (h.textContent ?? "").trim());
    const tocItems: TocItem[] = [];
    const used = new Set(Array.from(document.querySelectorAll("[id]")).map((el) => el.id).filter((id) => !headings.some((h) => h.id === id)));

    headings.forEach((h, i) => {
      if (!h.id) {
        const base = slugify(h.textContent || "") || `section-${i + 1}`;
        let id = base;
        for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
        h.id = id;
      }
      used.add(h.id);
      tocItems.push({
        id: h.id,
        text: h.textContent || "",
        level: h.tagName === "H2" ? 2 : 3,
      });
    });

    if (tocItems.length < 2) return;
    // The headings exist only in the server-rendered article DOM (an external
    // system to React), so they can only be read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(tocItems);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, []);

  if (items.length === 0) return null;

  if (variant === "inline") {
    return (
      <details className="lg:hidden mb-6 rounded border border-border bg-bg-surface/50">
        <summary className="cursor-pointer select-none px-3 py-2.5 text-sm text-text-muted marker:text-accent-gold">
          {t("wiki.tableOfContents")}
        </summary>
        <ul className="px-3 pb-3 space-y-1">
          {items.map((item) => (
            <li key={item.id} className={item.level === 3 ? "ml-3" : ""}>
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
                }}
                className="block py-1.5 text-sm text-text-muted hover:text-accent-gold"
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </details>
    );
  }

  return (
    <nav className="hidden lg:block w-56 shrink-0 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <p className="text-[10px] uppercase tracking-wider text-text-faint mb-2">{t("wiki.tableOfContents")}</p>
      <ul className="space-y-1 border-l border-border">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? "ml-3" : ""}>
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`block rounded-r text-xs py-1 pl-3 -ml-px border-l-2 transition-colors ${
                activeId === item.id
                  ? "border-accent-gold bg-accent-gold/[0.07] text-accent-gold"
                  : "border-transparent text-text-muted hover:text-text-base hover:border-text-faint"
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
