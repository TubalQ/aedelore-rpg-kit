"use client";

import { useState, useSyncExternalStore } from "react";

const SEEN_KEY = "rpgkit-welcome-seen";

const noSubscribe = () => () => {};
function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    // localStorage unavailable: don't show the notice at all.
    return true;
  }
}

export function WelcomeNotice() {
  // Seen-flag from localStorage (hidden on the server and if storage is blocked).
  const seen = useSyncExternalStore(noSubscribe, readSeen, () => true);
  const [dismissed, setDismissed] = useState(false);

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Storage blocked: the notice is still hidden for this page view below.
    }
    setDismissed(true);
  }

  if (seen || dismissed) return null;

  return (
    <div
      role="dialog"
      aria-label="About Aedelore RPG Kit"
      className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-bg-surface/95 p-5 shadow-2xl backdrop-blur-md"
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded p-1.5 text-text-muted transition-colors hover:text-text-base"
      >
        ✕
      </button>

      <p className="font-display text-base font-semibold text-accent-gold">
        ✨ Welcome to Aedelore RPG Kit
      </p>

      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        <strong className="text-text-base">Aedelore</strong> is a tabletop roleplaying game - a
        dark-fantasy world of dreaming gods, failing seals, and a patient void, played with
        friends around the table.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        This site runs on the <strong className="text-text-base">Aedelore RPG Kit</strong>: the
        free, open, self-hostable technology behind it - character sheets, campaigns, and a
        living wiki - ready for you to build and run <strong className="text-text-base">your own</strong> RPG.
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <a
          href="https://aedelore.nu"
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-accent-gold px-3.5 py-2 text-xs font-semibold text-bg-base transition-all hover:brightness-110"
        >
          Discover the Aedelore RPG →
        </a>
        <button
          onClick={dismiss}
          className="text-xs text-text-muted transition-colors hover:text-text-base"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
