import { logger } from "../logger.js";

const RETRY_BASE_MS = 200;
const RETRY_MULTIPLIER = 4;
const DEFAULT_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30_000;

function camelToSnake(s: string): string {
  return s.replace(/([A-Z])/g, "_$1").toLowerCase();
}
function snakeToCamel(s: string): string {
  return s.replace(/_([a-zA-Z0-9])/g, (_m, c: string) => c.toUpperCase());
}

// Exponera varje objekt-nyckel i BÅDE camelCase och snake_case. App-API:t returnerar camelCase
// (Drizzle .select()), men många verktyg läser snake_case → undefined (falska lås-status,
// "Session #undefined", saknade namn/roller). Detta central-lager gör att alla verktygsläsningar
// resolvar oavsett konvention, utan att röra varje verktyg. Rekursivt genom arrays/objekt;
// primitiver (inkl. content-strängar) returneras oförändrade.
function normalizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeKeys);
  if (value && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) {
      const nv = normalizeKeys(v);
      out[k] = nv;
      const snake = camelToSnake(k);
      if (snake !== k && !(snake in src)) out[snake] = nv;
      const camel = snakeToCamel(k);
      if (camel !== k && !(camel in src)) out[camel] = nv;
    }
    return out;
  }
  return value;
}

export class ApiClient {
  constructor(private baseUrl: string) {}

  async request<T>(
    path: string,
    token: string,
    options?: {
      method?: string;
      body?: unknown;
      retries?: number;
      timeout?: number;
    },
  ): Promise<T> {
    const method = options?.method ?? "GET";
    const maxRetries = options?.retries ?? DEFAULT_RETRIES;
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
    // Retria bara idempotenta anrop. En timeout/5xx EFTER att servern committat en POST/PUT
    // skulle annars ge dubbelskrivningar (dubbla create_campaign, give_xp, import_content …).
    const idempotent = method === "GET";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const requestInit: RequestInit = {
      method,
      headers,
    };
    if (options?.body !== undefined) {
      requestInit.body = JSON.stringify(options.body);
    }

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const delayMs = RETRY_BASE_MS * Math.pow(RETRY_MULTIPLIER, attempt - 1);
        logger.debug({ attempt, delayMs, path }, "Retrying API request");
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...requestInit,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.status === 204) {
          return null as T;
        }

        if (!response.ok) {
          const responseText = await response.text();

          if (response.status >= 500 && attempt < maxRetries && idempotent) {
            lastError = new Error(`API ${response.status}: ${responseText}`);
            continue;
          }

          throw new Error(`API ${response.status}: ${responseText}`);
        }

        return normalizeKeys(await response.json()) as T;
      } catch (error: unknown) {
        clearTimeout(timer);

        if (error instanceof Error && error.message.startsWith("API 4")) {
          throw error;
        }

        lastError = error;

        if (attempt < maxRetries && idempotent) {
          continue;
        }

        throw lastError;
      }
    }

    throw lastError;
  }
}
