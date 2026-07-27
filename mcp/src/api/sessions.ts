import { ApiClient } from "./client.js";

export async function getSession(client: ApiClient, token: string, id: number) {
  return client.request<unknown>(`/api/sessions/${id}`, token);
}

export async function updateSession(
  client: ApiClient,
  token: string,
  id: number,
  data: Record<string, unknown>,
) {
  return client.request<unknown>(`/api/sessions/${id}`, token, {
    method: "PUT",
    body: data,
  });
}

export async function deleteSession(client: ApiClient, token: string, id: number) {
  return client.request<unknown>(`/api/sessions/${id}`, token, {
    method: "DELETE",
  });
}

export async function lockSession(client: ApiClient, token: string, id: number) {
  return client.request<unknown>(`/api/sessions/${id}/lock`, token, {
    method: "POST",
  });
}

export async function unlockSession(client: ApiClient, token: string, id: number) {
  return client.request<unknown>(`/api/sessions/${id}/lock`, token, {
    method: "DELETE",
  });
}
