"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";

export function WikiLightbox() {
  const [src, setSrc] = useState<string | null>(null);
  const [alt, setAlt] = useState<string>("");

  const close = useCallback(() => setSrc(null), []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const img = (e.target as HTMLElement).closest(".wiki-content img") as HTMLImageElement | null;
      if (!img) return;
      e.preventDefault();
      setSrc(img.src);
      setAlt(img.alt || "");
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (!src) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [src, close]);

  if (!src) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fade-in"
      onClick={close}
    >
      <button
        onClick={close}
        className="absolute top-4 right-4 text-2xl text-text-faint hover:text-text-base z-10"
        aria-label="Close"
      >
        ✕
      </button>
      <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt={alt}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg border border-accent-gold/40"
        />
        {alt && <p className="text-sm text-text-muted">{alt}</p>}
      </div>
    </div>,
    document.body,
  );
}
