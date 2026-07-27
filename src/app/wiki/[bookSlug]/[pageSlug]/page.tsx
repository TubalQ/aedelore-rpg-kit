import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookBySlug, getPageBySlug, getPagesByBook, getChaptersByBook, incrementPageViewCount } from "@/lib/db/queries/wiki";
import { auth } from "@/lib/auth/config";
import { stripSpoilerContent } from "@/lib/wiki/spoilers";
import { WikiContent } from "@/components/wiki/WikiContent";
import { WikiLightbox } from "@/components/wiki/WikiLightbox";
import { TableOfContents } from "@/components/wiki/TableOfContents";
import { FantasyTranslator } from "@/components/wiki/FantasyTranslator";
import { T } from "@/components/ui/t";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ bookSlug: string; pageSlug: string }> };

export async function generateMetadata({ params }: Props) {
  const { bookSlug, pageSlug } = await params;
  const page = await getPageBySlug(bookSlug, pageSlug);
  if (!page) return { title: "Not Found - Aedelore Wiki" };
  return { title: `${page.title} - Aedelore Wiki` };
}

export default async function WikiPageView({ params }: Props) {
  const { bookSlug, pageSlug } = await params;

  const [book, page] = await Promise.all([
    getBookBySlug(bookSlug),
    getPageBySlug(bookSlug, pageSlug),
  ]);

  if (!book || !page) notFound();

  incrementPageViewCount(bookSlug, pageSlug);

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
        <Link href="/wiki" className="hover:text-accent-gold transition-colors">Wiki</Link>
        <span className="mx-2">&rsaquo;</span>
        <Link href={`/wiki/${bookSlug}`} className="hover:text-accent-gold transition-colors">{book.title}</Link>
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
              <Link
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
        <nav className="flex justify-between items-center mt-12 pt-6 border-t border-border">
          {prevPage ? (
            <Link
              href={`/wiki/${bookSlug}/${prevPage.slug}`}
              className="group text-sm text-text-muted hover:text-accent-gold transition-colors"
            >
              <span className="block text-xs text-text-faint"><T k="wiki.previous" /></span>
              <span className="group-hover:text-accent-gold">&larr; {prevPage.title}</span>
            </Link>
          ) : <div />}
          {nextPage ? (
            <Link
              href={`/wiki/${bookSlug}/${nextPage.slug}`}
              className="group text-sm text-text-muted hover:text-accent-gold transition-colors text-right"
            >
              <span className="block text-xs text-text-faint"><T k="wiki.next" /></span>
              <span className="group-hover:text-accent-gold">{nextPage.title} &rarr;</span>
            </Link>
          ) : <div />}
        </nav>
      )}
      </div>
      <TableOfContents />
    </div>
  );
}
