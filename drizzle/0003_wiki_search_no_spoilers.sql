ALTER TABLE "wiki_pages" drop column "search_vector";--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(summary, '')), 'B') || setweight(to_tsvector('english', coalesce(regexp_replace(regexp_replace(content, '<div[^>]*?class="[^"]*?\mspoiler\M[^"]*"[^>]*>.*?</div>', ' ', 'gi'), '<[^>]+>', ' ', 'g'), '')), 'C')) STORED;--> statement-breakpoint
CREATE INDEX "idx_wiki_pages_search" ON "wiki_pages" USING gin ("search_vector");
