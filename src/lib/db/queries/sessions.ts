import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { gameSessions, campaigns } from "@/lib/db/schema";
import { SessionDataSchema } from "@/lib/schemas/session";
import type { SessionData, SessionRow } from "@/lib/schemas/session";

function toSessionRow(r: typeof gameSessions.$inferSelect): SessionRow {
  return {
    ...r,
    title: r.title ?? "",
    data: SessionDataSchema.parse(r.data),
  };
}

export async function getSessionsByCampaign(
  campaignId: number,
  userId: string,
): Promise<SessionRow[]> {
  const campaign = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.id, campaignId),
        eq(campaigns.userId, userId),
        isNull(campaigns.deletedAt),
      ),
    );

  if (campaign.length === 0) return [];

  const rows = await db
    .select()
    .from(gameSessions)
    .where(
      and(
        eq(gameSessions.campaignId, campaignId),
        isNull(gameSessions.deletedAt),
      ),
    )
    .orderBy(gameSessions.sessionNumber);

  return rows.map(toSessionRow);
}

export async function getSessionById(
  id: number,
  userId: string,
): Promise<SessionRow | null> {
  const rows = await db
    .select()
    .from(gameSessions)
    .where(
      and(
        eq(gameSessions.id, id),
        eq(gameSessions.userId, userId),
        isNull(gameSessions.deletedAt),
      ),
    );

  return rows[0] ? toSessionRow(rows[0]) : null;
}

export async function createSession(
  userId: string,
  campaignId: number,
  input: { title?: string; date?: string; location?: string; gameLocation?: string },
): Promise<SessionRow | null> {
  const campaign = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.id, campaignId),
        eq(campaigns.userId, userId),
        isNull(campaigns.deletedAt),
      ),
    );

  if (campaign.length === 0) return null;

  const lastSession = await db.execute(sql`
    SELECT MAX(session_number) AS max_num
    FROM game_sessions
    WHERE campaign_id = ${campaignId} AND deleted_at IS NULL
  `);
  const nextNumber = (Number(lastSession[0]?.max_num) || 0) + 1;

  const defaultData: SessionData = SessionDataSchema.parse({});

  const rows = await db
    .insert(gameSessions)
    .values({
      campaignId,
      userId,
      sessionNumber: nextNumber,
      title: input.title || "",
      date: input.date || null,
      location: input.location || null,
      gameLocation: input.gameLocation || null,
      data: defaultData as Record<string, unknown>,
    })
    .returning();

  await db
    .update(campaigns)
    .set({ updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));

  return rows[0] ? toSessionRow(rows[0]) : null;
}

export async function updateSession(
  id: number,
  userId: string,
  updates: {
    title?: string;
    date?: string;
    location?: string;
    gameLocation?: string;
    data?: Partial<SessionData>;
  },
): Promise<SessionRow | null> {
  const existing = await db
    .select()
    .from(gameSessions)
    .where(
      and(
        eq(gameSessions.id, id),
        eq(gameSessions.userId, userId),
        isNull(gameSessions.deletedAt),
      ),
    );

  if (!existing[0]) return null;
  if (existing[0].status === "locked") return null;

  const setClause: Record<string, unknown> = { updatedAt: new Date() };

  if (updates.title !== undefined) setClause.title = updates.title;
  if (updates.date !== undefined) setClause.date = updates.date;
  if (updates.location !== undefined) setClause.location = updates.location;
  if (updates.gameLocation !== undefined) setClause.gameLocation = updates.gameLocation;
  if (updates.data) {
    setClause.data = sql`${gameSessions.data} || ${JSON.stringify(updates.data)}::jsonb`;
  }

  const rows = await db
    .update(gameSessions)
    .set(setClause)
    .where(
      and(
        eq(gameSessions.id, id),
        eq(gameSessions.userId, userId),
        isNull(gameSessions.deletedAt),
      ),
    )
    .returning();

  if (rows[0]) {
    await db
      .update(campaigns)
      .set({ updatedAt: new Date() })
      .where(eq(campaigns.id, existing[0].campaignId));
  }

  return rows[0] ? toSessionRow(rows[0]) : null;
}

export async function lockSession(id: number, userId: string): Promise<boolean> {
  const rows = await db
    .update(gameSessions)
    .set({ status: "locked", updatedAt: new Date() })
    .where(
      and(
        eq(gameSessions.id, id),
        eq(gameSessions.userId, userId),
        isNull(gameSessions.deletedAt),
      ),
    )
    .returning();
  return rows.length > 0;
}

export async function unlockSession(id: number, userId: string): Promise<boolean> {
  const rows = await db
    .update(gameSessions)
    .set({ status: "active", updatedAt: new Date() })
    .where(
      and(
        eq(gameSessions.id, id),
        eq(gameSessions.userId, userId),
        isNull(gameSessions.deletedAt),
      ),
    )
    .returning();
  return rows.length > 0;
}

export async function softDeleteSession(id: number, userId: string): Promise<boolean> {
  const existing = await db
    .select({ campaignId: gameSessions.campaignId })
    .from(gameSessions)
    .where(
      and(
        eq(gameSessions.id, id),
        eq(gameSessions.userId, userId),
        isNull(gameSessions.deletedAt),
      ),
    );

  if (existing.length === 0) return false;

  const now = new Date();
  await db
    .update(gameSessions)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(gameSessions.id, id));

  await db
    .update(campaigns)
    .set({ updatedAt: now })
    .where(eq(campaigns.id, existing[0].campaignId));

  return true;
}

export async function getDeletedSessions(userId: string) {
  return db
    .select()
    .from(gameSessions)
    .where(and(eq(gameSessions.userId, userId), sql`${gameSessions.deletedAt} IS NOT NULL`));
}

export async function restoreSession(id: number, userId: string) {
  const [existing] = await db
    .select({ campaignId: gameSessions.campaignId })
    .from(gameSessions)
    .where(
      and(
        eq(gameSessions.id, id),
        eq(gameSessions.userId, userId),
        sql`${gameSessions.deletedAt} IS NOT NULL`,
      ),
    );
  if (!existing) return null;

  // Don't restore a session whose campaign is still deleted - it would be live
  // but unreachable (session queries join on a non-deleted campaign), and the
  // campaign's cascade-restore wouldn't re-cover it. Restore the campaign first.
  const [campaign] = await db
    .select({ deletedAt: campaigns.deletedAt })
    .from(campaigns)
    .where(eq(campaigns.id, existing.campaignId));
  if (campaign?.deletedAt) return null;

  const rows = await db
    .update(gameSessions)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(gameSessions.id, id),
        eq(gameSessions.userId, userId),
        sql`${gameSessions.deletedAt} IS NOT NULL`,
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function permanentDeleteSession(id: number, userId: string) {
  const rows = await db
    .delete(gameSessions)
    .where(
      and(
        eq(gameSessions.id, id),
        eq(gameSessions.userId, userId),
        sql`${gameSessions.deletedAt} IS NOT NULL`,
      ),
    )
    .returning();
  return rows[0] ?? null;
}
