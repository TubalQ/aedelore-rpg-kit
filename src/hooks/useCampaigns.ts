"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  CreateCampaignInput,
  UpdateCampaignInput,
  JoinCampaignInput,
  CampaignWithCounts,
  CampaignPlayer,
  CampaignRow,
  CampaignBoxItem,
} from "@/lib/schemas/campaign";
import type { CampaignCharacter, PlayerCampaignView } from "@/lib/db/queries/campaigns";
import { ApiError } from "@/lib/api/client";

const CAMPAIGNS_KEY = ["campaigns"] as const;

function campaignKey(id: number) {
  return ["campaigns", id] as const;
}

function campaignPlayersKey(id: number) {
  return ["campaigns", id, "players"] as const;
}

function campaignCharactersKey(id: number) {
  return ["campaigns", id, "characters"] as const;
}

export function useCampaigns() {
  return useQuery({
    queryKey: CAMPAIGNS_KEY,
    queryFn: () => api<CampaignWithCounts[]>("/api/campaigns"),
  });
}

export function useCampaign(id: number) {
  return useQuery({
    queryKey: campaignKey(id),
    queryFn: () => api<CampaignRow>(`/api/campaigns/${id}`),
    enabled: id > 0,
    retry: (count, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return count < 3;
    },
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCampaignInput) =>
      api<CampaignRow>("/api/campaigns", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
    },
  });
}

export function useUpdateCampaign(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCampaignInput) =>
      api<CampaignRow>(`/api/campaigns/${id}`, {
        method: "PUT",
        body: input,
      }),
    onSuccess: (data) => {
      qc.setQueryData(campaignKey(id), data);
      qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY, exact: true });
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api<{ success: boolean }>(`/api/campaigns/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
    },
  });
}

export function useGenerateShareCode(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ shareCode: string }>(`/api/campaigns/${id}/share`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: campaignKey(id) });
    },
  });
}

export function useRevokeShareCode(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ success: boolean }>(`/api/campaigns/${id}/share`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: campaignKey(id) });
      qc.invalidateQueries({ queryKey: campaignPlayersKey(id) });
    },
  });
}

export function useJoinCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: JoinCampaignInput) =>
      api<{ campaignId: number; campaignName: string }>("/api/campaigns/join", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
      // The attached character now belongs to the campaign.
      qc.invalidateQueries({ queryKey: ["characters"] });
    },
  });
}

export function useLeaveCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (campaignId: number) =>
      api<{ success: boolean }>(`/api/campaigns/${campaignId}/leave`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY });
    },
  });
}

export function useCampaignPlayers(id: number) {
  return useQuery({
    queryKey: campaignPlayersKey(id),
    queryFn: () => api<CampaignPlayer[]>(`/api/campaigns/${id}/players`),
    enabled: id > 0,
  });
}

export function useRemovePlayer(campaignId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playerId: string) =>
      api<{ success: boolean }>(`/api/campaigns/${campaignId}/players/${playerId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: campaignPlayersKey(campaignId) });
    },
  });
}

export function useCampaignCharacters(campaignId: number) {
  return useQuery({
    queryKey: campaignCharactersKey(campaignId),
    queryFn: () => api<CampaignCharacter[]>(`/api/campaigns/${campaignId}/characters`),
    enabled: campaignId > 0,
  });
}

export function usePlayerCampaignView(campaignId: number) {
  return useQuery({
    queryKey: ["campaigns", campaignId, "player-view"] as const,
    queryFn: () => api<PlayerCampaignView>(`/api/campaigns/${campaignId}/player-view`),
    enabled: campaignId > 0,
    refetchInterval: 30_000,
  });
}

// Attach one of the player's own characters to a campaign they already joined
// (e.g. they joined without a character, or created one afterwards).
export function useAttachCharacter(campaignId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (characterId: number) =>
      api<Record<string, unknown>>(`/api/characters/${characterId}`, {
        method: "PUT",
        body: { campaignId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns", campaignId, "player-view"] });
      qc.invalidateQueries({ queryKey: campaignCharactersKey(campaignId) });
      qc.invalidateQueries({ queryKey: ["characters"] });
    },
  });
}

export function useDmCharacterControl(campaignId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api<unknown>(`/api/campaigns/${campaignId}/characters/control`, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: campaignCharactersKey(campaignId) });
      // DM actions (XP/items/equipment/HP/locks) change what the player sees.
      qc.invalidateQueries({ queryKey: ["campaigns", campaignId, "player-view"] });
      qc.invalidateQueries({ queryKey: ["characters"] });
    },
  });
}

// ─── Item box (förråd) ───────────────────────────────────────

function campaignBoxKey(id: number) {
  return ["campaigns", id, "box"] as const;
}

export function useCampaignBox(campaignId: number) {
  return useQuery({
    queryKey: campaignBoxKey(campaignId),
    queryFn: () => api<CampaignBoxItem[]>(`/api/campaigns/${campaignId}/box`),
    enabled: campaignId > 0,
  });
}

export function useCampaignBoxAction(campaignId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api<unknown>(`/api/campaigns/${campaignId}/box`, { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: campaignBoxKey(campaignId) });
      // handout ändrar en karaktärs innehåll.
      qc.invalidateQueries({ queryKey: campaignCharactersKey(campaignId) });
      qc.invalidateQueries({ queryKey: ["characters"] });
    },
  });
}
