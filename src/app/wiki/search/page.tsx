import Link from "next/link";
import { searchPages, getBooks } from "@/lib/db/queries/wiki";
import { T } from "@/components/ui/t";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata = { title: "Search - Aedelore Wiki" };

export default async function WikiSearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const tag = typeof sp.tag === "string" ? sp.tag.trim() : undefined;
  const bookIdRaw = typeof sp.bookId === "string" ? parseInt(sp.bookId, 10) : undefined;
  const bookId = bookIdRaw && !isNaN(bookIdRaw) ? bookIdRaw : undefined;

  const hasQuery = q.length > 0 || !!tag;

  const [results, books] = await Promise.all([
    hasQuery
      ? searchPages({ q, bookId, tag, limit: 50, offset: 0 })
      : Promise.resolve([]),
    getBooks(),
  ]);

  const bookMap = new Map(books.map((b) => [b.id, b]));

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-display text-2xl text-accent-gold mb-6">
        {tag ? (
          <T k="wiki.taggedWith" vars={{ tag }} />
        ) : q ? (
          <T k="wiki.resultsFor" vars={{ q }} />
        ) : (
          <T k="wiki.searchHeading" />
        )}
      </h1>

      {!hasQuery && (
        <p className="text-text-muted"><T k="wiki.searchPrompt" /></p>
      )}

      {hasQuery && results.length === 0 && (
        <p className="text-text-muted"><T k="wiki.noResults" /></p>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((page) => {
            const book = bookMap.get(page.bookId);
            return (
              <Link
                key={page.id}
                href={`/wiki/${book?.slug ?? "unknown"}/${page.slug}`}
                className="group block p-4 bg-bg-surface border border-border rounded-lg hover:border-accent-gold/40 transition-colors"
              >
                <div className="flex items-baseline gap-2">
                  <h2 className="text-sm font-medium text-text-base group-hover:text-accent-gold transition-colors">
                    {page.title}
                  </h2>
                  {book && (
                    <span className="text-xs text-text-faint">{book.title}</span>
                  )}
                </div>
                {page.summary && (
                  <p className="mt-1 text-xs text-text-muted line-clamp-2">{page.summary}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
