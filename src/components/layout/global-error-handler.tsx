"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/api/report-error";
import { ApiError } from "@/lib/api/client";
import { useToastStore } from "@/stores/toast-store";
import { translate } from "@/lib/i18n";
import { useLocaleStore } from "@/stores/locale-store";

function unexpected(): void {
  useToastStore.getState().addToast(translate("error.unexpected", useLocaleStore.getState().locale), "error");
}

export function GlobalErrorHandler() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportError(event.error ?? event.message, "window-error");
      unexpected();
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      // A rejected mutateAsync() was already shown by the MutationCache toast;
      // it is an expected API answer (e.g. a wrong share code), not a crash.
      if (event.reason instanceof ApiError) {
        event.preventDefault();
        return;
      }
      reportError(event.reason, "unhandled-rejection");
      unexpected();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
