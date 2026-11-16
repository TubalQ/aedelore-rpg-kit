import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";

// Email/password accounts (self-hosted kit): the first live account becomes the
// admin, also when several register at once, and an address is taken in any
// letter case.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("local accounts (database)", async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db/client");
  const { sql } = await import("drizzle-orm");
  const { users } = await import("@/lib/db/schema");
  const { createLocalUser, findUserByEmailInsensitive } = await import("./local-accounts");

  let release: () => Promise<void> = async () => {};

  beforeAll(async () => {
    const { lockTestDatabase } = await import("@/lib/db/test-database-lock");
    release = await lockTestDatabase(url);
  }, 120_000);
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE users RESTART IDENTITY CASCADE`);
  });
  afterAll(async () => {
    await db.execute(sql`TRUNCATE users RESTART IDENTITY CASCADE`);
    await release();
  });

  it("makes exactly one admin when the first registrations arrive together", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => createLocalUser({ email: `p${i}@example.invalid`, name: null, passwordHash: "x" })),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    const admins = await db.select({ email: users.email }).from(users).where(sql`${users.isAdmin} = true`);
    expect(admins).toHaveLength(1);
  });

  it("is not the first account when an OIDC user already exists", async () => {
    await db.insert(users).values({ name: "Earlier", email: "earlier@example.invalid" });
    const r = await createLocalUser({ email: "new@example.invalid", name: null, passwordHash: "x" });
    expect(r).toMatchObject({ ok: true, isAdmin: false });
  });

  it("refuses an address that exists in another letter case and finds it either way", async () => {
    await db.insert(users).values({ name: "Anna", email: "Anna@Example.invalid" });
    expect(await createLocalUser({ email: "anna@example.INVALID", name: null, passwordHash: "x" })).toEqual({ ok: false, reason: "emailTaken" });
    expect((await findUserByEmailInsensitive("ANNA@example.invalid"))?.name).toBe("Anna");
  });
});
