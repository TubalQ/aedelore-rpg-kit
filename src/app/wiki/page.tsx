import Link from "next/link";
import { getBooks, getRecentPages } from "@/lib/db/queries/wiki";
import { T } from "@/components/ui/t";
import { TimeAgo } from "@/components/ui/time-ago";
import { loadActiveSystem } from "@/systems/load";
import { auth } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

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
            <Link
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
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl text-accent-gold">{theme.name} Wiki</h1>
        {isAdmin && (
          <Link
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
              <Link
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

      <h2 className="font-display text-lg text-text-base mb-4"><T k="wiki.books" /></h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {books.map((book) => (
          <Link
            key={book.id}
            href={`/wiki/${book.slug}`}
            className="group block p-6 bg-bg-surface border border-border rounded-lg hover:border-accent-gold/40 transition-colors"
          >
            <h3 className="font-display text-lg text-text-base group-hover:text-accent-gold transition-colors">
              {book.title}
            </h3>
            {book.description && (
              <p className="mt-2 text-sm text-text-muted line-clamp-3">{book.description}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
