import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CodedHttpError, HttpError, parseBody, withApi } from "@/lib/api/route-helpers";
import { clientIp } from "@/lib/api/rate-limit";
import { passwordAuthEnabled } from "@/lib/auth/credentials";
import { hashPassword } from "@/lib/auth/password";
import { MAX_PASSWORD_LENGTH, validatePassword } from "@/lib/auth/password-policy";
import { passwordProblemError } from "@/lib/auth/password-error";
import { checkLimit, recordFailure } from "@/lib/auth/rate-limit";
import { createLocalUser } from "@/lib/db/queries/local-accounts";

// Registration for the self-hosted kit (AUTH_PASSWORD_ENABLED). The first
// account becomes the admin (decided in createLocalUser, under a lock).

const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  // Length is checked by the policy below, so the page gets a coded reason.
  password: z.string().max(MAX_PASSWORD_LENGTH * 2),
  name: z.string().trim().max(80).optional(),
});

export const POST = withApi(async (req: NextRequest): Promise<NextResponse> => {
  if (!passwordAuthEnabled()) throw new HttpError(404, "Not found");

  // Capped per address: creating accounts and probing taken addresses count;
  // a password that fails the rules does not (that is someone complying).
  const key = `register:${clientIp(req)}`;
  if (checkLimit(key).blocked) throw new CodedHttpError(429, "tooManyAttempts");

  const body = await parseBody(req, RegisterSchema);
  const problem = validatePassword(body.password, [body.email, body.name]);
  if (problem) throw passwordProblemError(problem);

  const created = await createLocalUser({ email: body.email, name: body.name || null, passwordHash: await hashPassword(body.password) });
  recordFailure(key);
  // A taken address is refused openly: a successful registration is visible
  // anyway, so hiding it would not stop enumeration (the cap above does).
  if (!created.ok) throw new CodedHttpError(409, "registrationFailed");
  return NextResponse.json({ ok: true }, { status: 201 });
});
