import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// #82: the triggers in deploy/sql/20261115-change-notify.sql say which
// campaign changed, and a character that leaves tells its old campaign too.
// Same setup as the other .db tests: an empty throwaway database.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("change notifications (database)", async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db/client");
  const { sql, eq } = await import("drizzle-orm");
  const { users, campaigns, characters } = await import("@/lib/db/schema");
  const postgres = (await import("postgres")).default;

  let release: () => Promise<void> = async () => {};
  const listener = postgres(url, { max: 1 });
  const seen: string[] = [];

  beforeAll(async () => {
    const { lockTestDatabase } = await import("@/lib/db/test-database-lock");
    release = await lockTestDatabase(url);
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    await listener.unsafe(readFileSync("deploy/sql/20261115-change-notify.sql", "utf8"));
    await listener.listen("aedelore_changes", (p) => seen.push(p));
  }, 120_000);

  afterAll(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    await listener.end();
    await release();
  });

  async function settle(): Promise<string[]> {
    await new Promise((r) => setTimeout(r, 200));
    return seen.splice(0).map((p) => JSON.stringify(JSON.parse(p)));
  }

  it("names the campaign and the table, and nothing for a character in no campaign", async () => {
    const [{ id: dm }] = await db.insert(users).values({ name: "DM" }).returning({ id: users.id });
    const [{ id: a }] = await db.insert(campaigns).values({ userId: dm, name: "A" }).returning({ id: campaigns.id });
    expect(await settle()).toEqual([JSON.stringify({ t: "campaigns", c: a })]);

    const [{ id: free }] = await db.insert(characters).values({ userId: dm, name: "Free", data: {} }).returning({ id: characters.id });
    expect(await settle()).toEqual([]);

    await db.update(characters).set({ campaignId: a }).where(eq(characters.id, free));
    expect(await settle()).toEqual([JSON.stringify({ t: "characters", c: a })]);

    const [{ id: b }] = await db.insert(campaigns).values({ userId: dm, name: "B" }).returning({ id: campaigns.id });
    await settle();
    await db.update(characters).set({ campaignId: b }).where(eq(characters.id, free));
    expect((await settle()).sort()).toEqual([JSON.stringify({ t: "characters", c: a }), JSON.stringify({ t: "characters", c: b })].sort());
  });
});
