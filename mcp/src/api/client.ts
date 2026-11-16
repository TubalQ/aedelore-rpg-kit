import { logger } from "../logger.js";

const RETRY_BASE_MS = 200;
const RETRY_MULTIPLIER = 4;
// Håll hela budgeten (timeout x försök + backoff) under typiska MCP-klienters
// verktygs-timeout, annars ger klienten upp medan servern fortfarande försöker.
const DEFAULT_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 10_000;
// App-fel kan vara hela HTML-sidor; verktygsfelet ska vara läsbart för modellen.
const MAX_ERROR_BODY = 500;

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
          const raw = await response.text();
          const responseText =
            raw.length > MAX_ERROR_BODY ? `${raw.slice(0, MAX_ERROR_BODY)}…` : raw;

          if (response.status >= 500 && attempt < maxRetries && idempotent) {
            lastError = new Error(`API ${response.status}: ${responseText}`);
            continue;
          }

          throw new Error(`API ${response.status}: ${responseText}`);
        }

        return (await response.json()) as T;
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
