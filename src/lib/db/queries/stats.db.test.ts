import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// C1: the DM's stat changes must never lower values bought with XP or write
// back stats the DM did not touch, and an XP purchase made while the DM
// edits must survive. Same setup as the other *.db.test.ts files.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("DM stat changes (database)", async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db/client");
  const { sql, eq } = await import("drizzle-orm");
  const { users, campaigns, characters } = await import("@/lib/db/schema");
  const chars = await import("./characters");

  let release: () => Promise<void> = async () => {};
  let dm: string;
  let player: string;
  let campaignId: number;
  let mira: number;

  const stats = async () => {
    const [row] = await db.select({ data: characters.data, xpSpent: characters.xpSpent }).from(characters).where(eq(characters.id, mira));
    return { attributes: row.data.attributes as Record<string, number>, skills: row.data.skills as Record<string, number>, xpSpent: row.xpSpent };
  };

  beforeAll(async () => {
    const { lockTestDatabase } = await import("@/lib/db/test-database-lock");
    release = await lockTestDatabase(url);
    const [{ count }] = Array.from(await db.execute(sql`SELECT count(*)::int AS count FROM characters`)) as { count: number }[];
    if (count > 0) throw new Error("TEST_DATABASE_URL must point at an empty throwaway database");
  }, 120_000);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters RESTART IDENTITY CASCADE`);
    [{ id: dm }, { id: player }] = await db.insert(users).values([{ name: "DM" }, { name: "P" }]).returning({ id: users.id });
    [{ id: campaignId }] = await db.insert(campaigns).values({ userId: dm, name: "Test" }).returning({ id: campaigns.id });
    // Strength 5 (bought with XP past the creation cap of 3), 40 XP left to spend.
    [{ id: mira }] = await db
      .insert(characters)
      .values({ userId: player, campaignId, name: "Mira", xp: 60, xpSpent: 20, attributesLocked: true, data: { attributes: { Strength: 5, Agility: 2 }, skills: { Athletics: 4 } } })
      .returning({ id: characters.id });
  });

  afterAll(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters RESTART IDENTITY CASCADE`);
    await release();
  });

  it("lowers and raises one step from the stored value, past the creation cap", async () => {
    await chars.dmAdjustStats(mira, dm, campaignId, { attributes: { Strength: -1 } });
    expect((await stats()).attributes.Strength).toBe(4);
    await chars.dmAdjustStats(mira, dm, campaignId, { attributes: { Strength: 3 }, skills: { Athletics: 1 } });
    const s = await stats();
    expect(s.attributes.Strength).toBe(7);
    expect(s.skills.Athletics).toBe(5);
  });

  it("touches only the stats it changes", async () => {
    await chars.dmAdjustStats(mira, dm, campaignId, { attributes: { Agility: 1 } });
    expect((await stats()).attributes).toEqual({ Strength: 5, Agility: 3 });
  });

  it("keeps an XP purchase made while the DM was editing", async () => {
    // The DM opened the build view at Strength 5 and pressed "+" once; meanwhile the player bought a point.
    await chars.spendXp(mira, player, { attributes: { Strength: 1 } });
    await chars.dmAdjustStats(mira, dm, campaignId, { attributes: { Strength: 1 } });
    const s = await stats();
    expect(s.attributes.Strength).toBe(7);
    expect(s.xpSpent).toBe(30);
  });

  it("never goes below 0, and a missing stat starts at 0", async () => {
    await chars.dmAdjustStats(mira, dm, campaignId, { attributes: { Agility: -5, Wits: 2 } });
    const s = await stats();
    expect(s.attributes.Agility).toBe(0);
    expect(s.attributes.Wits).toBe(2);
  });

  it("only the campaign's DM can adjust", async () => {
    expect(await chars.dmAdjustStats(mira, player, campaignId, { attributes: { Strength: 1 } })).toBeNull();
    expect((await stats()).attributes.Strength).toBe(5);
  });

  it("a player's save of one stat leaves the others as stored (the sheet sends only the changed stat)", async () => {
    await db.update(characters).set({ attributesLocked: false }).where(eq(characters.id, mira));
    await chars.dmAdjustStats(mira, dm, campaignId, { attributes: { Agility: 1 } });
    const out = await chars.updateCharacter(mira, player, { data: { attributes: { Strength: 4 } } });
    expect(out.ok).toBe(true);
    expect((await stats()).attributes).toEqual({ Strength: 4, Agility: 3 });
  });
});
