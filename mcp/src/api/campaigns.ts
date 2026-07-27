import { ApiClient } from "./client.js";

export async function listCampaigns(client: ApiClient, token: string) {
  return client.request<unknown[]>("/api/campaigns", token);
}

export async function getCampaign(client: ApiClient, token: string, id: number) {
  return client.request<unknown>(`/api/campaigns/${id}`, token);
}

export async function createCampaign(
  client: ApiClient,
  token: string,
  name: string,
  description: string,
) {
  return client.request<unknown>("/api/campaigns", token, {
    method: "POST",
    body: { name, description },
  });
}

export async function updateCampaign(
  client: ApiClient,
  token: string,
  id: number,
  data: { name?: string; description?: string },
) {
  return client.request<unknown>(`/api/campaigns/${id}`, token, {
    method: "PUT",
    body: data,
  });
}

export async function generateShareCode(client: ApiClient, token: string, id: number) {
  return client.request<unknown>(`/api/campaigns/${id}/share`, token, {
    method: "POST",
  });
}

export async function revokeShareCode(client: ApiClient, token: string, id: number) {
  return client.request<unknown>(`/api/campaigns/${id}/share`, token, {
    method: "DELETE",
  });
}

export async function joinCampaign(client: ApiClient, token: string, shareCode: string) {
  return client.request<unknown>("/api/campaigns/join", token, {
    method: "POST",
    body: { shareCode },
  });
}

export async function leaveCampaign(client: ApiClient, token: string, id: number) {
  return client.request<unknown>(`/api/campaigns/${id}/leave`, token, {
    method: "DELETE",
  });
}

export async function listPlayers(client: ApiClient, token: string, id: number) {
  return client.request<unknown[]>(`/api/campaigns/${id}/players`, token);
}

export async function kickPlayer(
  client: ApiClient,
  token: string,
  campaignId: number,
  playerId: string,
) {
  return client.request<unknown>(`/api/campaigns/${campaignId}/players/${playerId}`, token, {
    method: "DELETE",
  });
}

export async function getPlayerView(client: ApiClient, token: string, id: number) {
  return client.request<unknown>(`/api/campaigns/${id}/player-view`, token);
}

export async function listCampaignCharacters(client: ApiClient, token: string, id: number) {
  return client.request<unknown[]>(`/api/campaigns/${id}/characters`, token);
}

export async function characterControl(
  client: ApiClient,
  token: string,
  campaignId: number,
  action: Record<string, unknown>,
) {
  return client.request<unknown>(`/api/campaigns/${campaignId}/characters/control`, token, {
    method: "POST",
    body: action,
  });
}

export async function listCampaignSessions(client: ApiClient, token: string, id: number) {
  return client.request<unknown[]>(`/api/campaigns/${id}/sessions`, token);
}

export async function createSession(
  client: ApiClient,
  token: string,
  campaignId: number,
  data: Record<string, unknown>,
) {
  return client.request<unknown>(`/api/campaigns/${campaignId}/sessions`, token, {
    method: "POST",
    body: data,
  });
}

// ─── Item box (förråd) ───────────────────────────────────────

export async function getCampaignBox(client: ApiClient, token: string, id: number) {
  return client.request<unknown[]>(`/api/campaigns/${id}/box`, token);
}

export async function campaignBoxAction(
  client: ApiClient,
  token: string,
  id: number,
  action: Record<string, unknown>,
) {
  return client.request<unknown>(`/api/campaigns/${id}/box`, token, {
    method: "POST",
    body: action,
  });
}
