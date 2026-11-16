import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// Handing stash entries to characters and taking them back, against a real
// Postgres: the move must take the entry from everyone else in the same
// transaction, sharing must leave the others alone, and taking back must
// follow the stash entry (not the name) and empty the equipped slot.
//
// Needs a throwaway database with the app's schema and NOTHING else in it
// (every table is truncated). Skipped unless TEST_DATABASE_URL is set:
//   pg_dump -s -O -x -d aedelore | psql <throwaway db>
//   TEST_DATABASE_URL=postgres://... npx vitest run src/lib/db/queries/give-items.db.test.ts

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("giving stash entries to characters (database)", async () => {
  // Vitest still runs a skipped describe's body to collect its tests; without
  // a test database there is nothing to import.
  if (!url) return;
  // The db client reads DATABASE_URL when it is first imported.
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db/client");
  const { sql, eq } = await import("drizzle-orm");
  const { users, campaigns, characters, campaignItems } = await import("@/lib/db/schema");
  const q = await import("./characters");

  let dm: string;
  let player: string;
  let campaignId: number;
  let a: number;
  let b: number;
  let c: number;
  let map: number;
  let blade: number;

  async function dataOf(id: number): Promise<Record<string, unknown>> {
    const [row] = await db.select({ data: characters.data }).from(characters).where(eq(characters.id, id));
    return row.data;
  }
  const names = async (id: number, key: string): Promise<string[]> =>
    ((await dataOf(id))[key] as { name: string }[] | undefined ?? []).map((e) => e.name);

  let release: () => Promise<void> = async () => {};

  beforeAll(async () => {
    // Other *.db.test.ts files empty the same tables: take turns.
    const { lockTestDatabase } = await import("@/lib/db/test-database-lock");
    release = await lockTestDatabase(url);
    const [{ count }] = Array.from(await db.execute(sql`SELECT count(*)::int AS count FROM characters`)) as { count: number }[];
    // Refuse to run against a database with characters in it.
    if (count > 0) throw new Error("TEST_DATABASE_URL must point at an empty throwaway database");
  }, 120_000);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items RESTART IDENTITY CASCADE`);
    [{ id: dm }, { id: player }] = await db.insert(users).values([{ name: "DM" }, { name: "Player" }]).returning({ id: users.id });
    [{ id: campaignId }] = await db.insert(campaigns).values({ userId: dm, name: "Test" }).returning({ id: campaigns.id });
    [{ id: a }, { id: b }, { id: c }] = await db
      .insert(characters)
      .values(["Arvid", "Bo", "Cira"].map((name) => ({ userId: player, campaignId, name, data: {} })))
      .returning({ id: characters.id });
    [{ id: map }, { id: blade }] = await db
      .insert(campaignItems)
      .values([
        { campaignId, kind: "quest", data: { name: "Map", description: "Old map" } },
        { campaignId, kind: "equipment", data: { name: "Frost Blade", type: "weapon", damage: "1d8", bonuses: [{ stat: "Strength", value: 2 }] } },
      ])
      .returning({ id: campaignItems.id });
  });

  afterAll(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items RESTART IDENTITY CASCADE`);
    await release();
  });

  const giveMap = (to: number, move: boolean) =>
    q.dmGiveItem(to, dm, campaignId, { name: "Map", description: "Old map", stashId: map }, { move });
  const giveBlade = (to: number, move: boolean) =>
    q.dmGiveEquipment(to, dm, campaignId, { name: "Frost Blade", type: "weapon", damage: "1d8", stashId: blade }, { move });

  it("moving an item takes it from whoever had it", async () => {
    await giveMap(a, true);
    expect(await names(a, "questItems")).toEqual(["Map"]);
    await giveMap(b, true);
    expect(await names(a, "questItems")).toEqual([]);
    expect(await names(b, "questItems")).toEqual(["Map"]);
  });

  it("moving also takes it from a player who archived it", async () => {
    await giveMap(a, true);
    await db.update(characters).set({ data: { questItems: [], questItemsArchived: [{ name: "Map", description: "", stashId: map }] } }).where(eq(characters.id, a));
    await giveMap(b, true);
    expect(await names(a, "questItemsArchived")).toEqual([]);
  });

  it("sharing leaves the others theirs, and never gives the same entry twice", async () => {
    await giveMap(a, true);
    await giveMap(b, false);
    await giveMap(b, false);
    expect(await names(a, "questItems")).toEqual(["Map"]);
    expect(await names(b, "questItems")).toEqual(["Map"]);
  });

  it("taking back follows the stash entry after a rename, and says so when there is nothing to take", async () => {
    await giveMap(a, false);
    await giveMap(b, false);
    await db.update(campaignItems).set({ data: { name: "Treasure Map", description: "" } }).where(eq(campaignItems.id, map));
    expect(await q.dmRemoveItem(a, dm, campaignId, { name: "Treasure Map", stashId: map })).toEqual({ taken: true });
    expect(await names(a, "questItems")).toEqual([]);
    expect(await names(b, "questItems")).toEqual(["Map"]);
    expect(await q.dmRemoveItem(a, dm, campaignId, { name: "Treasure Map", stashId: map })).toEqual({ taken: false, reason: "notHeld" });
  });

  it("taking back without a stash id still works on the name (older callers, the MCP)", async () => {
    await giveMap(c, false);
    expect(await q.dmRemoveItem(c, dm, campaignId, { name: "Map" })).toEqual({ taken: true });
    expect(await names(c, "questItems")).toEqual([]);
  });

  it("moving equipment also empties the slot the previous holder had it equipped in", async () => {
    await giveBlade(a, true);
    const held = await dataOf(a);
    await db.update(characters).set({ data: { ...held, equippedWeapons: [{ name: "Frost Blade (DM)", damage: "1d8" }, { name: "Dagger" }] } }).where(eq(characters.id, a));
    await giveBlade(b, true);
    expect(await names(a, "dmEquipment")).toEqual([]);
    expect(await names(a, "equippedWeapons")).toEqual(["Dagger"]);
    expect(await names(b, "dmEquipment")).toEqual(["Frost Blade"]);
  });

  it("only the campaign's DM can give or take back", async () => {
    expect(await q.dmGiveItem(a, player, campaignId, { name: "Map", description: "", stashId: map }, { move: true })).toBeNull();
    expect(await q.dmRemoveItem(a, player, campaignId, { name: "Map", stashId: map })).toEqual({ taken: false, reason: "notFound" });
  });

  it("a move never touches characters in other campaigns", async () => {
    const [{ id: other }] = await db.insert(campaigns).values({ userId: dm, name: "Other" }).returning({ id: campaigns.id });
    const [{ id: d }] = await db
      .insert(characters)
      .values({ userId: player, campaignId: other, name: "Dag", data: { questItems: [{ name: "Map", description: "", stashId: map }] } })
      .returning({ id: characters.id });
    await giveMap(a, true);
    expect(await names(d, "questItems")).toEqual(["Map"]);
  });
});
