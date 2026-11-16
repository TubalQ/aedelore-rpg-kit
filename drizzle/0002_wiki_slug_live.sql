ALTER TABLE "wiki_books" DROP CONSTRAINT "wiki_books_slug_unique";--> statement-breakpoint
DROP INDEX "idx_wiki_chapters_book_slug";--> statement-breakpoint
DROP INDEX "idx_wiki_pages_book_slug";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_wiki_books_slug_live" ON "wiki_books" USING btree ("slug") WHERE "wiki_books"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_wiki_chapters_book_slug" ON "wiki_chapters" USING btree ("book_id","slug") WHERE "wiki_chapters"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_wiki_pages_book_slug" ON "wiki_pages" USING btree ("book_id","slug") WHERE "wiki_pages"."deleted_at" IS NULL;