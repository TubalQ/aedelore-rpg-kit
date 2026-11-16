import { after } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookBySlug, getPageBySlug, getPagesByBook, getChaptersByBook, incrementPageViewCount } from "@/lib/db/queries/wiki";
import { auth } from "@/lib/auth/config";
import { stripSpoilerContent } from "@/lib/wiki/spoilers";
import { loadActiveSystem } from "@/systems/load";
import { WikiContent } from "@/components/wiki/WikiContent";
import { WikiLightbox } from "@/components/wiki/WikiLightbox";
import { TableOfContents } from "@/components/wiki/TableOfContents";
import { FantasyTranslator } from "@/components/wiki/FantasyTranslator";
import { T } from "@/components/ui/t";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ bookSlug: string; pageSlug: string }> };

export async function generateMetadata({ params }: Props) {
  const { bookSlug, pageSlug } = await params;
  const [page, { theme }] = await Promise.all([getPageBySlug(bookSlug, pageSlug), loadActiveSystem()]);
  if (!page) return { title: `Not Found - ${theme.name} Wiki` };
  return { title: `${page.title} - ${theme.name} Wiki` };
}

export default async function WikiPageView({ params }: Props) {
  const { bookSlug, pageSlug } = await params;

  const [book, page] = await Promise.all([
    getBookBySlug(bookSlug),
    getPageBySlug(bookSlug, pageSlug),
  ]);

  if (!book || !page) notFound();

  // After the response (W15): an unawaited promise could be dropped, and a
  // failure was an unhandled rejection.
  after(() => incrementPageViewCount(bookSlug, pageSlug).catch((err: unknown) => console.error("[wiki] view count failed", err)));

  const [allPages, chapters, session] = await Promise.all([
    getPagesByBook(book.id),
    getChaptersByBook(book.id),
    auth(),
  ]);

  const canViewSpoilers = session?.user?.isAdmin === true;
  const content = page.content
    ? canViewSpoilers
      ? page.content
      : stripSpoilerContent(page.content)
    : null;

  const chapterTitle = page.chapterId
    ? chapters.find((c) => c.id === page.chapterId)?.title ?? null
    : null;

  // Prev/next traverse the whole book in reading order (chapter order, then
  // page order within each chapter), so navigation crosses chapter boundaries.
  const chapterRank = new Map(chapters.map((c, i) => [c.id, i]));
  const orderedPages = [...allPages].sort((a, b) => {
    const ca = a.chapterId != null ? chapterRank.get(a.chapterId) ?? Infinity : Infinity;
    const cb = b.chapterId != null ? chapterRank.get(b.chapterId) ?? Infinity : Infinity;
    if (ca !== cb) return ca - cb;
    return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);
  });
  const currentIndex = orderedPages.findIndex((p) => p.slug === page.slug);
  const prevPage = currentIndex > 0 ? orderedPages[currentIndex - 1] : null;
  const nextPage =
    currentIndex >= 0 && currentIndex < orderedPages.length - 1 ? orderedPages[currentIndex + 1] : null;

  return (
    <div className="flex gap-8">
      <div className="min-w-0 flex-1">
      <nav className="text-sm text-text-muted mb-6">
        <Link prefetch={false} href="/wiki" className="hover:text-accent-gold transition-colors">Wiki</Link>
        <span className="mx-2">&rsaquo;</span>
        <Link prefetch={false} href={`/wiki/${bookSlug}`} className="hover:text-accent-gold transition-colors">{book.title}</Link>
        {chapterTitle && (
          <>
            <span className="mx-2">&rsaquo;</span>
            <span className="text-text-muted">{chapterTitle}</span>
          </>
        )}
        <span className="mx-2">&rsaquo;</span>
        <span className="text-text-base">{page.title}</span>
      </nav>

      <article>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl text-accent-gold">{page.title}</h1>
          <FantasyTranslator />
        </div>

        {page.tags && page.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {page.tags.map((tag) => (
              <Link prefetch={false}
                key={tag}
                href={`/wiki/search?tag=${encodeURIComponent(tag)}`}
                className="px-2 py-0.5 text-xs bg-bg-elevated text-text-muted border border-border rounded hover:text-accent-gold hover:border-accent-gold/40 transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        {/* Hopfällbar TOC för mobil/platta - sidospalten är dold <lg */}
        <TableOfContents variant="inline" />

        {content ? (
          <WikiContent html={content} />
        ) : (
          <p className="text-text-muted italic"><T k="wiki.noContent" /></p>
        )}
        <WikiLightbox />
      </article>

      {(prevPage || nextPage) && (
        <nav className="mt-14 grid gap-4 border-t border-border pt-8 sm:grid-cols-2">
          {prevPage ? (
            <Link prefetch={false}
              href={`/wiki/${bookSlug}/${prevPage.slug}`}
              className="group rounded-lg border border-border bg-bg-surface p-4 transition-colors hover:border-accent-gold/40"
            >
              <span className="block text-xs text-text-faint">&larr; <T k="wiki.previous" /></span>
              <span className="mt-1 block font-display text-lg text-text-base transition-colors group-hover:text-accent-gold">{prevPage.title}</span>
            </Link>
          ) : <div className="hidden sm:block" />}
          {nextPage ? (
            <Link prefetch={false}
              href={`/wiki/${bookSlug}/${nextPage.slug}`}
              className="group rounded-lg border border-border bg-bg-surface p-4 text-right transition-colors hover:border-accent-gold/40"
            >
              <span className="block text-xs text-text-faint"><T k="wiki.next" /> &rarr;</span>
              <span className="mt-1 block font-display text-lg text-text-base transition-colors group-hover:text-accent-gold">{nextPage.title}</span>
            </Link>
          ) : <div className="hidden sm:block" />}
        </nav>
      )}
      </div>
      <TableOfContents />
    </div>
  );
}
