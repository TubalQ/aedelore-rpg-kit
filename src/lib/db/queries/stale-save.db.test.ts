import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// C2: the sheet saves from a copy up to 30 s old. With the save's base the
// server merges it with what others wrote meanwhile: numbers as a change on
// top, lists that changed not at all (reported). Same setup as the other
// *.db.test.ts files.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("saving from an older copy (database)", async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db/client");
  const { sql, eq } = await import("drizzle-orm");
  const { users, campaigns, characters, campaignItems } = await import("@/lib/db/schema");
  const { CharacterDataSchema } = await import("@/lib/schemas/character");
  const { sanitizeDataPatch } = await import("@/lib/schemas/tolerant");
  const chars = await import("./characters");

  let release: () => Promise<void> = async () => {};
  let dm: string;
  let player: string;
  let campaignId: number;
  let mira: number;
  let map: number;
  let key: number;

  /** What the PUT route does with the sheet's save. */
  async function save(data: Record<string, unknown>, base?: Record<string, unknown>) {
    const result = sanitizeDataPatch(CharacterDataSchema, data);
    if (!result.ok) throw new Error(`bad keys ${result.unknownKeys}`);
    const out = await chars.updateCharacter(mira, player, { data: result.patch, base });
    if (!out.ok) throw new Error(out.reason);
    return out;
  }
  const stored = async () => {
    const [row] = await db.select({ data: characters.data }).from(characters).where(eq(characters.id, mira));
    return row.data;
  };
  const names = (list: unknown) => (list as { name: string }[]).map((i) => i.name);

  beforeAll(async () => {
    const { lockTestDatabase } = await import("@/lib/db/test-database-lock");
    release = await lockTestDatabase(url);
    const [{ count }] = Array.from(await db.execute(sql`SELECT count(*)::int AS count FROM characters`)) as { count: number }[];
    if (count > 0) throw new Error("TEST_DATABASE_URL must point at an empty throwaway database");
  }, 120_000);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items RESTART IDENTITY CASCADE`);
    [{ id: dm }, { id: player }] = await db.insert(users).values([{ name: "DM" }, { name: "P" }]).returning({ id: users.id });
    [{ id: campaignId }] = await db.insert(campaigns).values({ userId: dm, name: "Test" }).returning({ id: campaigns.id });
    [{ id: map }, { id: key }] = await db
      .insert(campaignItems)
      .values([{ campaignId, kind: "quest", data: { name: "Map", description: "" } }, { campaignId, kind: "quest", data: { name: "Key", description: "" } }])
      .returning({ id: campaignItems.id });
    [{ id: mira }] = await db
      .insert(characters)
      .values({
        userId: player, campaignId, name: "Mira", xp: 30, xpSpent: 0, attributesLocked: true,
        data: { hp: 10, maxHp: 20, gold: 4, attributes: { Strength: 5 }, questItems: [{ name: "Map", description: "", stashId: map }], relationships: [{ name: "Bo", relation: "friend", notes: "", archived: false }] },
      })
      .returning({ id: characters.id });
  });

  afterAll(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items RESTART IDENTITY CASCADE`);
    await release();
  });

  it("keeps the DM's damage when the sheet heals from an older copy", async () => {
    await chars.dmUpdateHp(mira, dm, campaignId, { hp: 5 });
    const out = await save({ hp: 11 }, { hp: 10 });
    expect((await stored()).hp).toBe(6);
    expect(out.ok && out.conflicts).toEqual([]);
  });

  it("does not archive from a copy that missed an item the DM handed out, and says so", async () => {
    await chars.dmGiveItem(mira, dm, campaignId, { name: "Key", description: "", stashId: key });
    const sheetSaw = { questItems: [{ name: "Map", description: "", stashId: map }], questItemsArchived: [] };
    const out = await save({ questItems: [], questItemsArchived: [{ name: "Map", description: "", stashId: map }] }, sheetSaw);
    expect(out.ok && out.conflicts.sort()).toEqual(["questItems", "questItemsArchived"]);
    const data = await stored();
    expect(names(data.questItems)).toEqual(["Map", "Key"]);
    expect(data.questItemsArchived ?? []).toEqual([]);
  });

  it("archives when nothing changed meanwhile", async () => {
    const sheetSaw = { questItems: [{ name: "Map", description: "", stashId: map }], questItemsArchived: [] };
    const out = await save({ questItems: [], questItemsArchived: [{ name: "Map", description: "", stashId: map }] }, sheetSaw);
    expect(out.ok && out.conflicts).toEqual([]);
    expect(names((await stored()).questItemsArchived)).toEqual(["Map"]);
  });

  it("does not overwrite a list someone else changed, and writes the rest of the save", async () => {
    // The MCP added a relationship (a save without base) after the sheet loaded.
    await chars.updateCharacter(mira, player, {
      data: { relationships: [{ name: "Bo", relation: "friend", notes: "", archived: false }, { name: "Ida", relation: "rival", notes: "", archived: false }] },
    });
    const out = await save({ relationships: [], gold: 5 }, { relationships: [{ name: "Bo", relation: "friend", notes: "", archived: false }], gold: 4 });
    expect(out.ok && out.conflicts).toEqual(["relationships"]);
    const data = await stored();
    expect(names(data.relationships)).toEqual(["Bo", "Ida"]);
    expect(data.gold).toBe(5);
  });

  it("merges a stat with an XP purchase made meanwhile", async () => {
    await db.update(characters).set({ attributesLocked: false }).where(eq(characters.id, mira));
    await chars.spendXp(mira, player, { attributes: { Strength: 1 } });
    await save({ attributes: { Strength: 4 } }, { attributes: { Strength: 5 } });
    expect((await stored()).attributes).toEqual({ Strength: 5 });
  });

  it("writes as before without a base", async () => {
    await chars.dmUpdateHp(mira, dm, campaignId, { hp: 5 });
    await save({ hp: 11 });
    expect((await stored()).hp).toBe(11);
  });
});
