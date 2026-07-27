import { db } from "@/lib/db/client";
import { users, loginHistory } from "@/lib/db/schema";
import { eq, and, isNull, desc, count } from "drizzle-orm";

export async function getUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);
  return user ?? null;
}

export async function countActiveUsers(): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(users)
    .where(isNull(users.deletedAt));
  return Number(row?.c ?? 0);
}

export async function createLocalUser(input: {
  email: string;
  name: string | null;
  passwordHash: string;
  isAdmin: boolean;
}) {
  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      isAdmin: input.isAdmin,
      emailVerified: new Date(),
    })
    .returning();
  return user;
}

export async function getUserById(id: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return user ?? null;
}

export async function softDeleteUser(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ deletedAt: new Date() })
    .where(eq(users.id, userId));
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
