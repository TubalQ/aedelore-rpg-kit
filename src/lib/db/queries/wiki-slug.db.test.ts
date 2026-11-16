import { beforeAll, afterAll, describe, expect, it } from "vitest";

// L11: a wiki page in the trash no longer blocks a new page with the same
// address; restoring the old one while the address is taken is refused.

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("wiki slugs unique among live pages (database)", async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  const { db } = await import("@/lib/db/client");
  const { sql } = await import("drizzle-orm");
  const { wikiBooks, wikiPages } = await import("@/lib/db/schema");
  const wiki = await import("./wiki");
  let release: () => Promise<void> = async () => {};

  beforeAll(async () => {
    const { lockTestDatabase } = await import("@/lib/db/test-database-lock");
    release = await lockTestDatabase(url);
    await db.execute(sql`TRUNCATE wiki_books RESTART IDENTITY CASCADE`);
  }, 120_000);
  afterAll(async () => {
    await db.execute(sql`TRUNCATE wiki_books RESTART IDENTITY CASCADE`);
    await release();
  });

  it("lets a new page take a trashed page's address, and refuses to restore over it", async () => {
    const [{ id: book }] = await db.insert(wikiBooks).values({ slug: "lore", title: "Lore" }).returning({ id: wikiBooks.id });
    const [{ id: old }] = await db.insert(wikiPages).values({ bookId: book, slug: "dragons", title: "Dragons" }).returning({ id: wikiPages.id });
    await wiki.softDeletePage(old);
    await db.insert(wikiPages).values({ bookId: book, slug: "dragons", title: "Dragons, new" });
    await expect(wiki.restorePage(old)).rejects.toThrow();
  });

  it("W4: search finds the public text and not the GM's spoiler block", async () => {
    const [{ id: book }] = await db.insert(wikiBooks).values({ slug: "gm", title: "GM" }).returning({ id: wikiBooks.id });
    await db.insert(wikiPages).values({
      bookId: book,
      slug: "duke",
      title: "The Duke",
      content: '<p>The duke rules Lorenzia.</p><div class="spoiler"><p>He is secretly a vampire.</p></div><p>Visit court.</p>',
    });
    const hits = (q: string) => wiki.searchPages({ q, limit: 10, offset: 0 }).then((r) => r.map((p) => p.slug));
    expect(await hits("Lorenzia")).toContain("duke");
    expect(await hits("vampire")).not.toContain("duke");
  });

  it("W11/W12: a chapter of another book is refused, a taken slug is named, a trashed book hides its pages", async () => {
    const { wikiChapters } = await import("@/lib/db/schema");
    const [{ id: a }] = await db.insert(wikiBooks).values({ slug: "a", title: "A" }).returning({ id: wikiBooks.id });
    const [{ id: b }] = await db.insert(wikiBooks).values({ slug: "b", title: "B" }).returning({ id: wikiBooks.id });
    const [{ id: chB }] = await db.insert(wikiChapters).values({ bookId: b, slug: "c", title: "C" }).returning({ id: wikiChapters.id });
    await expect(wiki.createPage({ bookId: a, chapterId: chB, slug: "x", title: "X", sortOrder: 0 })).rejects.toThrow(/chapter/);

    await wiki.createPage({ bookId: a, slug: "griffin", title: "Griffin", content: "<p>griffin lore</p>", sortOrder: 0 });
    await expect(
      wiki.bulkImportPages(a, null, [{ title: "G", slug: "griffin", sortOrder: 0 }, { title: "H", slug: "hydra", sortOrder: 0 }]),
    ).rejects.toThrow(/griffin/);

    expect((await wiki.searchPages({ q: "griffin", limit: 10, offset: 0 })).map((p) => p.slug)).toContain("griffin");
    await db.update(wikiBooks).set({ deletedAt: new Date() }).where(sql`id = ${a}`);
    expect((await wiki.searchPages({ q: "griffin", limit: 10, offset: 0 })).map((p) => p.slug)).not.toContain("griffin");
  });
});
