"use client";

import { create } from "zustand";

export type ToastVariant = "error" | "success" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
}

const DEFAULT_DURATION_MS = 5000;
const ACTION_DURATION_MS = 8000;

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, variant?: ToastVariant, durationMs?: number) => number;
  /** A toast with one action button, e.g. "Encounter removed · Undo". */
  addActionToast: (message: string, action: ToastAction, variant?: ToastVariant) => number;
  removeToast: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => {
  const push = (toast: Omit<Toast, "id">, durationMs: number): number => {
    const id = nextId++;
    // The same message twice in a row (e.g. one failing save retried) is shown once.
    set((s) => ({
      toasts: [...s.toasts.filter((t) => t.message !== toast.message), { ...toast, id }],
    }));
    setTimeout(() => get().removeToast(id), durationMs);
    return id;
  };
  return {
    toasts: [],
    addToast: (message, variant = "error", durationMs = DEFAULT_DURATION_MS) =>
      push({ message, variant }, durationMs),
    addActionToast: (message, action, variant = "info") =>
      push({ message, variant, action }, ACTION_DURATION_MS),
    removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  };
});
