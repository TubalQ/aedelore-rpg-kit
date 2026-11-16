"use client";

import { useState, useRef, useCallback } from "react";
import { FANTASY_LANGUAGES, translateToFantasy } from "@/lib/domain/fantasy-languages";

export function FantasyTranslator() {
  const [language, setLanguage] = useState("common");
  const originals = useRef<Map<Text, string>>(new Map());

  const restore = useCallback(() => {
    originals.current.forEach((original, node) => {
      node.textContent = original;
    });
    originals.current.clear();
  }, []);

  function handleChange(langId: string) {
    restore();
    setLanguage(langId);
    if (langId === "common") return;

    const container = document.querySelector(".wiki-content");
    if (!container) return;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) nodes.push(node as Text);

    for (const textNode of nodes) {
      const original = textNode.textContent || "";
      if (!original.trim()) continue;
      originals.current.set(textNode, original);
      textNode.textContent = translateToFantasy(original, langId);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-faint">📜</span>
      <select
        value={language}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded border border-border bg-bg-surface px-2 py-1 text-xs text-text-muted focus:border-accent-gold/40 focus:outline-none"
      >
        {FANTASY_LANGUAGES.map((lang) => (
          <option key={lang.id} value={lang.id}>{lang.name}</option>
        ))}
      </select>
    </div>
  );
}
