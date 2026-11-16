"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { useToastStore } from "@/stores/toast-store";
import { useT } from "@/lib/i18n";

// Idle sign-out. Activity in ANY tab counts (shared through localStorage), so
// an idle character sheet in one tab never signs out a DM who is working in
// another. Long enough for a phone lying on the game table.
const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
const LOGOUT_WARNING_LEAD = 5 * 60 * 1000; // warn 5 min before
const CHECK_EVERY_MS = 30 * 1000;
const ACTIVITY_WRITE_THROTTLE_MS = 15 * 1000;
const STORAGE_KEY = "aedelore-last-activity";
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

/** Autosaving editors listen for this and save before the sign-out. */
export const FLUSH_BEFORE_LOGOUT_EVENT = "aedelore:flush-before-logout";
/** Longest wait for open editors to save before signing out anyway. */
const FLUSH_GRACE_MS = 5000;

/** The event's detail: each listening editor adds the promise of its save. */
export interface FlushBeforeLogoutDetail {
  saves: Promise<unknown>[];
}

/**
 * Signs out after open editors have saved (F4: the header's Sign out used to
 * sign out at once and drop the last change). Waits for their saves, at most
 * FLUSH_GRACE_MS, so a hanging save never keeps the user signed in.
 */
export async function signOutAfterSaving(callbackUrl = "/login"): Promise<void> {
  const detail: FlushBeforeLogoutDetail = { saves: [] };
  window.dispatchEvent(new CustomEvent<FlushBeforeLogoutDetail>(FLUSH_BEFORE_LOGOUT_EVENT, { detail }));
  await Promise.race([
    Promise.allSettled(detail.saves),
    new Promise((resolve) => setTimeout(resolve, FLUSH_GRACE_MS)),
  ]);
  await signOut({ redirectTo: callbackUrl });
}

function readLastActivity(): number {
  try {
    return Number(window.localStorage.getItem(STORAGE_KEY)) || Date.now();
  } catch {
    // Storage blocked (private mode): fall back to this tab's own clock.
    return Date.now();
  }
}

function writeLastActivity(at: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    // Storage blocked: the in-memory timestamp below still covers this tab.
  }
}

export function useAutoLogout(): void {
  const { t } = useT();
  const lastLocalRef = useRef(0);
  const lastWriteRef = useRef(0);
  const warningToastIdRef = useRef<number | null>(null);
  const signingOutRef = useRef(false);

  useEffect(() => {
    lastLocalRef.current = Date.now();
    writeLastActivity(lastLocalRef.current);

    const onActivity = () => {
      const now = Date.now();
      lastLocalRef.current = now;
      if (now - lastWriteRef.current > ACTIVITY_WRITE_THROTTLE_MS) {
        lastWriteRef.current = now;
        writeLastActivity(now);
      }
      if (warningToastIdRef.current !== null) {
        useToastStore.getState().removeToast(warningToastIdRef.current);
        warningToastIdRef.current = null;
      }
    };

    const check = () => {
      const last = Math.max(readLastActivity(), lastLocalRef.current);
      const idle = Date.now() - last;
      if (idle >= INACTIVITY_TIMEOUT && !signingOutRef.current) {
        signingOutRef.current = true;
        void signOutAfterSaving();
      } else if (idle >= INACTIVITY_TIMEOUT - LOGOUT_WARNING_LEAD && warningToastIdRef.current === null) {
        warningToastIdRef.current = useToastStore
          .getState()
          .addToast(t("autoLogout.warning", { n: LOGOUT_WARNING_LEAD / 60000 }), "info", LOGOUT_WARNING_LEAD);
      }
    };

    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, onActivity, { passive: true });
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => {
      clearInterval(timer);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity);
    };
  }, [t]);
}
