import { ApiClient } from "./client.js";

export async function listCharacters(client: ApiClient, token: string) {
  return client.request<unknown[]>("/api/characters", token);
}

export async function getCharacter(client: ApiClient, token: string, id: number) {
  return client.request<unknown>(`/api/characters/${id}`, token);
}

export async function createCharacter(
  client: ApiClient,
  token: string,
  name: string,
  campaignId?: number,
) {
  const body: Record<string, unknown> = { name };
  if (campaignId !== undefined) {
    body.campaignId = campaignId;
  }
  return client.request<unknown>("/api/characters", token, {
    method: "POST",
    body,
  });
}

export async function updateCharacter(
  client: ApiClient,
  token: string,
  id: number,
  data: Record<string, unknown>,
) {
  return client.request<unknown>(`/api/characters/${id}`, token, {
    method: "PUT",
    body: data,
  });
}

export async function deleteCharacter(client: ApiClient, token: string, id: number) {
  return client.request<unknown>(`/api/characters/${id}`, token, {
    method: "DELETE",
  });
}

export async function lockCharacterStep(
  client: ApiClient,
  token: string,
  id: number,
  step: string,
  locked: boolean,
) {
  return client.request<unknown>(`/api/characters/${id}/lock`, token, {
    method: "POST",
    body: { step, locked },
  });
}

export async function spendXp(
  client: ApiClient,
  token: string,
  id: number,
  deltas: { attributes?: Record<string, number>; skills?: Record<string, number> },
) {
  // The endpoint (SpendXpSchema) takes per-field point DELTAS to add, keyed by
  // display name, e.g. { attributes: { Strength: 1 }, skills: { Athletics: 2 } }.
  return client.request<unknown>(`/api/characters/${id}/xp`, token, {
    method: "POST",
    body: deltas,
  });
}
