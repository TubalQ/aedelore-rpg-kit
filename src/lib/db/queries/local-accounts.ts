import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

// Email/password accounts (the self-hosted kit, AUTH_PASSWORD_ENABLED). The
// Aedelore deployment signs in through OIDC only and never calls these.

/** Any account (live) with this address, case-insensitively. */
export async function findUserByEmailInsensitive(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email.toLowerCase()}`, isNull(users.deletedAt)))
    .limit(1);
  return user ?? null;
}

// Serialises "is this the first account?" against concurrent registrations, so
// two people registering at the same moment on a fresh install cannot both
// become admin.
const FIRST_ADMIN_LOCK = 742_001;

export type CreateLocalUserResult = { ok: true; id: string; isAdmin: boolean } | { ok: false; reason: "emailTaken" };

/**
 * Creates a password account. The first live account on the instance becomes
 * the admin. The address is stored lower-cased; a clash with any live account
 * (also an OIDC one, compared case-insensitively) is refused.
 */
export async function createLocalUser(input: { email: string; name: string | null; passwordHash: string }): Promise<CreateLocalUserResult> {
  const email = input.email.toLowerCase();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${FIRST_ADMIN_LOCK})`);
    const [clash] = await tx
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (clash) return { ok: false, reason: "emailTaken" } as const;
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(isNull(users.deletedAt));
    const isAdmin = n === 0;
    const [created] = await tx
      .insert(users)
      .values({
        email,
        name: input.name,
        passwordHash: input.passwordHash,
        isAdmin,
        // Not set: nobody has proved they own this address.
        emailVerified: null,
      })
      .returning({ id: users.id });
    return { ok: true, id: created.id, isAdmin } as const;
  });
}

export async function updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}
