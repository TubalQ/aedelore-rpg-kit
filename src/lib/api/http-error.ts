import { apiErrorBody, type ApiErrorCode, type ApiErrorParams } from "@/lib/api/error-codes";

/**
 * An error with an HTTP status, turned into `{ error, details? }` by withApi
 * (route-helpers.ts). Its own module so the query layer can throw it without
 * importing the route helpers (and with them next-auth).
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** An HttpError the page can show in the player's language (error-codes.ts). */
export class CodedHttpError extends HttpError {
  constructor(
    status: number,
    public readonly code: ApiErrorCode,
    public readonly params?: ApiErrorParams,
  ) {
    super(status, apiErrorBody(code, params).error);
    this.name = "CodedHttpError";
  }
}
