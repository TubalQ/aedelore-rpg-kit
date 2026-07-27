"use client";

import { useToastStore, type ToastVariant } from "@/stores/toast-store";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const variantStyles: Record<ToastVariant, string> = {
  error: "border-red-500/40 bg-red-950/80 text-red-200",
  success: "border-green-500/40 bg-green-950/80 text-green-200",
  info: "border-accent-gold/40 bg-bg-elevated text-text-base",
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-start gap-2 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm text-sm animate-toast-in",
            variantStyles[toast.variant]
          )}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
