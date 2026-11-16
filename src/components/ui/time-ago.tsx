"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n";

/**
 * Lokal-medveten relativtid ("5 min sedan" / "5 minutes ago") via Intl.RelativeTimeFormat.
 * Klientkomponent: renderar inget förrän monterad, dels för att undvika hydration-mismatch
 * (klockan + språket skiljer sig mellan server och klient), dels för att relativtid ska
 * räknas mot klientens nu. Följer locale-storet.
 */
// One shared clock for every TimeAgo on the page, ticking once a minute so
// relative times stay current. An external store: React reads it with
// useSyncExternalStore (the snapshot only changes on a tick).
let clockNow = Date.now();
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;

function subscribeClock(listener: () => void): () => void {
  clockListeners.add(listener);
  if (!clockTimer) {
    clockNow = Date.now();
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      clockListeners.forEach((l) => l());
    }, 60_000);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

const readClock = (): number => clockNow;

export function TimeAgo({ date }: { date: Date | string }) {
  const { t, locale } = useT();
  // null on the server and during hydration, then the shared minute clock.
  const now = useSyncExternalStore(subscribeClock, readClock, () => null);
  if (now === null) return null;

  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((now - d.getTime()) / 1000);
  if (seconds < 60) return <>{t("wiki.justNow")}</>;

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return <>{rtf.format(-minutes, "minute")}</>;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return <>{rtf.format(-hours, "hour")}</>;
  const days = Math.floor(hours / 24);
  if (days < 30) return <>{rtf.format(-days, "day")}</>;
  const months = Math.floor(days / 30);
  return <>{rtf.format(-months, "month")}</>;
}
