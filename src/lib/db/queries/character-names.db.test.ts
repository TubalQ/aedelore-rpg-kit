import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// L7: a character's name is its key in the campaign (on purpose: coming back
// with the same name gets the shared content back), so two live characters in
// one campaign must never share a name. Every way into a campaign is checked,
// and the database index stops what the checks cannot see.
//
// Same setup as the other *.db.test.ts, plus the index from
// deploy/sql/20261111-characters-campaign-name.sql.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("character names in a campaign (database)", async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db/client");
  const { sql, eq } = await import("drizzle-orm");
  const { users, campaigns, campaignPlayers, characters } = await import("@/lib/db/schema");
  const chars = await import("./characters");
  const camps = await import("./campaigns");
  const { isCampaignNameConflict } = await import("./character-names");

  let release: () => Promise<void> = async () => {};
  let dm: string;
  let p1: string;
  let p2: string;
  let campaignId: number;
  let otherCampaign: number;
  let mira: number;

  beforeAll(async () => {
    // Other *.db.test.ts files empty the same tables: take turns.
    const { lockTestDatabase } = await import("@/lib/db/test-database-lock");
    release = await lockTestDatabase(url);
    const [{ count }] = Array.from(await db.execute(sql`SELECT count(*)::int AS count FROM characters`)) as { count: number }[];
    if (count > 0) throw new Error("TEST_DATABASE_URL must point at an empty throwaway database");
    const [{ exists }] = Array.from(await db.execute(sql`SELECT to_regclass('idx_characters_campaign_name_live') IS NOT NULL AS exists`)) as { exists: boolean }[];
    if (!exists) throw new Error("Run deploy/sql/20261111-characters-campaign-name.sql against the test database first");
  }, 120_000);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, campaign_players, characters RESTART IDENTITY CASCADE`);
    [{ id: dm }, { id: p1 }, { id: p2 }] = await db.insert(users).values([{ name: "DM" }, { name: "P1" }, { name: "P2" }]).returning({ id: users.id });
    [{ id: campaignId }, { id: otherCampaign }] = await db
      .insert(campaigns)
      .values([{ userId: dm, name: "Test", shareCode: "JOIN0001" }, { userId: dm, name: "Other" }])
      .returning({ id: campaigns.id });
    await db.insert(campaignPlayers).values([{ campaignId, userId: p1 }, { campaignId, userId: p2 }, { campaignId: otherCampaign, userId: p2 }]);
    [{ id: mira }] = await db.insert(characters).values({ userId: p1, campaignId, name: "Mira", data: {} }).returning({ id: characters.id });
  });

  afterAll(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, campaign_players, characters RESTART IDENTITY CASCADE`);
    await release();
  });

  it("a new character cannot take a name already in the campaign, in any case or spacing", async () => {
    for (const name of ["Mira", "mira", " MIRA "]) {
      expect(await chars.createCharacter(p2, name, campaignId), name).toBe("name_taken");
    }
    // The same name elsewhere, or outside any campaign, is fine.
    expect(await chars.createCharacter(p2, "Mira", otherCampaign)).toMatchObject({ name: "Mira" });
    expect(await chars.createCharacter(p2, "Mira", null)).toMatchObject({ name: "Mira" });
  });

  it("a character cannot enter the campaign, or be renamed in it, onto a taken name", async () => {
    const [{ id: loose }] = await db.insert(characters).values({ userId: p2, campaignId: null, name: "mira", data: {} }).returning({ id: characters.id });
    expect(await chars.updateCharacter(loose, p2, { campaignId })).toEqual({ ok: false, reason: "name_taken", name: "mira" });

    const [{ id: bo }] = await db.insert(characters).values({ userId: p2, campaignId, name: "Bo", data: {} }).returning({ id: characters.id });
    expect(await chars.updateCharacter(bo, p2, { name: "Mira" })).toEqual({ ok: false, reason: "name_taken", name: "Mira" });
    // Its own name, written differently, is not taken by itself.
    expect(await chars.updateCharacter(mira, p1, { name: "MIRA" })).toMatchObject({ ok: true });
  });

  it("joining with a character whose name is taken says so and leaves nothing half done", async () => {
    const [{ id: newcomer }] = await db.insert(users).values({ name: "P3" }).returning({ id: users.id });
    const [{ id: twin }] = await db.insert(characters).values({ userId: newcomer, campaignId: null, name: "Mira", data: {} }).returning({ id: characters.id });
    expect(await camps.joinCampaign("JOIN0001", newcomer, twin)).toEqual({ code: "nameTaken", params: { name: "Mira" } });
    const memberships = await db.select().from(campaignPlayers).where(eq(campaignPlayers.userId, newcomer));
    expect(memberships).toEqual([]);
    const [row] = await db.select({ campaignId: characters.campaignId }).from(characters).where(eq(characters.id, twin));
    expect(row.campaignId).toBeNull();
  });

  it("someone who stopped playing can come back under the same name", async () => {
    await chars.softDeleteCharacter(mira, p1);
    const again = await chars.createCharacter(p1, "Mira", campaignId);
    expect(again).toMatchObject({ name: "Mira", campaignId });
  });

  it("restoring a character whose name was taken meanwhile brings it back outside the campaign", async () => {
    await chars.softDeleteCharacter(mira, p1);
    await chars.createCharacter(p2, "Mira", campaignId);
    const restored = await chars.restoreCharacter(mira, p1);
    expect(restored).toMatchObject({ id: mira, campaignId: null, deletedAt: null, detachedFromCampaign: true });
  });

  it("restoring a character whose name is still free keeps it in the campaign", async () => {
    await chars.softDeleteCharacter(mira, p1);
    expect(await chars.restoreCharacter(mira, p1)).toMatchObject({ id: mira, campaignId, detachedFromCampaign: false });
  });

  it("the database refuses a second live name even when the checks are bypassed", async () => {
    let caught: unknown = null;
    try {
      await db.insert(characters).values({ userId: p2, campaignId, name: " mira", data: {} });
    } catch (err) {
      caught = err;
    }
    expect(isCampaignNameConflict(caught)).toBe(true);
    // A trashed one with the name does not count.
    await chars.softDeleteCharacter(mira, p1);
    await expect(db.insert(characters).values({ userId: p2, campaignId, name: "Mira", data: {} })).resolves.toBeDefined();
  });
});
