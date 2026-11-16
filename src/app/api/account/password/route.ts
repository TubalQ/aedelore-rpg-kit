import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CodedHttpError, parseBody, requireApiUser, withApi } from "@/lib/api/route-helpers";
import { passwordAuthEnabled } from "@/lib/auth/credentials";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { MAX_PASSWORD_LENGTH, validatePassword } from "@/lib/auth/password-policy";
import { passwordProblemError } from "@/lib/auth/password-error";
import { checkLimit, clearFailures, recordFailure } from "@/lib/auth/rate-limit";
import { updatePasswordHash } from "@/lib/db/queries/local-accounts";
import { getUserById } from "@/lib/db/queries/users";

// Change your own password (email/password accounts, self-hosted kit). The new
// hash changes the session fingerprint, so every session ends; the page signs
// in again with the new password.

/** Whether the signed-in account has a password to change. */
export const GET = withApi(async (): Promise<NextResponse> => {
  const user = await requireApiUser();
  const row = await getUserById(user.id);
  return NextResponse.json({ hasPassword: passwordAuthEnabled() && !!row?.passwordHash });
});

const ChangeSchema = z.object({
  current: z.string().max(MAX_PASSWORD_LENGTH * 2),
  next: z.string().max(MAX_PASSWORD_LENGTH * 2),
});

export const PUT = withApi(async (req: NextRequest): Promise<NextResponse> => {
  const user = await requireApiUser();
  const row = await getUserById(user.id);
  if (!passwordAuthEnabled() || !row?.passwordHash) throw new CodedHttpError(400, "wrongCurrentPassword");

  const key = `login:${(row.email ?? "").toLowerCase()}`;
  if (checkLimit(key).blocked) throw new CodedHttpError(429, "tooManyAttempts");

  const body = await parseBody(req, ChangeSchema);
  if (!(await verifyPassword(body.current, row.passwordHash))) {
    recordFailure(key);
    throw new CodedHttpError(400, "wrongCurrentPassword");
  }
  const problem = validatePassword(body.next, [row.email, row.name]);
  if (problem) throw passwordProblemError(problem);
  clearFailures(key);
  await updatePasswordHash(row.id, await hashPassword(body.next));
  return NextResponse.json({ ok: true });
});
