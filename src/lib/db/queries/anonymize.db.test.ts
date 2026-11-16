import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

// L10: deleting an account anonymizes it (the owner 2026-11-15). The person goes,
// the email is free again, own campaigns and private characters go to the
// trash, characters in other people's campaigns stay without a name.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("account deletion by anonymizing (database)", async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db/client");
  const { sql, eq } = await import("drizzle-orm");
  const { users, accounts, loginHistory, campaigns, campaignPlayers, characters } = await import("@/lib/db/schema");
  const { anonymizeUser } = await import("./users");

  let release: () => Promise<void> = async () => {};

  beforeAll(async () => {
    const { lockTestDatabase } = await import("@/lib/db/test-database-lock");
    release = await lockTestDatabase(url);
  }, 120_000);
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
  });
  afterAll(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    await release();
  });

  it("removes the person, trashes what is theirs alone, keeps their character in another DM's game", async () => {
    const [{ id: dm }] = await db.insert(users).values({ name: "DM" }).returning({ id: users.id });
    const [{ id: me }] = await db
      .insert(users)
      .values({ name: "Mira Ek", username: "mira", email: "mira@example.invalid", oidcSub: "sub-1" })
      .returning({ id: users.id });
    await db.insert(accounts).values({ userId: me, type: "oidc", provider: "keycloak", providerAccountId: "sub-1" });
    await db.insert(loginHistory).values({ userId: me, ipAddress: "192.0.2.1", success: true, method: "keycloak" });

    const [{ id: theirs }] = await db.insert(campaigns).values({ userId: dm, name: "Theirs" }).returning({ id: campaigns.id });
    const [{ id: mine }] = await db.insert(campaigns).values({ userId: me, name: "Mine" }).returning({ id: campaigns.id });
    await db.insert(campaignPlayers).values({ campaignId: theirs, userId: me });
    const [{ id: inTheirs }] = await db.insert(characters).values({ userId: me, name: "Hero", data: {}, campaignId: theirs }).returning({ id: characters.id });
    const [{ id: priv }] = await db.insert(characters).values({ userId: me, name: "Solo", data: {} }).returning({ id: characters.id });

    await anonymizeUser(me);

    const [u] = await db.select().from(users).where(eq(users.id, me));
    expect([u.name, u.username, u.email, u.oidcSub]).toEqual([null, null, null, null]);
    expect(u.deletedAt).not.toBeNull();
    expect(await db.select().from(accounts).where(eq(accounts.userId, me))).toEqual([]);
    expect(await db.select().from(loginHistory).where(eq(loginHistory.userId, me))).toEqual([]);

    const [own] = await db.select().from(campaigns).where(eq(campaigns.id, mine));
    expect(own.deletedAt).not.toBeNull();
    const [hero] = await db.select().from(characters).where(eq(characters.id, inTheirs));
    expect([hero.campaignId, hero.deletedAt]).toEqual([theirs, null]);
    const [solo] = await db.select().from(characters).where(eq(characters.id, priv));
    expect(solo.deletedAt).not.toBeNull();
    expect((await db.select().from(campaignPlayers).where(eq(campaignPlayers.userId, me))).length).toBe(1);

    // The email is free for a new account.
    await db.insert(users).values({ name: "New", email: "mira@example.invalid" });
  });
});
