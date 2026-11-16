import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

// Fynd 4 and L1: a campaign in the trash holds no characters (the owner
// 2026-11-15). The player can leave it, join another campaign and unlock steps;
// restoring the campaign brings back the characters that still point at it.
// L4: a restored character never gives a player two characters in a campaign.
//
// Same setup as give-items.db.test.ts: an empty throwaway database with the
// app's schema, skipped unless TEST_DATABASE_URL is set.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("campaigns in the trash and the characters in them (database)", async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db/client");
  const { sql, eq } = await import("drizzle-orm");
  const { users, campaigns, campaignPlayers, characters } = await import("@/lib/db/schema");
  const chars = await import("./characters");
  const camps = await import("./campaigns");

  let dm: string;
  let player: string;
  let oldCampaign: number;
  let newCampaign: number;
  let arvid: number;
  let release: () => Promise<void> = async () => {};

  const storedCampaignOf = async (id: number) => {
    const [row] = await db.select({ campaignId: characters.campaignId }).from(characters).where(eq(characters.id, id));
    return row.campaignId;
  };

  beforeAll(async () => {
    const { lockTestDatabase } = await import("@/lib/db/test-database-lock");
    release = await lockTestDatabase(url);
    const [{ n }] = Array.from(await db.execute(sql`SELECT count(*)::int AS n FROM characters`)) as { n: number }[];
    if (n > 0) throw new Error("TEST_DATABASE_URL must point at an empty throwaway database");
  }, 120_000);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    [{ id: dm }, { id: player }] = await db.insert(users).values([{ name: "DM" }, { name: "Player" }]).returning({ id: users.id });
    [{ id: oldCampaign }, { id: newCampaign }] = await db
      .insert(campaigns)
      .values([
        { userId: dm, name: "Old", shareCode: "OLD12345" },
        { userId: dm, name: "New", shareCode: "NEW12345" },
      ])
      .returning({ id: campaigns.id });
    await db.insert(campaignPlayers).values({ campaignId: oldCampaign, userId: player });
    [{ id: arvid }] = await db
      .insert(characters)
      .values({ userId: player, campaignId: oldCampaign, name: "Arvid", data: {}, attributesLocked: true })
      .returning({ id: characters.id });
  });

  afterAll(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    await release();
  });

  it("a character in a trashed campaign reads as free to its player", async () => {
    await camps.softDeleteCampaign(oldCampaign, dm);
    expect((await chars.getCharacterById(arvid, player))?.campaignId).toBeNull();
    const listed = await chars.getCharactersByUser(player);
    expect(listed.map((c) => [c.name, c.campaignId, c.campaignName])).toEqual([["Arvid", null, null]]);
    // The stored link stays, so a restore can bring the character back.
    expect(await storedCampaignOf(arvid)).toBe(oldCampaign);
  });

  it("the player can join another campaign with it", async () => {
    await camps.softDeleteCampaign(oldCampaign, dm);
    const joined = await camps.joinCampaign("NEW12345", player, arvid);
    expect(joined).toEqual({ campaignId: newCampaign, campaignName: "New" });
    expect(await storedCampaignOf(arvid)).toBe(newCampaign);
  });

  it("while the campaign is live, joining another with the character is still refused", async () => {
    const joined = await camps.joinCampaign("NEW12345", player, arvid);
    expect(joined).toEqual({ code: "characterUnavailable" });
    expect(await storedCampaignOf(arvid)).toBe(oldCampaign);
  });

  it("restoring the campaign brings back the characters that stayed", async () => {
    await camps.softDeleteCampaign(oldCampaign, dm);
    await camps.restoreCampaign(oldCampaign, dm);
    expect((await chars.getCharacterById(arvid, player))?.campaignId).toBe(oldCampaign);
  });

  it("L4: a restored character comes back outside the campaign when its player has another one there", async () => {
    await chars.softDeleteCharacter(arvid, player);
    const [{ id: bodil }] = await db
      .insert(characters)
      .values({ userId: player, name: "Bodil", data: {} })
      .returning({ id: characters.id });
    const attached = await chars.updateCharacter(bodil, player, { campaignId: oldCampaign });
    expect(attached.ok).toBe(true);

    const restored = await chars.restoreCharacter(arvid, player);
    expect(restored?.detachedFromCampaign).toBe(true);
    expect(await storedCampaignOf(arvid)).toBeNull();
    expect(await storedCampaignOf(bodil)).toBe(oldCampaign);
  });

  it("a member whose character left can join again with a new one", async () => {
    await camps.softDeleteCampaign(oldCampaign, dm);
    await camps.joinCampaign("NEW12345", player, arvid);
    await camps.restoreCampaign(oldCampaign, dm);
    const [{ id: bodil }] = await db.insert(characters).values({ userId: player, name: "Bodil", data: {} }).returning({ id: characters.id });
    expect(await camps.joinCampaign("OLD12345", player, bodil)).toEqual({ campaignId: oldCampaign, campaignName: "Old" });
    expect(await storedCampaignOf(bodil)).toBe(oldCampaign);
  });

  it("a player cannot bring a second character into a campaign, by join or by attaching", async () => {
    const [{ id: bodil }] = await db.insert(characters).values({ userId: player, name: "Bodil", data: {} }).returning({ id: characters.id });
    expect(await camps.joinCampaign("OLD12345", player, bodil)).toEqual({ code: "onePerCampaign" });
    const attached = await chars.updateCharacter(bodil, player, { campaignId: oldCampaign });
    expect(attached).toEqual({ ok: false, reason: "one_per_campaign" });
    expect(await storedCampaignOf(bodil)).toBeNull();
  });

  it("saves and locks answer with the campaign as GET reads it", async () => {
    await camps.softDeleteCampaign(oldCampaign, dm);
    const saved = await chars.updateCharacter(arvid, player, { name: "Arvid" });
    expect(saved.ok && saved.character.campaignId).toBeNull();
    const locked = await chars.lockCharacterStep(arvid, player, "abilities", true);
    expect(locked?.campaignId).toBeNull();
  });
});
