"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/error-message";
import { useT } from "@/lib/i18n";
import { useToastStore } from "@/stores/toast-store";

export const TRASH_KEY = ["trash"] as const;

export type TrashData = {
  characters: { id: number; name: string; deletedAt: string }[];
  campaigns: { id: number; name: string; deletedAt: string }[];
  sessions: { id: number; title: string | null; sessionNumber: number; campaignName: string; deletedAt: string }[];
  wikiBooks?: { id: number; title: string; deletedAt: string }[];
  wikiChapters?: { id: number; title: string; bookTitle: string; deletedAt: string }[];
  wikiPages?: { id: number; title: string; bookTitle: string; deletedAt: string }[];
};

export type TrashCategory = "characters" | "campaigns" | "sessions" | "wiki-books" | "wiki-chapters" | "wiki-pages";

export function useTrash() {
  return useQuery({ queryKey: TRASH_KEY, queryFn: () => api<TrashData>("/api/trash") });
}

/** A restored character whose name another character in its campaign had taken comes back outside the campaign. */
function noticeRestore(result: unknown, t: ReturnType<typeof useT>["t"]): void {
  if (typeof result === "object" && result !== null && (result as { detachedFromCampaign?: unknown }).detachedFromCampaign === true) {
    useToastStore.getState().addToast(t("trash.restoredOutsideCampaign"), "info");
  }
}

export function useRestoreFromTrash() {
  const qc = useQueryClient();
  const { t } = useT();
  return useMutation({
    mutationFn: ({ type, id }: { type: TrashCategory; id: number }) =>
      api<unknown>(`/api/trash/${type}/${id}`, { method: "POST" }),
    // A restore can bring back a character, a campaign with its sessions, or
    // wiki content: refresh everything so every list shows it right away.
    onSuccess: (result) => {
      noticeRestore(result, t);
      qc.invalidateQueries();
    },
  });
}

export function usePermanentDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, id }: { type: TrashCategory; id: number }) =>
      api(`/api/trash/${type}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TRASH_KEY }),
  });
}

/**
 * After a delete: "Moved to trash · Undo". The undo calls the restore endpoint
 * directly (not a component-bound mutation), because the component that
 * deleted may already be gone (e.g. after navigating away from a campaign).
 */
export function useUndoableTrash(): (type: TrashCategory, id: number) => void {
  const qc = useQueryClient();
  const { t } = useT();
  return (type, id) => {
    useToastStore.getState().addActionToast(
      t("trash.movedToTrash"),
      {
        label: t("common.undo"),
        onClick: () => {
          api<unknown>(`/api/trash/${type}/${id}`, { method: "POST" })
            .then((result) => {
              noticeRestore(result, t);
              return qc.invalidateQueries();
            })
            .catch((err: unknown) => useToastStore.getState().addToast(errorMessage(err), "error"));
        },
      },
      "success",
    );
  };
}
