import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

// C3: the step locks follow the sheet. Skills are edited in the attributes
// step, so the attributes lock holds them; the abilities lock holds spells.
//
// Same setup as give-items.db.test.ts: an empty throwaway database with the
// app's schema, skipped unless TEST_DATABASE_URL is set.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("step locks on a player's save (database)", async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db/client");
  const { sql } = await import("drizzle-orm");
  const { users, characters } = await import("@/lib/db/schema");
  const { CharacterDataSchema } = await import("@/lib/schemas/character");
  const { sanitizeDataPatch } = await import("@/lib/schemas/tolerant");
  const chars = await import("./characters");

  let player: string;
  let release: () => Promise<void> = async () => {};

  async function make(locks: { attributesLocked?: boolean; abilitiesLocked?: boolean }) {
    const [{ id }] = await db
      .insert(characters)
      .values({
        userId: player,
        name: `C${Math.random()}`,
        data: { attributes: { Strength: 1 }, skills: { Stealth: 1 }, spells: [] },
        raceClassLocked: true,
        ...locks,
      })
      .returning({ id: characters.id });
    return id;
  }
  async function save(id: number, data: Record<string, unknown>) {
    const result = sanitizeDataPatch(CharacterDataSchema, data);
    if (!result.ok) throw new Error(`bad keys ${result.unknownKeys}`);
    const out = await chars.updateCharacter(id, player, { data: result.patch });
    if (!out.ok) throw new Error(out.reason);
    return out.character.data;
  }
  const change = {
    attributes: { Strength: 3 },
    skills: { Stealth: 3 },
    spells: [{ name: "Fireball", selected: true }],
  };

  beforeAll(async () => {
    const { lockTestDatabase } = await import("@/lib/db/test-database-lock");
    release = await lockTestDatabase(url);
    const [{ n }] = Array.from(await db.execute(sql`SELECT count(*)::int AS n FROM characters`)) as { n: number }[];
    if (n > 0) throw new Error("TEST_DATABASE_URL must point at an empty throwaway database");
  }, 120_000);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    [{ id: player }] = await db.insert(users).values({ name: "Player" }).returning({ id: users.id });
  });

  afterAll(async () => {
    await db.execute(sql`TRUNCATE users, campaigns, characters, campaign_items, game_sessions RESTART IDENTITY CASCADE`);
    await release();
  });

  it("the attributes lock holds attributes and skills, and leaves spells open", async () => {
    const data = await save(await make({ attributesLocked: true }), change);
    expect(data.attributes.Strength).toBe(1);
    expect(data.skills.Stealth).toBe(1);
    expect(data.spells.map((s) => s.name)).toEqual(["Fireball"]);
  });

  it("the abilities lock holds spells only, so skill edits are kept", async () => {
    const data = await save(await make({ abilitiesLocked: true }), change);
    expect(data.attributes.Strength).toBe(3);
    expect(data.skills.Stealth).toBe(3);
    expect(data.spells).toEqual([]);
  });
});
