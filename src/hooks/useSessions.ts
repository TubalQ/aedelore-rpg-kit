"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TRASH_KEY, useUndoableTrash } from "@/hooks/useTrash";
import { api } from "@/lib/api/client";
import { cancelRowRefetch, writeSavedRow } from "@/hooks/saved-row";
import type {
  UpdateSessionInput,
  SessionRow,
} from "@/lib/schemas/session";

function campaignSessionsKey(campaignId: number) {
  return ["campaigns", campaignId, "sessions"] as const;
}

function sessionKey(id: number) {
  return ["sessions", id] as const;
}

export function useCampaignSessions(campaignId: number) {
  return useQuery({
    queryKey: campaignSessionsKey(campaignId),
    queryFn: () => api<SessionRow[]>(`/api/campaigns/${campaignId}/sessions`),
    enabled: campaignId > 0,
  });
}

// The editor polls so that changes made elsewhere while it is open (the MCP
// during play, another tab) reach its local copy before its next save of the
// same list. Shorter than the character sheet's 30 s: the MCP writes to the
// session several times a minute during play.
const SESSION_POLL_MS = 10_000;

export function useSession(id: number) {
  return useQuery({
    queryKey: sessionKey(id),
    queryFn: () => api<SessionRow>(`/api/sessions/${id}`),
    enabled: id > 0,
    refetchInterval: SESSION_POLL_MS,
  });
}

export function useCreateSession(campaignId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title?: string; date?: string; location?: string; gameLocation?: string }) =>
      api<SessionRow>(`/api/campaigns/${campaignId}/sessions`, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: campaignSessionsKey(campaignId) });
    },
  });
}

export function useUpdateSession(id: number, campaignId: number) {
  const qc = useQueryClient();
  return useMutation({
    // The editor's autosave shows its own status pill with retry.
    meta: { handlesErrors: true },
    mutationFn: (input: UpdateSessionInput) =>
      api<SessionRow>(`/api/sessions/${id}`, {
        method: "PUT",
        body: input,
      }),
    onMutate: () => cancelRowRefetch(qc, sessionKey(id)),
    onSuccess: async (data) => {
      await writeSavedRow<SessionRow>(qc, sessionKey(id), data);
      qc.invalidateQueries({ queryKey: campaignSessionsKey(campaignId), exact: true });
    },
  });
}

export function useDeleteSession(campaignId: number) {
  const qc = useQueryClient();
  const notifyTrash = useUndoableTrash();
  return useMutation({
    mutationFn: (id: number) =>
      api<{ success: boolean }>(`/api/sessions/${id}`, {
        method: "DELETE",
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: campaignSessionsKey(campaignId) });
      qc.invalidateQueries({ queryKey: TRASH_KEY });
      notifyTrash("sessions", id);
    },
  });
}

export function useLockSession(id: number, campaignId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ success: boolean }>(`/api/sessions/${id}/lock`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionKey(id) });
      qc.invalidateQueries({ queryKey: campaignSessionsKey(campaignId) });
    },
  });
}

export function useUnlockSession(id: number, campaignId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ success: boolean }>(`/api/sessions/${id}/lock`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionKey(id) });
      qc.invalidateQueries({ queryKey: campaignSessionsKey(campaignId) });
    },
  });
}
