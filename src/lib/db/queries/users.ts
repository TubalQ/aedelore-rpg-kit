import { db } from "@/lib/db/client";
import { users, accounts, authSessions, loginHistory, frontendErrors, campaigns, campaignBans, characters } from "@/lib/db/schema";
import { eq, and, or, isNull, desc, inArray, sql } from "drizzle-orm";

export async function getUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);
  return user ?? null;
}

export async function getUserById(id: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
}

/**
 * Delete an account by anonymizing it (L10, the owner 2026-11-15). In one
 * transaction:
 * - the person is removed: name, username, email, avatar and the OIDC link
 *   go, so the email is free and signing in again with the same Keycloak
 *   login starts a fresh account; login history, auth sessions and frontend
 *   error rows tied to the user go too;
 * - the user's own campaigns go to the trash (a campaign without its DM is of
 *   no use to anyone), and their private characters with them;
 * - characters the user plays in other people's campaigns stay there, without
 *   a name on them, so the DM's game keeps its party.
 * The row itself stays (deletedAt set) so those characters keep an owner.
 */
export async function anonymizeUser(userId: string): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ name: null, username: null, email: null, emailVerified: null, image: null, passwordHash: null, oidcSub: null, isAdmin: false, deletedAt: now })
      .where(eq(users.id, userId));
    await tx.delete(accounts).where(eq(accounts.userId, userId));
    await tx.delete(authSessions).where(eq(authSessions.userId, userId));
    await tx.delete(loginHistory).where(eq(loginHistory.userId, userId));
    await tx.update(frontendErrors).set({ userId: null }).where(eq(frontendErrors.userId, userId));
    await tx.delete(campaignBans).where(eq(campaignBans.userId, userId));

    const owned = await tx
      .update(campaigns)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(campaigns.userId, userId), isNull(campaigns.deletedAt)))
      .returning({ id: campaigns.id });
    // Characters in no campaign, or in one of the user's own: to the trash.
    // Characters in someone else's live campaign stay where they are.
    await tx
      .update(characters)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(characters.userId, userId),
          isNull(characters.deletedAt),
          or(
            isNull(characters.campaignId),
            owned.length > 0 ? inArray(characters.campaignId, owned.map((c) => c.id)) : sql`false`,
            sql`exists (select 1 from ${campaigns} c where c.id = ${characters.campaignId} and c.deleted_at is not null)`,
          ),
        ),
      );
    // Membership goes only where no character of theirs remains.
    await tx.execute(sql`
      DELETE FROM campaign_players cp
      WHERE cp.user_id = ${userId}
        AND NOT EXISTS (
          SELECT 1 FROM characters ch
          WHERE ch.user_id = ${userId} AND ch.campaign_id = cp.campaign_id AND ch.deleted_at IS NULL
        )
    `);
  });
}

export async function isUserActive(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!user && user.deletedAt === null;
}

export async function logLogin(
  userId: string | null,
  ip: string | null,
  userAgent: string | null,
  success: boolean,
  method: string,
): Promise<void> {
  await db.insert(loginHistory).values({
    userId,
    ipAddress: ip,
    userAgent,
    success,
    method,
  });
}

export async function getLoginHistory(userId: string, limit = 20) {
  return db
    .select()
    .from(loginHistory)
    .where(eq(loginHistory.userId, userId))
    .orderBy(desc(loginHistory.createdAt))
    .limit(limit);
}
