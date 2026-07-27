"use client";

import { useEffect, useRef, useCallback } from "react";
import { signOut } from "next-auth/react";
import { useToastStore } from "@/stores/toast-store";
import { useT } from "@/lib/i18n";

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const LOGOUT_WARNING_LEAD = 5 * 60 * 1000; // varna 5 min före utloggning
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

export function useAutoLogout(): void {
  const { t } = useT();
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const warningToastIdRef = useRef<number | null>(null);

  const resetTimer = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (warningToastIdRef.current !== null) {
      useToastStore.getState().removeToast(warningToastIdRef.current);
      warningToastIdRef.current = null;
    }
    warningTimerRef.current = setTimeout(() => {
      warningToastIdRef.current = useToastStore
        .getState()
        .addToast(
          t("autoLogout.warning", { n: LOGOUT_WARNING_LEAD / 60000 }),
          "info",
          LOGOUT_WARNING_LEAD,
        );
    }, INACTIVITY_TIMEOUT - LOGOUT_WARNING_LEAD);
    logoutTimerRef.current = setTimeout(() => {
      signOut({ redirectTo: "/login" });
    }, INACTIVITY_TIMEOUT);
  }, [t]);

  useEffect(() => {
    resetTimer();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [resetTimer]);
}
