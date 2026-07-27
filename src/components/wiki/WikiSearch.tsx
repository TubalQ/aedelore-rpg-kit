"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useT } from "@/lib/i18n";

export function WikiSearch() {
  const { t } = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/wiki/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("wiki.search")}
        className="w-full px-3 py-1.5 text-sm bg-bg-elevated border border-border rounded text-text-base placeholder:text-text-faint focus:outline-none focus:border-accent-gold/60 transition-colors"
      />
    </form>
  );
}
