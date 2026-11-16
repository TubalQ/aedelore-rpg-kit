import Link from "next/link";
import { getBooks, getRecentPages } from "@/lib/db/queries/wiki";
import { T } from "@/components/ui/t";
import { TimeAgo } from "@/components/ui/time-ago";
import { loadActiveSystem } from "@/systems/load";
import { auth } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

// Leather colour cycle for the book covers (see .wb-* in globals.css). Cycles
// across the shelf so books vary like real spines.
const LEATHERS = ["wb-ox", "wb-for", "wb-nav", "wb-aub", "wb-tan", "wb-sla"] as const;

export async function generateMetadata() {
  const { theme } = await loadActiveSystem();
  return { title: `Wiki - ${theme.name}` };
}

export default async function WikiIndexPage() {
  const [{ theme }, books, recentPages, session] = await Promise.all([
    loadActiveSystem(),
    getBooks(),
    getRecentPages(8),
    auth(),
  ]);
  const isAdmin = !!session?.user?.isAdmin;

  if (books.length === 0) {
    return (
      <div className="text-center py-20">
        <h1 className="font-display text-3xl text-accent-gold mb-4">{theme.name} Wiki</h1>
        {isAdmin ? (
          <>
            <p className="text-text-muted mb-6">
              Your wiki is empty. Create your first book and page right here in the browser -
              no files or commands needed.
            </p>
            <Link prefetch={false}
              href="/wiki-admin"
              className="inline-block rounded-md bg-accent-gold px-5 py-3 text-sm font-semibold text-bg-base transition-all hover:brightness-110"
            >
              Open the wiki editor
            </Link>
          </>
        ) : (
          <p className="text-text-muted"><T k="wiki.noBooks" /></p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-10 flex items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.22em] text-accent-gold/70">Codex</p>
          <h1 className="mt-1 font-display text-4xl text-accent-gold">{theme.name} Wiki</h1>
        </div>
        {isAdmin && (
          <Link prefetch={false}
            href="/wiki-admin"
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-accent-gold hover:text-accent-gold"
          >
            Manage wiki
          </Link>
        )}
      </div>

      {recentPages.length > 0 && (
        <section className="mb-10">
          <h2 className="font-display text-lg text-text-base mb-4"><T k="wiki.recentUpdates" /></h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recentPages.map((p) => (
              <Link prefetch={false}
                key={p.id}
                href={`/wiki/${p.bookSlug}/${p.slug}`}
                className="group block p-3 bg-bg-surface border border-border rounded-lg hover:border-accent-gold/40 transition-colors"
              >
                <p className="text-sm font-medium text-text-base group-hover:text-accent-gold transition-colors truncate">
                  {p.title}
                </p>
                <p className="text-[10px] text-text-faint mt-1 truncate">{p.bookTitle}</p>
                <p className="text-[10px] text-text-faint mt-0.5"><TimeAgo date={p.updatedAt} /></p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <h2 className="font-display text-lg text-text-base mb-6"><T k="wiki.books" /></h2>
      <div className="wiki-shelf grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
        {books.map((book, i) => (
          <Link prefetch={false}
            key={book.id}
            href={`/wiki/${book.slug}`}
            className={`wikibook group ${LEATHERS[i % LEATHERS.length]}`}
            title={book.title}
          >
            <span className="wikibook__block">
              <span className="wikibook__pages" />
              <span className="wikibook__cover">
                {book.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={book.coverImage} alt="" className="wikibook__art" />
                )}
              </span>
              <span className="wikibook__spine" />
              {book.coverImage ? (
                <span className="wikibook__cap">
                  <span className="wikibook__cap-title">{book.title}</span>
                </span>
              ) : (
                <>
                  <span className="wikibook__frame" />
                  <span className="wikibook__inner">
                    <span className="wikibook__orn" aria-hidden="true">❦</span>
                    <span className="wikibook__title">{book.title}</span>
                    <span className="wikibook__orn" aria-hidden="true">✦</span>
                  </span>
                </>
              )}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
