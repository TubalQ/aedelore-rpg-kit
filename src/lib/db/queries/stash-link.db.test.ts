import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

// S2: a new card in a session must never be linked to an existing stash entry
// by its name. The link caught a card while its name was being typed, and the
// next save wrote the new card over the existing entry everywhere it was
// placed (stats reset to defaults, also on characters holding it).
//
// Same setup as give-items.db.test.ts: an empty throwaway database with the
// app's schema, skipped unless TEST_DATABASE_URL is set.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("linking session cards to the stash (database)", async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db/client");
  const { sql, eq } = await import("drizzle-orm");
  const { users, campaigns, campaignItems } = await import("@/lib/db/schema");
  const stash = await import("./stash");

  let campaignId: number;
  let sword: number;
  let letter: number;
  let release: () => Promise<void> = async () => {};

  const entry = async (id: number) => {
    const [row] = await db.select({ data: campaignItems.data }).from(campaignItems).where(eq(campaignItems.id, id));
    return row.data;
  };
  const count = async () => {
    const [{ n }] = Array.from(await db.execute(sql`SELECT count(*)::int AS n FROM campaign_items`)) as { n: number }[];
    return n;
  };

  beforeAll(async () => {
    const { lockTestDatabase } = await import("@/lib/db/test-database-lock");
    release = await lockTestDatabase(url);
    const [{ n }] = Array.from(await db.execute(sql`SELECT count(*)::int AS n FROM characters`)) as { n: number }[];
    if (n > 0) throw new Error("TEST_DATABASE_URL must point at an empty throwaway database");
  }, 120_000);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    const [{ id: dm }] = await db.insert(users).values({ name: "DM" }).returning({ id: users.id });
    [{ id: campaignId }] = await db.insert(campaigns).values({ userId: dm, name: "Test" }).returning({ id: campaigns.id });
    [{ id: sword }, { id: letter }] = await db
      .insert(campaignItems)
      .values([
        { campaignId, kind: "equipment", data: { name: "Svärd", type: "weapon", damage: "1d8", rarity: "rare" } },
        { campaignId, kind: "quest", data: { name: "Brev", description: "Hertigen är förrädaren" } },
      ])
      .returning({ id: campaignItems.id });
  });

  afterAll(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    await release();
  });

  it("a new equipment card with an existing name gets its own entry, and typing on leaves the existing one alone", async () => {
    // First save while the name reads "Svärd", exactly the existing entry's name.
    const first = await stash.linkSessionPatch(db, campaignId, { equipment: [{ name: "Svärd", type: "weapon" }] });
    const id = (first.equipment as { stashId: number }[])[0].stashId;
    expect(id).not.toBe(sword);
    expect(await count()).toBe(3);

    // The next save carries the id it got and the finished name.
    await stash.linkSessionPatch(db, campaignId, {
      equipment: [{ name: "Svärdet av Kael", type: "weapon", stashId: id }],
    });
    expect(await entry(sword)).toMatchObject({ name: "Svärd", damage: "1d8", rarity: "rare" });
    expect(await entry(id)).toMatchObject({ name: "Svärdet av Kael" });
  });

  it("a new quest item with an existing name gets its own entry", async () => {
    const out = await stash.linkSessionPatch(db, campaignId, { items: [{ name: "brev ", description: "" }] });
    const id = (out.items as { stashId: number }[])[0].stashId;
    expect(id).not.toBe(letter);
    expect(await entry(letter)).toMatchObject({ name: "Brev", description: "Hertigen är förrädaren" });
  });

  it("a card placed from the stash still writes its edits to that entry", async () => {
    await stash.linkSessionPatch(db, campaignId, {
      items: [{ name: "Brev", description: "Sigillet är brutet", stashId: letter }],
    });
    expect(await entry(letter)).toMatchObject({ name: "Brev", description: "Sigillet är brutet" });
    expect(await count()).toBe(2);
  });

  it("a hand-over to a character still finds the entry by name", async () => {
    expect(await stash.resolveStashId(campaignId, "quest", { name: "Brev", description: "" })).toBe(letter);
  });

  it("S8: an untouched card does not write old text over an edit made on the stash page", async () => {
    const stored = { items: [{ name: "Brev", description: "Hertigen är förrädaren", stashId: letter }] };
    // Edited on the stash page meanwhile.
    await db.update(campaignItems).set({ data: { name: "Brev", description: "Sigillet är brutet" } }).where(eq(campaignItems.id, letter));
    await stash.linkSessionPatch(db, campaignId, { items: [{ name: "Brev", description: "Hertigen är förrädaren", stashId: letter }] }, stored);
    expect(await entry(letter)).toMatchObject({ description: "Sigillet är brutet" });
  });

  it("S8: a card edited in this editor is still written to its entry", async () => {
    const stored = { items: [{ name: "Brev", description: "Hertigen är förrädaren", stashId: letter }] };
    await stash.linkSessionPatch(db, campaignId, { items: [{ name: "Brev", description: "Hertigen ljög", stashId: letter }] }, stored);
    expect(await entry(letter)).toMatchObject({ description: "Hertigen ljög" });
  });

  it("S8: of two placements of one entry, only the edited one is written", async () => {
    const stored = { items: [
      { name: "Brev", description: "Hertigen är förrädaren", stashId: letter },
      { name: "Brev", description: "Hertigen är förrädaren", stashId: letter },
    ] };
    await stash.linkSessionPatch(db, campaignId, { items: [
      { name: "Brev", description: "Ny text", stashId: letter },
      { name: "Brev", description: "Hertigen är förrädaren", stashId: letter },
    ] }, stored);
    expect(await entry(letter)).toMatchObject({ description: "Ny text" });
  });
  it("an equipment card with HP and no maxHp gets its HP as maxHp in the stash", async () => {
    const out = await stash.linkSessionPatch(db, campaignId, { equipment: [{ name: "Hjälm", type: "armor", bodypart: "head", hp: 5, ac: 2 }] });
    const id = (out.equipment as { stashId: number }[])[0].stashId;
    expect(await entry(id)).toMatchObject({ hp: 5, maxHp: 5 });
  });
});
