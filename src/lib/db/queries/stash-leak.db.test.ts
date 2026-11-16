import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

// Players must not see the DM's stash: a quest item a player writes onto
// their own sheet with someone else's stash id would be shown with that
// entry's name and description. And planned equipment placed from the stash
// stays hidden from players until the DM reveals it.
//
// Same setup as give-items.db.test.ts: an empty throwaway database with the
// app's schema, skipped unless TEST_DATABASE_URL is set.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("the stash and players (database)", async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db/client");
  const { sql, eq } = await import("drizzle-orm");
  const { users, campaigns, characters, campaignItems, gameSessions } = await import("@/lib/db/schema");
  const { CharacterDataSchema } = await import("@/lib/schemas/character");
  const { sanitizeDataPatch } = await import("@/lib/schemas/tolerant");
  const { filterSessionForPlayer } = await import("@/lib/session/player-view");
  const { PlaceStashEntrySchema } = await import("@/lib/schemas/stash");
  const chars = await import("./characters");
  const stash = await import("./stash");

  let dm: string;
  let player: string;
  let campaignId: number;
  let a: number;
  let map: number;
  let secret: number;
  let blade: number;
  let sessionId: number;

  /** What the PUT route does with a player's or DM's save. */
  async function save(id: number, userId: string, data: Record<string, unknown>, campaign?: number) {
    const result = sanitizeDataPatch(CharacterDataSchema, data);
    if (!result.ok) throw new Error(`bad keys ${result.unknownKeys}`);
    const out = await chars.updateCharacter(id, userId, { data: result.patch, ...(campaign ? { campaignId: campaign } : {}) });
    if (!out.ok) throw new Error(out.reason);
    return out.character.data;
  }
  /** What the place route does: the request through its schema, then the query. */
  const place = (stashId: number, body: Record<string, unknown>) =>
    stash.placeStashEntry(campaignId, stashId, PlaceStashEntrySchema.parse({ sessionId, ...body }));
  const questNames = (d: { questItems: { name: string }[]; questItemsArchived: { name: string }[] }) => ({
    active: d.questItems.map((q) => q.name),
    archived: d.questItemsArchived.map((q) => q.name),
  });

  let release: () => Promise<void> = async () => {};

  beforeAll(async () => {
    // Other *.db.test.ts files empty the same tables: take turns.
    const { lockTestDatabase } = await import("@/lib/db/test-database-lock");
    release = await lockTestDatabase(url);
    const [{ count }] = Array.from(await db.execute(sql`SELECT count(*)::int AS count FROM characters`)) as { count: number }[];
    if (count > 0) throw new Error("TEST_DATABASE_URL must point at an empty throwaway database");
  }, 120_000);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    [{ id: dm }, { id: player }] = await db.insert(users).values([{ name: "DM" }, { name: "Player" }]).returning({ id: users.id });
    [{ id: campaignId }] = await db.insert(campaigns).values({ userId: dm, name: "Test" }).returning({ id: campaigns.id });
    [{ id: map }, { id: secret }, { id: blade }] = await db
      .insert(campaignItems)
      .values([
        { campaignId, kind: "quest", data: { name: "Map", description: "To the harbour" } },
        { campaignId, kind: "quest", data: { name: "The Traitor's Letter", description: "The duke is the traitor" } },
        { campaignId, kind: "equipment", data: { name: "Frost Blade", type: "weapon" } },
      ])
      .returning({ id: campaignItems.id });
    [{ id: a }] = await db
      .insert(characters)
      .values({ userId: player, campaignId, name: "Arvid", data: { questItems: [{ name: "Map", description: "", stashId: map }] } })
      .returning({ id: characters.id });
    [{ id: sessionId }] = await db
      .insert(gameSessions)
      .values({ campaignId, userId: dm, sessionNumber: 1, data: {} })
      .returning({ id: gameSessions.id });
  });

  afterAll(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    await release();
  });

  it("a player cannot pull a stash entry they were not given onto their sheet", async () => {
    const seen = await save(a, player, {
      questItems: [{ name: "Map", description: "", stashId: map }, { name: "?", description: "", stashId: secret }],
    });
    expect(questNames(seen)).toEqual({ active: ["Map"], archived: [] });
    expect(JSON.stringify(seen)).not.toContain("traitor");
  });

  it("a player can still archive and restore what they hold", async () => {
    const archived = await save(a, player, { questItems: [], questItemsArchived: [{ name: "Map", description: "", stashId: map }] });
    expect(questNames(archived)).toEqual({ active: [], archived: ["Map"] });
    const restored = await save(a, player, { questItems: [{ name: "Map", description: "", stashId: map }], questItemsArchived: [] });
    expect(questNames(restored)).toEqual({ active: ["Map"], archived: [] });
  });

  it("a new character cannot carry a planted stash id into the campaign", async () => {
    const [{ id: fresh }] = await db.insert(characters).values({ userId: player, campaignId: null, name: "Bo", data: {} }).returning({ id: characters.id });
    await save(fresh, player, { questItems: [{ name: "?", description: "", stashId: secret }] });
    const [row] = await db.select({ data: characters.data }).from(characters).where(eq(characters.id, fresh));
    expect(row.data.questItems ?? []).toEqual([]);
  });

  it("the DM still writes quest items on a player's sheet freely", async () => {
    const seen = await save(a, dm, { questItems: [{ name: "Map", description: "", stashId: map }, { name: "?", description: "", stashId: secret }] });
    expect(questNames(seen).active).toEqual(["Map", "The Traitor's Letter"]);
  });

  it("equipment placed from the stash is hidden from players unless the DM says otherwise", async () => {
    await place(blade, {});
    await place(map, {});
    const [s1] = await db.select({ data: gameSessions.data }).from(gameSessions).where(eq(gameSessions.id, sessionId));
    const d1 = s1.data as { items: { visibleTo: string }[]; equipment: { visibleTo: string }[] };
    expect(d1.equipment.map((e) => e.visibleTo)).toEqual(["dm"]);
    // Items are visible, players see them once found.
    expect(d1.items.map((i) => i.visibleTo)).toEqual(["all"]);
    const forPlayer = filterSessionForPlayer(s1.data, "Arvid") as { equipment: unknown[] };
    expect(forPlayer.equipment).toEqual([]);

    await place(blade, { visibleTo: "all" });
    const [s2] = await db.select({ data: gameSessions.data }).from(gameSessions).where(eq(gameSessions.id, sessionId));
    expect((s2.data as { equipment: { visibleTo: string }[] }).equipment.map((e) => e.visibleTo)).toEqual(["dm", "all"]);
  });
});
