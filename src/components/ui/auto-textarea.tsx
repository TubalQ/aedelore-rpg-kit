"use client";

import { useLayoutEffect, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";

/**
 * Textarea som växer med innehållet. `rows` anger minsta höjd. JS-baserad
 * autosize eftersom CSS `field-sizing: content` ännu saknas i Safari/Firefox
 * och spelarna mest kör mobil/platta (iOS). Höjden räknas om vid varje
 * värdeändring och vid mount (så redan ifyllda fält öppnas i full höjd).
 */
export function AutoTextarea({
  value,
  rows = 2,
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    // +2px kompenserar för ramarna (border-box: scrollHeight saknar border).
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={rows}
      className={`${className} resize-none overflow-hidden`}
      {...rest}
    />
  );
}
