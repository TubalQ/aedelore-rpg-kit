"use client";

import { useToastStore, type ToastVariant } from "@/stores/toast-store";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/lib/i18n";

// Theme tokens only, so toasts stay readable in both dark themes and Vellum.
const variantStyles: Record<ToastVariant, string> = {
  error: "border-accent-red/60",
  success: "border-accent-green/60",
  info: "border-accent-gold/50",
};

const variantIcon: Record<ToastVariant, { Icon: typeof Info; className: string }> = {
  error: { Icon: AlertTriangle, className: "text-accent-red" },
  success: { Icon: CheckCircle2, className: "text-accent-green" },
  info: { Icon: Info, className: "text-accent-gold" },
};

export function ToastContainer() {
  const { t } = useT();
  const { toasts, removeToast } = useToastStore();

  // Always mounted: a live region that appears together with its first message
  // is not announced by most screen readers.
  return (
    <div
      role="region"
      aria-label={t("common.notifications")}
      aria-live="polite"
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2 sm:max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => {
        const { Icon, className } = variantIcon[toast.variant];
        return (
          <div
            key={toast.id}
            role={toast.variant === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-bg-elevated px-4 py-3 text-sm text-text-base shadow-lg animate-toast-in",
              variantStyles[toast.variant],
            )}
          >
            <Icon size={16} className={cn("mt-0.5 shrink-0", className)} aria-hidden="true" />
            <span className="flex-1">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  removeToast(toast.id);
                }}
                className="shrink-0 rounded px-2 py-0.5 -my-0.5 font-semibold text-accent-gold hover:bg-accent-gold/10"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label={t("common.dismiss")}
              className="shrink-0 -m-1 p-1 text-text-muted hover:text-text-base"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
