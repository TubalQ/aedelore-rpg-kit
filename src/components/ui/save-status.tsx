"use client";

import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { SaveStatus } from "@/hooks/useAutosave";
import { cn } from "@/lib/utils/cn";

/**
 * Autosave state in a small fixed pill, visible wherever the user has
 * scrolled. "Saved" shows briefly (see useAutosave); a failed save stays with a retry.
 */
export function SaveStatusPill({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  const { t } = useT();
  if (status === "idle") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border bg-bg-elevated px-3 py-1.5 text-xs shadow-lg",
        status === "error" ? "border-accent-red/60 text-text-base" : "border-border text-text-muted",
      )}
    >
      {status === "error" ? (
        <>
          <AlertTriangle size={13} className="text-accent-red" aria-hidden="true" />
          <span>{t("common.saveFailed")}</span>
          <button
            type="button"
            onClick={onRetry}
            className="-my-1 rounded-full px-2 py-1 font-semibold text-accent-gold hover:bg-accent-gold/10"
          >
            {t("common.retry")}
          </button>
        </>
      ) : status === "saved" ? (
        <>
          <Check size={13} className="text-accent-green" aria-hidden="true" />
          <span>{t("common.saved")}</span>
        </>
      ) : (
        <>
          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
          <span>{status === "saving" ? t("common.saving") : t("common.unsaved")}</span>
        </>
      )}
    </div>
  );
}
