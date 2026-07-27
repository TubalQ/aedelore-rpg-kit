#!/usr/bin/env node
/**
 * Seed a system's wiki content into the database.
 *
 * Reads src/systems/<system>/content/wiki.json and inserts its books /
 * chapters / pages. Intended for a NEW deployment/system on a fresh DB.
 * Idempotent: books/chapters/pages whose slug already exists are skipped.
 *
 * Usage: NEXT_PUBLIC_ACTIVE_SYSTEM=<system> DATABASE_URL=... node scripts/seed-wiki.mjs
 *
 * Plain ESM (no TypeScript runtime needed) so it runs with `node` inside the
 * app image, which is what `npm run db:seed` does.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const system = process.env.NEXT_PUBLIC_ACTIVE_SYSTEM ?? "example";
const file = resolve(here, `../src/systems/${system}/content/wiki.json`);

if (!existsSync(file)) {
  console.log(`No wiki content to seed for system "${system}" (${file} not found).`);
  process.exit(0);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const content = JSON.parse(readFileSync(file, "utf8"));
const sql = postgres(DATABASE_URL);

async function main() {
  for (const [bi, book] of content.books.entries()) {
    const existingBook = await sql`
      SELECT id FROM wiki_books WHERE slug = ${book.slug} AND deleted_at IS NULL`;
    let bookId;
    if (existingBook.length > 0) {
      bookId = Number(existingBook[0].id);
      console.log(`= book ${book.slug} (exists)`);
    } else {
      const ins = await sql`
        INSERT INTO wiki_books (slug, title, description, sort_order)
        VALUES (${book.slug}, ${book.title}, ${book.description ?? null}, ${book.sortOrder ?? bi})
        RETURNING id`;
      bookId = Number(ins[0].id);
      console.log(`+ book ${book.slug}`);
    }

    const chapterIds = {};
    for (const [ci, ch] of (book.chapters ?? []).entries()) {
      const existingCh = await sql`
        SELECT id FROM wiki_chapters
        WHERE book_id = ${bookId} AND slug = ${ch.slug} AND deleted_at IS NULL`;
      if (existingCh.length > 0) {
        chapterIds[ch.slug] = Number(existingCh[0].id);
      } else {
        const ins = await sql`
          INSERT INTO wiki_chapters (book_id, slug, title, description, sort_order)
          VALUES (${bookId}, ${ch.slug}, ${ch.title}, ${ch.description ?? null}, ${ch.sortOrder ?? ci})
          RETURNING id`;
        chapterIds[ch.slug] = Number(ins[0].id);
        console.log(`  + chapter ${ch.slug}`);
      }
    }

    for (const [pi, pg] of book.pages.entries()) {
      const existingPg = await sql`
        SELECT id FROM wiki_pages
        WHERE book_id = ${bookId} AND slug = ${pg.slug} AND deleted_at IS NULL`;
      if (existingPg.length > 0) {
        console.log(`  = page ${pg.slug} (exists, skipped)`);
        continue;
      }
      const chapterId = pg.chapter ? chapterIds[pg.chapter] ?? null : null;
      await sql`
        INSERT INTO wiki_pages (book_id, chapter_id, slug, title, content, summary, tags, sort_order)
        VALUES (${bookId}, ${chapterId}, ${pg.slug}, ${pg.title}, ${pg.content},
                ${pg.summary ?? null}, ${pg.tags ?? []}, ${pg.sortOrder ?? pi})`;
      console.log(`  + page ${pg.slug}`);
    }
  }

  await sql.end();
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
