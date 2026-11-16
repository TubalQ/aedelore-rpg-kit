"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { PlaceStashEntryInput, StashContent, StashEntry } from "@/lib/schemas/stash";

export const stashKey = (campaignId: number) => ["campaigns", campaignId, "stash"] as const;

export function useStash(campaignId: number) {
  return useQuery({
    queryKey: stashKey(campaignId),
    queryFn: () => api<StashEntry[]>(`/api/campaigns/${campaignId}/stash`),
    enabled: campaignId > 0,
  });
}

// Stash changes reach sessions (placements) and characters (holdings), so
// every mutation refreshes the campaign's views, not only the stash list.
function useInvalidateCampaign(campaignId: number) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["campaigns", campaignId] });
    qc.invalidateQueries({ queryKey: ["sessions"] });
    qc.invalidateQueries({ queryKey: ["characters"] });
  };
}

export function useCreateStashEntry(campaignId: number) {
  const invalidate = useInvalidateCampaign(campaignId);
  return useMutation({
    mutationFn: (content: StashContent) =>
      api<{ id: number }>(`/api/campaigns/${campaignId}/stash`, { method: "POST", body: content }),
    onSuccess: invalidate,
  });
}

export function useUpdateStashEntry(campaignId: number) {
  const invalidate = useInvalidateCampaign(campaignId);
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api(`/api/campaigns/${campaignId}/stash/${id}`, { method: "PUT", body: { data } }),
    onSuccess: invalidate,
  });
}

export function useDeleteStashEntry(campaignId: number) {
  const invalidate = useInvalidateCampaign(campaignId);
  return useMutation({
    mutationFn: (id: number) => api(`/api/campaigns/${campaignId}/stash/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function usePlaceStashEntry(campaignId: number) {
  const invalidate = useInvalidateCampaign(campaignId);
  return useMutation({
    mutationFn: ({ id, placement }: { id: number; placement: PlaceStashEntryInput }) =>
      api(`/api/campaigns/${campaignId}/stash/${id}/place`, { method: "POST", body: placement }),
    onSuccess: invalidate,
  });
}

export function useGiveStashEntry(campaignId: number) {
  const invalidate = useInvalidateCampaign(campaignId);
  return useMutation({
    mutationFn: ({ id, characterId }: { id: number; characterId: number }) =>
      api(`/api/campaigns/${campaignId}/stash/${id}/give`, { method: "POST", body: { characterId } }),
    onSuccess: invalidate,
  });
}
