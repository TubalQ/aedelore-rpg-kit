import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiAuth } from "@/lib/auth/api-auth";
import { apiErrorBody, type ApiErrorCode, type ApiErrorParams } from "@/lib/api/error-codes";

// ---------------------------------------------------------------------------
// Shared building blocks for API routes (rule 6: auth -> validate -> DB).
//
// withApi wraps a handler so every failure becomes a structured JSON error
// `{ error, details? }`: HttpError keeps its status, malformed JSON is 400,
// Postgres unique violations are 409, invalid input values are 400, and
// anything else is logged and returned as 500. Handlers can therefore throw
// instead of hand-building every error response.
// ---------------------------------------------------------------------------

import { CodedHttpError, HttpError } from "@/lib/api/http-error";
export { CodedHttpError, HttpError };

/** A JSON error response with a code: `{ error, code, params? }`. */
export function codedError(status: number, code: ApiErrorCode, params?: ApiErrorParams): NextResponse {
  return NextResponse.json(apiErrorBody(code, params), { status });
}

/** Postgres int4 id from a route segment. Rejects NaN, fractions, 0x10, overflow. */
export const IdSchema = z.coerce.number().int().positive().max(2_147_483_647);

export function parseId(raw: string, label = "id"): number {
  if (!/^\d+$/.test(raw)) throw new HttpError(400, `Invalid ${label}`);
  const parsed = IdSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, `Invalid ${label}`);
  return parsed.data;
}

export async function readJson(req: NextRequest | Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Malformed JSON body");
  }
}

/** JSON body that must be an object (400 otherwise). */
export async function readJsonObject(req: NextRequest | Request): Promise<Record<string, unknown>> {
  const body = await readJson(req);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Expected a JSON object");
  }
  return body as Record<string, unknown>;
}

export async function parseBody<T extends z.ZodType>(
  req: NextRequest | Request,
  schema: T,
): Promise<z.output<T>> {
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) {
    throw new HttpError(400, "Validation failed", z.flattenError(parsed.error));
  }
  return parsed.data;
}

function postgresCode(err: unknown): string | undefined {
  // drizzle wraps driver errors in DrizzleQueryError with the PostgresError as cause.
  for (let e: unknown = err, depth = 0; e && depth < 3; depth++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

export function errorResponse(err: unknown, where: string): NextResponse {
  if (err instanceof CodedHttpError) {
    return NextResponse.json(apiErrorBody(err.code, err.params), { status: err.status });
  }
  if (err instanceof HttpError) {
    return NextResponse.json(
      err.details === undefined ? { error: err.message } : { error: err.message, details: err.details },
      { status: err.status },
    );
  }
  const code = postgresCode(err);
  if (code === "23505") {
    return NextResponse.json({ error: "Already exists: something live already uses that name or address" }, { status: 409 });
  }
  if (code === "22P02" || code === "22003") {
    return NextResponse.json({ error: "Invalid value" }, { status: 400 });
  }
  console.error(`[api] ${where} failed`, err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function withApi<C, R extends Response>(
  handler: (req: NextRequest, ctx: C) => Promise<R>,
): (req: NextRequest, ctx: C) => Promise<R | NextResponse> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return errorResponse(err, `${req.method} ${req.nextUrl.pathname}`);
    }
  };
}

export interface ApiUser {
  id: string;
  isAdmin: boolean;
}

/** Session user from the cookie session or an MCP bearer token, else 401. */
export async function requireApiUser(): Promise<ApiUser> {
  const session = await apiAuth();
  const user = session?.user;
  if (!user?.id) throw new HttpError(401, "Unauthorized");
  return { id: user.id, isAdmin: user.isAdmin === true };
}
