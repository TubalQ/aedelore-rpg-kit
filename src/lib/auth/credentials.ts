import { createHash } from "crypto";
import { burnVerificationTime, hashPassword, needsRehash, verifyPassword } from "@/lib/auth/password";
import { checkLimit, clearFailures, recordFailure } from "@/lib/auth/rate-limit";

// Email/password sign-in for the self-hosted kit. Off unless the operator sets
// AUTH_PASSWORD_ENABLED=true; the Aedelore deployment never does (OIDC only).

export function passwordAuthEnabled(): boolean {
  return process.env.AUTH_PASSWORD_ENABLED === "true";
}

/**
 * A short fingerprint of the stored hash, kept in the session token. A changed
 * or reset password changes it, which ends every other session at its next
 * request (the session check reads the user on every request).
 */
export function passwordFingerprint(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

export interface CredentialUser {
  id: string;
  email: string | null;
  name: string | null;
  passwordHash: string | null;
  deletedAt: Date | null;
}

export interface CredentialDeps {
  findUser: (email: string) => Promise<CredentialUser | null>;
  saveHash: (userId: string, hash: string) => Promise<void>;
  /** Failed attempts only; events.signIn logs the successful ones. */
  log: (userId: string | null, success: boolean, method: string) => Promise<void>;
}

/**
 * Checks an email and password. Returns the user on success, null otherwise,
 * the same way for an unknown address and a wrong password (and in the same
 * time), so the answer does not reveal which addresses have accounts.
 */
export async function authorizeCredentials(
  rawEmail: unknown,
  rawPassword: unknown,
  deps: CredentialDeps,
): Promise<{ id: string; email: string | null; name: string | null } | null> {
  const email = String(rawEmail ?? "").toLowerCase().trim();
  const password = String(rawPassword ?? "");
  if (!email || !password || password.length > 200) return null;

  const key = `login:${email}`;
  // Refuse a locked account before hashing: a refused attempt must not cost
  // ~200 ms of scrypt.
  if (checkLimit(key).blocked) {
    await deps.log(null, false, "credentials:locked");
    return null;
  }

  const user = await deps.findUser(email);
  if (!user?.passwordHash || user.deletedAt) {
    await burnVerificationTime(password);
    recordFailure(key);
    await deps.log(null, false, "credentials");
    return null;
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    recordFailure(key);
    await deps.log(user.id, false, "credentials");
    return null;
  }

  clearFailures(key);
  if (needsRehash(user.passwordHash)) await deps.saveHash(user.id, await hashPassword(password));
  // A successful sign-in is logged once, by events.signIn (as for OIDC).
  return { id: user.id, email: user.email, name: user.name };
}
