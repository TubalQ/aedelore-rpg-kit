import { eq, and, isNull, isNotNull, sql, asc, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { wikiBooks, wikiChapters, wikiPages } from "@/lib/db/schema";
import type { CreateBook, UpdateBook, CreateChapter, UpdateChapter, CreatePage, UpdatePage } from "@/lib/schemas/wiki";

export async function getBooks() {
  return db
    .select({
      id: wikiBooks.id,
      slug: wikiBooks.slug,
      title: wikiBooks.title,
      description: wikiBooks.description,
      coverImage: wikiBooks.coverImage,
      sortOrder: wikiBooks.sortOrder,
    })
    .from(wikiBooks)
    .where(isNull(wikiBooks.deletedAt))
    .orderBy(asc(wikiBooks.sortOrder), asc(wikiBooks.title));
}

export async function getBookBySlug(slug: string) {
  const rows = await db
    .select({
      id: wikiBooks.id,
      slug: wikiBooks.slug,
      title: wikiBooks.title,
      description: wikiBooks.description,
      coverImage: wikiBooks.coverImage,
      sortOrder: wikiBooks.sortOrder,
    })
    .from(wikiBooks)
    .where(and(eq(wikiBooks.slug, slug), isNull(wikiBooks.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getChaptersByBook(bookId: number) {
  return db
    .select({
      id: wikiChapters.id,
      bookId: wikiChapters.bookId,
      slug: wikiChapters.slug,
      title: wikiChapters.title,
      description: wikiChapters.description,
      sortOrder: wikiChapters.sortOrder,
    })
    .from(wikiChapters)
    .where(and(eq(wikiChapters.bookId, bookId), isNull(wikiChapters.deletedAt)))
    .orderBy(asc(wikiChapters.sortOrder), asc(wikiChapters.title));
}

export async function getPagesByBook(bookId: number) {
  return db
    .select({
      id: wikiPages.id,
      bookId: wikiPages.bookId,
      chapterId: wikiPages.chapterId,
      slug: wikiPages.slug,
      title: wikiPages.title,
      summary: wikiPages.summary,
      tags: wikiPages.tags,
      sortOrder: wikiPages.sortOrder,
    })
    .from(wikiPages)
    .where(and(eq(wikiPages.bookId, bookId), isNull(wikiPages.deletedAt)))
    .orderBy(asc(wikiPages.sortOrder), asc(wikiPages.title));
}

// Sidor i en bok MED brödtext - för MCP:ns get_rules / full bok-hämtning. De publika
// sök-/list-endpointsen lämnar aldrig ut `content`; detta gör det för en hel bok på en gång.
export async function getPagesByBookWithContent(bookId: number) {
  return db
    .select({
      id: wikiPages.id,
      bookId: wikiPages.bookId,
      chapterId: wikiPages.chapterId,
      slug: wikiPages.slug,
      title: wikiPages.title,
      content: wikiPages.content,
      summary: wikiPages.summary,
      tags: wikiPages.tags,
      sortOrder: wikiPages.sortOrder,
    })
    .from(wikiPages)
    .where(and(eq(wikiPages.bookId, bookId), isNull(wikiPages.deletedAt)))
    .orderBy(asc(wikiPages.sortOrder), asc(wikiPages.title));
}

export async function getPageBySlug(bookSlug: string, pageSlug: string) {
  const rows = await db
    .select({
      id: wikiPages.id,
      bookId: wikiPages.bookId,
      chapterId: wikiPages.chapterId,
      slug: wikiPages.slug,
      title: wikiPages.title,
      content: wikiPages.content,
      summary: wikiPages.summary,
      authorNote: wikiPages.authorNote,
      tags: wikiPages.tags,
      sortOrder: wikiPages.sortOrder,
      viewCount: wikiPages.viewCount,
    })
    .from(wikiPages)
    .innerJoin(wikiBooks, eq(wikiPages.bookId, wikiBooks.id))
    .where(
      and(
        eq(wikiBooks.slug, bookSlug),
        eq(wikiPages.slug, pageSlug),
        isNull(wikiPages.deletedAt),
        isNull(wikiBooks.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function incrementPageViewCount(bookSlug: string, pageSlug: string) {
  await db
    .update(wikiPages)
    .set({ viewCount: sql`${wikiPages.viewCount} + 1` })
    .where(
      and(
        eq(wikiPages.slug, pageSlug),
        eq(
          wikiPages.bookId,
          db
            .select({ id: wikiBooks.id })
            .from(wikiBooks)
            .where(eq(wikiBooks.slug, bookSlug))
            .limit(1),
        ),
      ),
    );
}

export async function searchPages(opts: {
  q: string;
  bookId?: number;
  tag?: string;
  limit: number;
  offset: number;
}) {
  const conditions = [isNull(wikiPages.deletedAt)];

  if (opts.bookId) {
    conditions.push(eq(wikiPages.bookId, opts.bookId));
  }
  if (opts.tag) {
    conditions.push(sql`${opts.tag} = ANY(${wikiPages.tags})`);
  }

  // Only require a full-text match when there is an actual query. Tag-only
  // (or book-only) browsing must list pages without needing the term in content.
  const hasQuery = opts.q.trim().length > 0;
  const tsQuery = sql`websearch_to_tsquery('english', ${opts.q})`;
  if (hasQuery) {
    conditions.push(sql`search_vector @@ ${tsQuery}`);
  }

  const rows = await db
    .select({
      id: wikiPages.id,
      bookId: wikiPages.bookId,
      chapterId: wikiPages.chapterId,
      slug: wikiPages.slug,
      title: wikiPages.title,
      summary: wikiPages.summary,
      tags: wikiPages.tags,
      sortOrder: wikiPages.sortOrder,
      rank: hasQuery
        ? sql<number>`ts_rank(search_vector, ${tsQuery})`.as("rank")
        : sql<number>`0`.as("rank"),
    })
    .from(wikiPages)
    .where(and(...conditions))
    .orderBy(hasQuery ? sql`rank DESC` : sql`${wikiPages.sortOrder} ASC, ${wikiPages.title} ASC`)
    .limit(opts.limit)
    .offset(opts.offset);

  return rows;
}

export async function getRecentPages(limit = 8) {
  return db
    .select({
      id: wikiPages.id,
      slug: wikiPages.slug,
      title: wikiPages.title,
      summary: wikiPages.summary,
      updatedAt: wikiPages.updatedAt,
      viewCount: wikiPages.viewCount,
      bookSlug: wikiBooks.slug,
      bookTitle: wikiBooks.title,
    })
    .from(wikiPages)
    .innerJoin(wikiBooks, eq(wikiPages.bookId, wikiBooks.id))
    .where(and(isNull(wikiPages.deletedAt), isNull(wikiBooks.deletedAt)))
    .orderBy(desc(wikiPages.updatedAt))
    .limit(limit);
}

export async function getAllTags(): Promise<string[]> {
  const rows = await db
    .select({
      tag: sql<string>`DISTINCT unnest(${wikiPages.tags})`.as("tag"),
    })
    .from(wikiPages)
    .where(and(isNull(wikiPages.deletedAt), sql`${wikiPages.tags} IS NOT NULL`))
    .orderBy(sql`tag`);
  return rows.map((r) => r.tag);
}

// --- Admin CRUD: Books ---

export async function getBookById(id: number) {
  const rows = await db
    .select({
      id: wikiBooks.id,
      slug: wikiBooks.slug,
      title: wikiBooks.title,
      description: wikiBooks.description,
      coverImage: wikiBooks.coverImage,
      authorNote: wikiBooks.authorNote,
      sortOrder: wikiBooks.sortOrder,
    })
    .from(wikiBooks)
    .where(and(eq(wikiBooks.id, id), isNull(wikiBooks.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createBook(data: CreateBook) {
  const rows = await db
    .insert(wikiBooks)
    .values(data)
    .returning({
      id: wikiBooks.id,
      slug: wikiBooks.slug,
      title: wikiBooks.title,
      description: wikiBooks.description,
      coverImage: wikiBooks.coverImage,
      authorNote: wikiBooks.authorNote,
      sortOrder: wikiBooks.sortOrder,
    });
  return rows[0];
}

export async function updateBook(id: number, data: UpdateBook) {
  const rows = await db
    .update(wikiBooks)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(wikiBooks.id, id), isNull(wikiBooks.deletedAt)))
    .returning({
      id: wikiBooks.id,
      slug: wikiBooks.slug,
      title: wikiBooks.title,
      description: wikiBooks.description,
      coverImage: wikiBooks.coverImage,
      authorNote: wikiBooks.authorNote,
      sortOrder: wikiBooks.sortOrder,
    });
  return rows[0] ?? null;
}

export async function softDeleteBook(id: number) {
  const now = new Date();
  // Atomic (#6): the book and its cascade-hidden chapters/pages move together.
  await db.transaction(async (tx) => {
    const rows = await tx
      .update(wikiBooks)
      .set({ deletedAt: now })
      .where(and(eq(wikiBooks.id, id), isNull(wikiBooks.deletedAt)))
      .returning({ id: wikiBooks.id });
    if (rows[0]) {
      // Cascade: hide chapters and pages that were still live (same timestamp).
      await tx
        .update(wikiChapters)
        .set({ deletedAt: now })
        .where(and(eq(wikiChapters.bookId, id), isNull(wikiChapters.deletedAt)));
      await tx
        .update(wikiPages)
        .set({ deletedAt: now })
        .where(and(eq(wikiPages.bookId, id), isNull(wikiPages.deletedAt)));
    }
  });
}

export async function restoreBook(id: number): Promise<boolean> {
  // Atomic (#6): read the cascade timestamp and restore book + children together.
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ deletedAt: wikiBooks.deletedAt })
      .from(wikiBooks)
      .where(and(eq(wikiBooks.id, id), isNotNull(wikiBooks.deletedAt)));
    if (!existing?.deletedAt) return false;
    const ts = existing.deletedAt;
    await tx
      .update(wikiBooks)
      .set({ deletedAt: sql`NULL` })
      .where(eq(wikiBooks.id, id));
    // Restore only children cascade-deleted together with the book.
    await tx
      .update(wikiChapters)
      .set({ deletedAt: sql`NULL` })
      .where(and(eq(wikiChapters.bookId, id), eq(wikiChapters.deletedAt, ts)));
    await tx
      .update(wikiPages)
      .set({ deletedAt: sql`NULL` })
      .where(and(eq(wikiPages.bookId, id), eq(wikiPages.deletedAt, ts)));
    return true;
  });
}

export async function permanentDeleteBook(id: number) {
  await db
    .delete(wikiBooks)
    .where(and(eq(wikiBooks.id, id), isNotNull(wikiBooks.deletedAt)));
}

export async function getDeletedBooks() {
  return db
    .select({
      id: wikiBooks.id,
      slug: wikiBooks.slug,
      title: wikiBooks.title,
      description: wikiBooks.description,
      coverImage: wikiBooks.coverImage,
      sortOrder: wikiBooks.sortOrder,
      deletedAt: wikiBooks.deletedAt,
    })
    .from(wikiBooks)
    .where(isNotNull(wikiBooks.deletedAt))
    .orderBy(desc(wikiBooks.deletedAt));
}

// --- Admin CRUD: Chapters ---

export async function getChapterById(id: number) {
  const rows = await db
    .select({
      id: wikiChapters.id,
      bookId: wikiChapters.bookId,
      slug: wikiChapters.slug,
      title: wikiChapters.title,
      description: wikiChapters.description,
      authorNote: wikiChapters.authorNote,
      sortOrder: wikiChapters.sortOrder,
    })
    .from(wikiChapters)
    .where(and(eq(wikiChapters.id, id), isNull(wikiChapters.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createChapter(data: CreateChapter) {
  const rows = await db
    .insert(wikiChapters)
    .values(data)
    .returning({
      id: wikiChapters.id,
      bookId: wikiChapters.bookId,
      slug: wikiChapters.slug,
      title: wikiChapters.title,
      description: wikiChapters.description,
      authorNote: wikiChapters.authorNote,
      sortOrder: wikiChapters.sortOrder,
    });
  return rows[0];
}

export async function updateChapter(id: number, data: UpdateChapter) {
  const rows = await db
    .update(wikiChapters)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(wikiChapters.id, id), isNull(wikiChapters.deletedAt)))
    .returning({
      id: wikiChapters.id,
      bookId: wikiChapters.bookId,
      slug: wikiChapters.slug,
      title: wikiChapters.title,
      description: wikiChapters.description,
      authorNote: wikiChapters.authorNote,
      sortOrder: wikiChapters.sortOrder,
    });
  return rows[0] ?? null;
}

export async function softDeleteChapter(id: number) {
  const now = new Date();
  // Atomic (#6): the chapter and its cascade-hidden pages move together.
  await db.transaction(async (tx) => {
    const rows = await tx
      .update(wikiChapters)
      .set({ deletedAt: now })
      .where(and(eq(wikiChapters.id, id), isNull(wikiChapters.deletedAt)))
      .returning({ id: wikiChapters.id });
    if (rows[0]) {
      await tx
        .update(wikiPages)
        .set({ deletedAt: now })
        .where(and(eq(wikiPages.chapterId, id), isNull(wikiPages.deletedAt)));
    }
  });
}

export async function restoreChapter(id: number): Promise<boolean> {
  // Atomic (#6): validate + restore chapter and its pages together.
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ deletedAt: wikiChapters.deletedAt, bookId: wikiChapters.bookId })
      .from(wikiChapters)
      .where(and(eq(wikiChapters.id, id), isNotNull(wikiChapters.deletedAt)));
    if (!existing?.deletedAt) return false;
    // Don't restore into a deleted book - that would orphan the chapter.
    const [book] = await tx
      .select({ deletedAt: wikiBooks.deletedAt })
      .from(wikiBooks)
      .where(eq(wikiBooks.id, existing.bookId));
    if (book?.deletedAt) return false;
    const ts = existing.deletedAt;
    await tx
      .update(wikiChapters)
      .set({ deletedAt: sql`NULL` })
      .where(eq(wikiChapters.id, id));
    await tx
      .update(wikiPages)
      .set({ deletedAt: sql`NULL` })
      .where(and(eq(wikiPages.chapterId, id), eq(wikiPages.deletedAt, ts)));
    return true;
  });
}

export async function permanentDeleteChapter(id: number) {
  await db
    .delete(wikiChapters)
    .where(and(eq(wikiChapters.id, id), isNotNull(wikiChapters.deletedAt)));
}

export async function getDeletedChapters() {
  return db
    .select({
      id: wikiChapters.id,
      bookId: wikiChapters.bookId,
      slug: wikiChapters.slug,
      title: wikiChapters.title,
      description: wikiChapters.description,
      sortOrder: wikiChapters.sortOrder,
      deletedAt: wikiChapters.deletedAt,
      bookTitle: wikiBooks.title,
    })
    .from(wikiChapters)
    .innerJoin(wikiBooks, eq(wikiChapters.bookId, wikiBooks.id))
    .where(isNotNull(wikiChapters.deletedAt))
    .orderBy(desc(wikiChapters.deletedAt));
}

// --- Admin CRUD: Pages ---

export async function getPageById(id: number) {
  const rows = await db
    .select({
      id: wikiPages.id,
      bookId: wikiPages.bookId,
      chapterId: wikiPages.chapterId,
      slug: wikiPages.slug,
      title: wikiPages.title,
      content: wikiPages.content,
      summary: wikiPages.summary,
      authorNote: wikiPages.authorNote,
      tags: wikiPages.tags,
      sortOrder: wikiPages.sortOrder,
      viewCount: wikiPages.viewCount,
    })
    .from(wikiPages)
    .where(and(eq(wikiPages.id, id), isNull(wikiPages.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createPage(data: CreatePage) {
  const rows = await db
    .insert(wikiPages)
    .values(data)
    .returning({
      id: wikiPages.id,
      bookId: wikiPages.bookId,
      chapterId: wikiPages.chapterId,
      slug: wikiPages.slug,
      title: wikiPages.title,
      content: wikiPages.content,
      summary: wikiPages.summary,
      authorNote: wikiPages.authorNote,
      tags: wikiPages.tags,
      sortOrder: wikiPages.sortOrder,
    });
  return rows[0];
}

export async function updatePage(id: number, data: UpdatePage) {
  const rows = await db
    .update(wikiPages)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(wikiPages.id, id), isNull(wikiPages.deletedAt)))
    .returning({
      id: wikiPages.id,
      bookId: wikiPages.bookId,
      chapterId: wikiPages.chapterId,
      slug: wikiPages.slug,
      title: wikiPages.title,
      content: wikiPages.content,
      summary: wikiPages.summary,
      authorNote: wikiPages.authorNote,
      tags: wikiPages.tags,
      sortOrder: wikiPages.sortOrder,
    });
  return rows[0] ?? null;
}

export async function softDeletePage(id: number) {
  await db
    .update(wikiPages)
    .set({ deletedAt: new Date() })
    .where(and(eq(wikiPages.id, id), isNull(wikiPages.deletedAt)));
}

export async function restorePage(id: number): Promise<boolean> {
  const [page] = await db
    .select({ bookId: wikiPages.bookId, chapterId: wikiPages.chapterId })
    .from(wikiPages)
    .where(and(eq(wikiPages.id, id), isNotNull(wikiPages.deletedAt)));
  if (!page) return false;
  // Don't restore into a deleted book/chapter - that would orphan the page.
  const [book] = await db
    .select({ deletedAt: wikiBooks.deletedAt })
    .from(wikiBooks)
    .where(eq(wikiBooks.id, page.bookId));
  if (book?.deletedAt) return false;
  if (page.chapterId != null) {
    const [chapter] = await db
      .select({ deletedAt: wikiChapters.deletedAt })
      .from(wikiChapters)
      .where(eq(wikiChapters.id, page.chapterId));
    if (chapter?.deletedAt) return false;
  }
  await db
    .update(wikiPages)
    .set({ deletedAt: sql`NULL` })
    .where(eq(wikiPages.id, id));
  return true;
}

export async function permanentDeletePage(id: number) {
  await db
    .delete(wikiPages)
    .where(and(eq(wikiPages.id, id), isNotNull(wikiPages.deletedAt)));
}

export async function getDeletedPages() {
  return db
    .select({
      id: wikiPages.id,
      bookId: wikiPages.bookId,
      chapterId: wikiPages.chapterId,
      slug: wikiPages.slug,
      title: wikiPages.title,
      summary: wikiPages.summary,
      sortOrder: wikiPages.sortOrder,
      deletedAt: wikiPages.deletedAt,
      bookTitle: wikiBooks.title,
    })
    .from(wikiPages)
    .innerJoin(wikiBooks, eq(wikiPages.bookId, wikiBooks.id))
    .where(isNotNull(wikiPages.deletedAt))
    .orderBy(desc(wikiPages.deletedAt));
}

export async function bulkImportPages(
  bookId: number,
  chapterId: number | null | undefined,
  pages: { title: string; slug: string; content?: string | null; summary?: string | null; tags?: string[] | null; sortOrder: number }[],
) {
  const values = pages.map((p) => ({
    bookId,
    chapterId: chapterId ?? null,
    title: p.title,
    slug: p.slug,
    content: p.content ?? null,
    summary: p.summary ?? null,
    tags: p.tags ?? null,
    sortOrder: p.sortOrder,
  }));
  return db
    .insert(wikiPages)
    .values(values)
    .returning({
      id: wikiPages.id,
      bookId: wikiPages.bookId,
      chapterId: wikiPages.chapterId,
      slug: wikiPages.slug,
      title: wikiPages.title,
      sortOrder: wikiPages.sortOrder,
    });
}
