import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

// L13: changes to who is in a campaign run one at a time under the campaign
// row lock, and two share-code clicks at once give the same code.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("membership changes do not interleave (database)", async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db/client");
  const { sql, eq } = await import("drizzle-orm");
  const { users, campaigns, campaignPlayers, characters } = await import("@/lib/db/schema");
  const camps = await import("./campaigns");
  const chars = await import("./characters");
  let release: () => Promise<void> = async () => {};
  let dm: string;
  let player: string;
  let campaignId: number;

  beforeAll(async () => {
    const { lockTestDatabase } = await import("@/lib/db/test-database-lock");
    release = await lockTestDatabase(url);
  }, 120_000);
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    [{ id: dm }] = await db.insert(users).values({ name: "DM" }).returning({ id: users.id });
    [{ id: player }] = await db.insert(users).values({ name: "P" }).returning({ id: users.id });
    [{ id: campaignId }] = await db.insert(campaigns).values({ userId: dm, name: "C" }).returning({ id: campaigns.id });
  });
  afterAll(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    await release();
  });

  it("gives the same code to two clicks at once", async () => {
    const [a, b] = await Promise.all([camps.generateShareCode(campaignId, dm), camps.generateShareCode(campaignId, dm)]);
    expect(a).toBe(b);
    const [row] = await db.select({ code: campaigns.shareCode }).from(campaigns).where(eq(campaigns.id, campaignId));
    expect(row.code).toBe(a);
  });

  it("a join racing a revoke never leaves the player in", async () => {
    for (let i = 0; i < 5; i++) {
      await db.delete(campaignPlayers);
      const code = await camps.generateShareCode(campaignId, dm);
      await Promise.all([camps.joinCampaign(code!, player), camps.revokeShareCode(campaignId, dm)]);
      const [{ code: after }] = await db.select({ code: campaigns.shareCode }).from(campaigns).where(eq(campaigns.id, campaignId));
      const members = await db.select().from(campaignPlayers).where(eq(campaignPlayers.campaignId, campaignId));
      // Revoked last: no code and nobody in. (If the join ran last it found no code.)
      expect(after).toBeNull();
      expect(members).toEqual([]);
    }
  });

  it("a character cannot enter a campaign its player just left", async () => {
    await db.insert(campaignPlayers).values({ campaignId, userId: player });
    const [{ id: ch }] = await db.insert(characters).values({ userId: player, name: "H", data: {} }).returning({ id: characters.id });
    await camps.leaveCampaign(campaignId, player);
    const out = await chars.updateCharacter(ch, player, { campaignId });
    expect(out.ok).toBe(false);
    const [row] = await db.select({ c: characters.campaignId }).from(characters).where(eq(characters.id, ch));
    expect(row.c).toBeNull();
  });
});
