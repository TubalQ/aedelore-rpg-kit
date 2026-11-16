import { eq, and, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { gameSessions, campaigns } from "@/lib/db/schema";
import { SessionDataSchema } from "@/lib/schemas/session";
import { getStashMaps, hydrateSessionData, linkSessionPatch } from "@/lib/db/queries/stash";
import type { SessionData, SessionRow } from "@/lib/schemas/session";

function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 3; depth++) {
    if ((e as { code?: unknown }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

function toSessionRow(r: typeof gameSessions.$inferSelect): SessionRow {
  // Every field of SessionDataSchema is tolerant, so this only fails when the
  // stored value is not an object at all. Even then one session must not take
  // the campaign's whole session list down: log it and read it as empty.
  const parsed = SessionDataSchema.safeParse(r.data);
  if (!parsed.success) {
    console.error(`[sessions] session ${r.id} has unreadable data, served as empty`, parsed.error);
  }
  return {
    ...r,
    title: r.title ?? "",
    data: parsed.success ? parsed.data : SessionDataSchema.parse({}),
  };
}

/** Session rows with stash content overlaid on their items/equipment (one stash read per campaign). */
async function toHydratedRows(rows: (typeof gameSessions.$inferSelect)[]): Promise<SessionRow[]> {
  const maps = await getStashMaps(rows.map((r) => r.campaignId));
  return rows.map((r) => {
    const row = toSessionRow(r);
    const stash = maps.get(r.campaignId);
    return stash ? { ...row, data: hydrateSessionData(row.data, stash) } : row;
  });
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

  return toHydratedRows(rows);
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

  return rows[0] ? (await toHydratedRows([rows[0]]))[0] : null;
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

  const defaultData: SessionData = SessionDataSchema.parse({});

  // The number is computed inside the INSERT, and the partial unique index
  // (campaign_id, session_number) WHERE deleted_at IS NULL turns a concurrent
  // double-create into a unique violation, which is retried with the next number.
  let rows: Array<typeof gameSessions.$inferSelect> = [];
  for (let attempt = 0; attempt < 3 && rows.length === 0; attempt++) {
    try {
      rows = await db
        .insert(gameSessions)
        .values({
          campaignId,
          userId,
          sessionNumber: sql`(SELECT coalesce(max(${gameSessions.sessionNumber}), 0) + 1 FROM ${gameSessions} WHERE ${gameSessions.campaignId} = ${campaignId} AND ${gameSessions.deletedAt} IS NULL)`,
          title: input.title || "",
          date: input.date || null,
          location: input.location || null,
          gameLocation: input.gameLocation || null,
          data: defaultData as Record<string, unknown>,
        })
        .returning();
    } catch (err) {
      if (attempt === 2 || !isUniqueViolation(err)) throw err;
    }
  }

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
    /** Already validated with sanitizeDataPatch (see the PUT route). */
    data?: Record<string, unknown>;
  },
): Promise<SessionRow | null> {
  const setClause: Record<string, unknown> = { updatedAt: new Date() };

  if (updates.title !== undefined) setClause.title = updates.title;
  if (updates.date !== undefined) setClause.date = updates.date;
  if (updates.location !== undefined) setClause.location = updates.location;
  if (updates.gameLocation !== undefined) setClause.gameLocation = updates.gameLocation;

  // S12: the session row is read with FOR UPDATE inside the transaction, so a
  // lock cannot land between the check and the write. Before, the stash
  // write-through below committed even when the UPDATE then matched nothing
  // because the session had just been locked.
  const rows = await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(gameSessions)
      .where(
        and(
          eq(gameSessions.id, id),
          eq(gameSessions.userId, userId),
          isNull(gameSessions.deletedAt),
        ),
      )
      .for("update");
    if (!existing[0] || existing[0].status === "locked") return [];
    const campaignId = existing[0].campaignId;

    if (updates.data) {
      // Items/equipment are stash placements: link them (by id, name, or a new
      // stash entry) before storing, in the same transaction.
      const linked = await linkSessionPatch(tx, campaignId, updates.data, existing[0].data);
      setClause.data = sql`${gameSessions.data} || ${JSON.stringify(linked)}::jsonb`;
    }
    // The row is held FOR UPDATE; the conditions below are a second guard.
    const updated = await tx
      .update(gameSessions)
      .set(setClause)
      .where(
        and(
          eq(gameSessions.id, id),
          eq(gameSessions.userId, userId),
          isNull(gameSessions.deletedAt),
          ne(gameSessions.status, "locked"),
        ),
      )
      .returning();
    if (updated[0]) {
      await tx.update(campaigns).set({ updatedAt: new Date() }).where(eq(campaigns.id, campaignId));
    }
    return updated;
  });

  return rows[0] ? (await toHydratedRows([rows[0]]))[0] : null;
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

export async function softDeleteSession(id: number, userId: string): Promise<boolean | "locked"> {
  const existing = await db
    .select({ campaignId: gameSessions.campaignId, status: gameSessions.status })
    .from(gameSessions)
    .where(
      and(
        eq(gameSessions.id, id),
        eq(gameSessions.userId, userId),
        isNull(gameSessions.deletedAt),
      ),
    );

  if (existing.length === 0) return false;
  // A locked (finished) session is not deleted (S13): the list hides Delete for
  // it, but the API took the call. Unlock it first.
  if (existing[0].status === "locked") return "locked";

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(gameSessions).set({ deletedAt: now, updatedAt: now }).where(eq(gameSessions.id, id));
    await tx.update(campaigns).set({ updatedAt: now }).where(eq(campaigns.id, existing[0].campaignId));
  });

  return true;
}

/**
 * The user's sessions in the trash (L14): only those deleted on their own. A
 * session that went with its campaign comes back with the campaign; listing
 * it gave a Restore that always failed.
 */
export async function getDeletedSessions(userId: string) {
  return db
    .select()
    .from(gameSessions)
    .innerJoin(campaigns, eq(campaigns.id, gameSessions.campaignId))
    .where(and(eq(gameSessions.userId, userId), sql`${gameSessions.deletedAt} IS NOT NULL`, isNull(campaigns.deletedAt)))
    .then((rows) => rows.map((r) => ({ ...r.game_sessions, campaignName: r.campaigns.name })));
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

  // A new session may have taken this number while it sat in the trash; then
  // it comes back as the next free number instead of colliding.
  const live = sql`(SELECT 1 FROM ${gameSessions} g WHERE g.campaign_id = ${existing.campaignId} AND g.session_number = ${gameSessions.sessionNumber} AND g.deleted_at IS NULL AND g.id <> ${gameSessions.id})`;
  const nextFree = sql`(SELECT coalesce(max(g.session_number), 0) + 1 FROM ${gameSessions} g WHERE g.campaign_id = ${existing.campaignId} AND g.deleted_at IS NULL)`;
  const rows = await db
    .update(gameSessions)
    .set({
      deletedAt: null,
      updatedAt: new Date(),
      sessionNumber: sql`CASE WHEN EXISTS ${live} THEN ${nextFree} ELSE ${gameSessions.sessionNumber} END`,
    })
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
