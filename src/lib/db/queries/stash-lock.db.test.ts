import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

// S12: a session locked while an edit or a stash placement is under way must
// not be written to, and the edit's stash write-through must not commit.
// S11: deleting a stash entry whose only placement sits in a trashed session.
// The restored session keeps its card, and the next save links it to a new
// entry.
//
// Same setup as give-items.db.test.ts: an empty throwaway database with the
// app's schema, skipped unless TEST_DATABASE_URL is set.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("stash and session locks (database)", async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db/client");
  const { sql, eq } = await import("drizzle-orm");
  const { users, campaigns, campaignItems, gameSessions } = await import("@/lib/db/schema");
  const stash = await import("./stash");
  const sessions = await import("./sessions");

  let dm: string;
  let campaignId: number;
  let sessionId: number;
  let letter: number;
  let release: () => Promise<void> = async () => {};

  const count = async () => {
    const [{ n }] = Array.from(await db.execute(sql`SELECT count(*)::int AS n FROM campaign_items`)) as { n: number }[];
    return n;
  };
  const sessionData = async () => {
    const [row] = await db.select({ data: gameSessions.data }).from(gameSessions).where(eq(gameSessions.id, sessionId));
    return row.data as { items?: { name: string; stashId?: number | null }[] };
  };

  // Locks the session in a transaction that stays open until the returned
  // function is called, so a concurrent edit has to wait for it.
  const lockInOpenTransaction = async (): Promise<() => Promise<void>> => {
    let commit: () => void = () => {};
    let locked: () => void = () => {};
    const isLocked = new Promise<void>((r) => (locked = r));
    const done = db.transaction(async (tx) => {
      await tx.update(gameSessions).set({ status: "locked" }).where(eq(gameSessions.id, sessionId));
      locked();
      await new Promise<void>((r) => (commit = r));
    });
    await isLocked;
    return async () => {
      commit();
      await done;
    };
  };

  beforeAll(async () => {
    const { lockTestDatabase } = await import("@/lib/db/test-database-lock");
    release = await lockTestDatabase(url);
    const [{ n }] = Array.from(await db.execute(sql`SELECT count(*)::int AS n FROM characters`)) as { n: number }[];
    if (n > 0) throw new Error("TEST_DATABASE_URL must point at an empty throwaway database");
  }, 120_000);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    [{ id: dm }] = await db.insert(users).values({ name: "DM" }).returning({ id: users.id });
    [{ id: campaignId }] = await db.insert(campaigns).values({ userId: dm, name: "Test" }).returning({ id: campaigns.id });
    [{ id: sessionId }] = await db
      .insert(gameSessions)
      .values({ campaignId, userId: dm, sessionNumber: 1, data: {} })
      .returning({ id: gameSessions.id });
    [{ id: letter }] = await db
      .insert(campaignItems)
      .values({ campaignId, kind: "quest", data: { name: "Brev", description: "Hertigen är förrädaren" } })
      .returning({ id: campaignItems.id });
  });

  afterAll(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    await release();
  });

  it("an edit that waits on a lock does not save, and creates no stash entry (S12)", async () => {
    const commitLock = await lockInOpenTransaction();
    const edit = sessions.updateSession(sessionId, dm, { data: { items: [{ name: "Karta", description: "" }] } });
    await new Promise((r) => setTimeout(r, 200));
    await commitLock();

    expect(await edit).toBeNull();
    expect(await count()).toBe(1);
    expect((await sessionData()).items ?? []).toHaveLength(0);
  });

  it("a placement racing a lock is refused (S12)", async () => {
    const commitLock = await lockInOpenTransaction();
    const place = stash.placeStashEntry(campaignId, letter, {
      sessionId,
      plannedLocation: "",
      day: null,
      time: null,
      notes: "",
    });
    await new Promise((r) => setTimeout(r, 200));
    await commitLock();

    // The read before the write may see the session unlocked; the write itself
    // must not land.
    expect(await place).toBe("locked");
    expect((await sessionData()).items ?? []).toHaveLength(0);
  });

  it("a card whose entry was deleted while its session was in the trash survives the restore (S11)", async () => {
    expect(
      await stash.placeStashEntry(campaignId, letter, { sessionId, plannedLocation: "", day: null, time: null, notes: "" }),
    ).toBe("placed");
    expect(await sessions.softDeleteSession(sessionId, dm)).toBe(true);
    expect(await stash.deleteStashEntry(campaignId, letter)).toBe("deleted");
    expect(await sessions.restoreSession(sessionId, dm)).toBeTruthy();

    const [restored] = (await sessionData()).items ?? [];
    expect(restored).toMatchObject({ name: "Brev", stashId: letter });

    // The next save gives the card a new entry with its own content.
    const saved = await sessions.updateSession(sessionId, dm, { data: { items: [restored] } });
    const card = (saved?.data as { items: { stashId: number }[] }).items[0];
    expect(card.stashId).not.toBe(letter);
    const [entry] = await db.select({ data: campaignItems.data }).from(campaignItems).where(eq(campaignItems.id, card.stashId));
    expect(entry.data).toMatchObject({ name: "Brev", description: "Hertigen är förrädaren" });
  });
});
