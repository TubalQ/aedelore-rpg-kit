"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/api/report-error";
import { useToastStore } from "@/stores/toast-store";

export function GlobalErrorHandler() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportError(event.error ?? event.message, "window-error");
      useToastStore.getState().addToast("Ett oväntat fel uppstod.", "error");
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      reportError(event.reason, "unhandled-rejection");
      useToastStore.getState().addToast("Ett oväntat fel uppstod.", "error");
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
