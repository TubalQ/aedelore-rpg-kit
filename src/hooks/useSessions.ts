"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
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

export function useSession(id: number) {
  return useQuery({
    queryKey: sessionKey(id),
    queryFn: () => api<SessionRow>(`/api/sessions/${id}`),
    enabled: id > 0,
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
    mutationFn: (input: UpdateSessionInput) =>
      api<SessionRow>(`/api/sessions/${id}`, {
        method: "PUT",
        body: input,
      }),
    onSuccess: (data) => {
      qc.setQueryData(sessionKey(id), data);
      qc.invalidateQueries({ queryKey: campaignSessionsKey(campaignId), exact: true });
    },
  });
}

export function useDeleteSession(campaignId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api<{ success: boolean }>(`/api/sessions/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: campaignSessionsKey(campaignId) });
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
