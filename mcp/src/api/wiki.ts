import { ApiClient } from "./client.js";

export async function listBooks(client: ApiClient) {
  return client.request<unknown[]>("/api/wiki", "");
}

export async function searchWiki(
  client: ApiClient,
  query: string,
  options?: { bookId?: number; tag?: string; limit?: number },
) {
  const params = new URLSearchParams({ q: query });
  if (options?.bookId !== undefined) {
    params.set("bookId", String(options.bookId));
  }
  if (options?.tag) {
    params.set("tag", options.tag);
  }
  if (options?.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  return client.request<unknown[]>(`/api/wiki/search?${params.toString()}`, "");
}

export async function getTags(client: ApiClient) {
  return client.request<unknown[]>("/api/wiki/tags", "");
}

// En sidas fulla innehåll via id (publik endpoint). Sök returnerar bara metadata; detta hydrerar.
export async function getPage(client: ApiClient, id: number) {
  return client.request<Record<string, unknown>>(`/api/wiki/pages/${id}`, "");
}

// En bok som träd (kapitel + sidor). full=true → sidorna inkluderar brödtext.
export async function getBook(client: ApiClient, slug: string, full = false) {
  const q = full ? "?full=1" : "";
  return client.request<Record<string, unknown>>(
    `/api/wiki/books/${encodeURIComponent(slug)}${q}`,
    "",
  );
}

// En specifik sida (med content) via bok-slug + sid-slug.
export async function getPageBySlug(
  client: ApiClient,
  bookSlug: string,
  pageSlug: string,
) {
  return client.request<Record<string, unknown>>(
    `/api/wiki/books/${encodeURIComponent(bookSlug)}/pages/${encodeURIComponent(pageSlug)}`,
    "",
  );
}
