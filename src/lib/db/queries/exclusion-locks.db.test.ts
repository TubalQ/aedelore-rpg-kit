import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

// L6: a removed player is excluded and cannot join again with the code until
// the DM lifts it. L5: locks set in a campaign stay the DM's after leaving.
//
// Same setup as locks.db.test.ts: an empty throwaway database with the app's
// schema, skipped unless TEST_DATABASE_URL is set.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("exclusion and campaign-held locks (database)", async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db/client");
  const { sql, eq } = await import("drizzle-orm");
  const { users, campaigns, characters } = await import("@/lib/db/schema");
  const camps = await import("./campaigns");
  const chars = await import("./characters");

  let dm: string;
  let player: string;
  let campaignId: number;
  const code = "ABCD1234";
  let release: () => Promise<void> = async () => {};

  async function makeCharacter(locks: { raceClassLocked?: boolean } = {}) {
    const [{ id }] = await db
      .insert(characters)
      .values({ userId: player, name: `C${Math.random()}`, data: {}, ...locks })
      .returning({ id: characters.id });
    return id;
  }
  async function held(id: number) {
    const [row] = await db.select({ held: characters.locksDmHeld }).from(characters).where(eq(characters.id, id));
    return row.held;
  }

  beforeAll(async () => {
    const { lockTestDatabase } = await import("@/lib/db/test-database-lock");
    release = await lockTestDatabase(url);
    const [{ n }] = Array.from(await db.execute(sql`SELECT count(*)::int AS n FROM characters`)) as { n: number }[];
    if (n > 0) throw new Error("TEST_DATABASE_URL must point at an empty throwaway database");
  }, 120_000);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    [{ id: dm }] = await db.insert(users).values({ name: "DM" }).returning({ id: users.id });
    [{ id: player }] = await db.insert(users).values({ name: "Player" }).returning({ id: users.id });
    [{ id: campaignId }] = await db
      .insert(campaigns)
      .values({ userId: dm, name: "Camp", shareCode: code })
      .returning({ id: campaigns.id });
  });

  afterAll(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    await release();
  });

  it("a removed player cannot join again until the DM lifts the exclusion", async () => {
    const charId = await makeCharacter();
    expect(await camps.joinCampaign(code, player, charId)).toMatchObject({ campaignId });
    expect(await camps.removePlayer(campaignId, player, dm)).toBe(true);

    expect(await camps.joinCampaign(code, player, charId)).toEqual({ code: "excludedFromCampaign" });
    expect((await camps.getExcludedPlayers(campaignId, dm))?.map((p) => p.id)).toEqual([player]);

    // Only the DM sees or lifts it.
    expect(await camps.getExcludedPlayers(campaignId, player)).toBeNull();
    expect(await camps.liftExclusion(campaignId, player, player)).toBe(false);

    expect(await camps.liftExclusion(campaignId, player, dm)).toBe(true);
    expect(await camps.joinCampaign(code, player, charId)).toMatchObject({ campaignId });
  });

  it("a player who leaves on their own can join again", async () => {
    const charId = await makeCharacter();
    await camps.joinCampaign(code, player, charId);
    expect(await camps.leaveCampaign(campaignId, player)).toBe(true);
    expect(await camps.joinCampaign(code, player, charId)).toMatchObject({ campaignId });
  });

  it("locks set outside a campaign stay the player's", async () => {
    const charId = await makeCharacter();
    await chars.lockCharacterStep(charId, player, "raceClass", true);
    expect(await held(charId)).toBe(false);
  });

  it("locks brought into a campaign, or set there, stay held after leaving", async () => {
    const brought = await makeCharacter({ raceClassLocked: true });
    await camps.joinCampaign(code, player, brought);
    expect(await held(brought)).toBe(true);
    await camps.leaveCampaign(campaignId, player);
    expect(await held(brought)).toBe(true);

    await db.update(characters).set({ locksDmHeld: false, raceClassLocked: false }).where(eq(characters.id, brought));
    await camps.joinCampaign(code, player, brought);
    expect(await held(brought)).toBe(false);
    await chars.lockCharacterStep(brought, player, "raceClass", true);
    expect(await held(brought)).toBe(true);
  });

  it("the DM opening every step frees the locks; one left locked keeps them held", async () => {
    const charId = await makeCharacter({ raceClassLocked: true });
    await camps.joinCampaign(code, player, charId);
    await chars.dmSetLocks(charId, dm, campaignId, { attributesLocked: true });
    await chars.dmSetLocks(charId, dm, campaignId, { raceClassLocked: false });
    expect(await held(charId)).toBe(true);
    await chars.dmSetLocks(charId, dm, campaignId, { attributesLocked: false });
    expect(await held(charId)).toBe(false);
  });

  it("the DM takes their own character out of their own campaign (L3), nobody else's", async () => {
    const [{ id: own }] = await db
      .insert(characters)
      .values({ userId: dm, name: "DM Hero", data: {}, campaignId, raceClassLocked: true, locksDmHeld: true })
      .returning({ id: characters.id });
    const playerChar = await makeCharacter();
    await camps.joinCampaign(code, player, playerChar);

    expect(await camps.detachOwnCharacter(campaignId, playerChar, dm)).toBe(false);
    expect(await camps.detachOwnCharacter(campaignId, own, player)).toBe(false);

    const listed = await camps.getCampaignCharacters(campaignId, dm);
    expect(listed?.find((c) => c.id === own)?.isOwn).toBe(true);
    expect(listed?.find((c) => c.id === playerChar)?.isOwn).toBe(false);

    expect(await camps.detachOwnCharacter(campaignId, own, dm)).toBe(true);
    const [row] = await db.select().from(characters).where(eq(characters.id, own));
    expect(row.campaignId).toBeNull();
    expect(row.locksDmHeld).toBe(false);
  });
});
