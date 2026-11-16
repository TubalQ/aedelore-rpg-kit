import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

// C11: the DM's HP change finds the piece by stash id (not by an index that
// can be off) and reaches the equipped copy too.
//
// Same setup as give-items.db.test.ts: an empty throwaway database with the
// app's schema, skipped unless TEST_DATABASE_URL is set.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("the DM changing equipment HP (database)", async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db/client");
  const { sql, eq } = await import("drizzle-orm");
  const { users, campaigns, characters } = await import("@/lib/db/schema");
  const chars = await import("./characters");

  let dm: string;
  let campaignId: number;
  let arvid: number;
  let release: () => Promise<void> = async () => {};

  beforeAll(async () => {
    const { lockTestDatabase } = await import("@/lib/db/test-database-lock");
    release = await lockTestDatabase(url);
    const [{ n }] = Array.from(await db.execute(sql`SELECT count(*)::int AS n FROM characters`)) as { n: number }[];
    if (n > 0) throw new Error("TEST_DATABASE_URL must point at an empty throwaway database");
  }, 120_000);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    let player: string;
    [{ id: dm }, { id: player }] = await db.insert(users).values([{ name: "DM" }, { name: "P" }]).returning({ id: users.id });
    [{ id: campaignId }] = await db.insert(campaigns).values({ userId: dm, name: "C" }).returning({ id: campaigns.id });
    [{ id: arvid }] = await db
      .insert(characters)
      .values({
        userId: player,
        campaignId,
        name: "Arvid",
        data: {
          dmEquipment: [
            { name: "Hjälm", stashId: 4, hp: 2, maxHp: 3 },
            { name: "Sköld", stashId: 5, hp: 4, maxHp: 6 },
          ],
          equippedShield: { name: "Sköld (DM)", hp: 4, maxHp: 6, ac: 1 },
        },
      })
      .returning({ id: characters.id });
  });

  afterAll(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    await release();
  });

  it("changes the piece named by stash id, even with a wrong index, and its equipped copy", async () => {
    const out = await chars.dmUpdateEquipmentHp(arvid, dm, campaignId, { index: 0, stashId: 5 }, 1);
    expect(out).not.toBeNull();
    const [row] = await db.select({ data: characters.data }).from(characters).where(eq(characters.id, arvid));
    const data = row.data as { dmEquipment: { hp: number }[]; equippedShield: { hp: number } };
    expect(data.dmEquipment.map((e) => e.hp)).toEqual([2, 1]);
    expect(data.equippedShield.hp).toBe(1);
  });

  it("keeps HP within 0 and max", async () => {
    await chars.dmUpdateEquipmentHp(arvid, dm, campaignId, { index: 1, stashId: 5 }, 99);
    const [row] = await db.select({ data: characters.data }).from(characters).where(eq(characters.id, arvid));
    expect((row.data as { dmEquipment: { hp: number }[] }).dmEquipment[1].hp).toBe(6);
  });

  it("HP changes as deltas on the stored value: two quick clicks count twice", async () => {
    await db.update(characters).set({ data: sql`${characters.data} || '{"hp": 15, "maxHp": 18}'::jsonb` }).where(eq(characters.id, arvid));
    await Promise.all([
      chars.dmUpdateHp(arvid, dm, campaignId, { delta: -1 }),
      chars.dmUpdateHp(arvid, dm, campaignId, { delta: -1 }),
    ]);
    const [row] = await db.select({ data: characters.data }).from(characters).where(eq(characters.id, arvid));
    expect((row.data as { hp: number }).hp).toBe(13);
    await chars.dmUpdateHp(arvid, dm, campaignId, { delta: 99 });
    const [after] = await db.select({ data: characters.data }).from(characters).where(eq(characters.id, arvid));
    expect((after.data as { hp: number }).hp).toBe(18);
  });
});
