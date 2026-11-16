import { ApiClient } from "./client.js";

// Verktygen skickar singular typ (character, campaign, session, wiki-book, …) men app-routerna
// är plural (/api/trash/characters/[id], …). Utan mappning 404:ar varje restore/permanent-delete.
const TRASH_TYPE_PATH: Record<string, string> = {
  character: "characters",
  campaign: "campaigns",
  session: "sessions",
  "wiki-book": "wiki-books",
  "wiki-chapter": "wiki-chapters",
  "wiki-page": "wiki-pages",
};

function trashPath(type: string): string {
  // Acceptera både singular (mappas) och redan-plural (passerar oförändrat).
  return TRASH_TYPE_PATH[type] ?? type;
}

export async function listTrash(client: ApiClient, token: string) {
  return client.request<unknown>("/api/trash", token);
}

export async function restoreItem(client: ApiClient, token: string, type: string, id: number) {
  return client.request<unknown>(`/api/trash/${trashPath(type)}/${id}`, token, {
    method: "POST",
  });
}

export async function permanentDelete(client: ApiClient, token: string, type: string, id: number) {
  return client.request<unknown>(`/api/trash/${trashPath(type)}/${id}`, token, {
    method: "DELETE",
  });
}
