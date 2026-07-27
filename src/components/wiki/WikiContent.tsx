"use client";

import { useEffect, useRef } from "react";
import DOMPurify from "isomorphic-dompurify";

interface WikiContentProps {
  html: string;
}

export function WikiContent({ html }: WikiContentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const sanitized = DOMPurify.sanitize(html);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.querySelectorAll<HTMLElement>(".spoiler").forEach((spoiler) => {
      if (spoiler.dataset.processed) return;
      spoiler.dataset.processed = "1";

      const label = spoiler.dataset.label || "Spoiler";

      if (spoiler.dataset.locked) {
        const lockedHeader = document.createElement("div");
        lockedHeader.className = "spoiler-header";
        lockedHeader.textContent = `🔒 ${label}`;
        spoiler.classList.add("collapsed");
        spoiler.appendChild(lockedHeader);
        return;
      }

      const header = document.createElement("button");
      header.className = "spoiler-header";
      header.textContent = `🔒 ${label}`;
      header.addEventListener("click", () => {
        spoiler.classList.toggle("collapsed");
        header.textContent = spoiler.classList.contains("collapsed")
          ? `🔒 ${label}`
          : `🔓 ${label}`;
      });

      const body = document.createElement("div");
      body.className = "spoiler-body";
      while (spoiler.firstChild) body.appendChild(spoiler.firstChild);

      spoiler.classList.add("collapsed");
      spoiler.appendChild(header);
      spoiler.appendChild(body);
    });
  }, [sanitized]);

  return (
    <div
      ref={ref}
      className="wiki-content prose prose-invert prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
