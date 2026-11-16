import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookBySlug, getChaptersByBook, getPagesByBook } from "@/lib/db/queries/wiki";
import { loadActiveSystem } from "@/systems/load";
import { T } from "@/components/ui/t";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ bookSlug: string }> };

export async function generateMetadata({ params }: Props) {
  const { bookSlug } = await params;
  const [book, { theme }] = await Promise.all([getBookBySlug(bookSlug), loadActiveSystem()]);
  if (!book) return { title: `Not Found - ${theme.name} Wiki` };
  return { title: `${book.title} - ${theme.name} Wiki` };
}

export default async function BookPage({ params }: Props) {
  const { bookSlug } = await params;
  const book = await getBookBySlug(bookSlug);
  if (!book) notFound();

  const [chapters, pages] = await Promise.all([
    getChaptersByBook(book.id),
    getPagesByBook(book.id),
  ]);

  const uncategorized = pages.filter((p) => !p.chapterId);
  const pagesByChapter = new Map<number, typeof pages>();
  for (const page of pages) {
    if (!page.chapterId) continue;
    const list = pagesByChapter.get(page.chapterId) ?? [];
    list.push(page);
    pagesByChapter.set(page.chapterId, list);
  }

  return (
    <div>
      <div className="mb-10">
        <nav className="text-sm text-text-muted mb-4">
          <Link prefetch={false} href="/wiki" className="hover:text-accent-gold transition-colors">Wiki</Link>
          <span className="mx-2">›</span>
          <span className="text-text-base">{book.title}</span>
        </nav>
        {book.coverImage ? (
          <div className="relative overflow-hidden rounded-2xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={book.coverImage} alt="" className="h-44 w-full object-cover sm:h-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-base via-bg-base/55 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <h1 className="font-display text-4xl text-accent-gold drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{book.title}</h1>
              {book.description && (
                <p className="mt-2 max-w-2xl text-sm text-text-muted drop-shadow">{book.description}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="border-b border-border pb-6">
            <h1 className="font-display text-4xl text-accent-gold">{book.title}</h1>
            {book.description && (
              <p className="mt-2 max-w-2xl text-text-muted">{book.description}</p>
            )}
          </div>
        )}
      </div>

      {chapters.map((chapter) => {
        const chapterPages = pagesByChapter.get(chapter.id) ?? [];
        return (
          <section key={chapter.id} className="mb-8">
            <h2 className="font-display text-xl text-text-base border-b border-border pb-2 mb-4">
              {chapter.title}
            </h2>
            {chapter.description && (
              <p className="text-sm text-text-muted mb-4">{chapter.description}</p>
            )}
            {chapterPages.length > 0 ? (
              <PageGrid pages={chapterPages} bookSlug={bookSlug} />
            ) : (
              <p className="text-sm text-text-faint italic"><T k="wiki.noPagesInChapter" /></p>
            )}
          </section>
        );
      })}

      {uncategorized.length > 0 && (
        <section className="mb-8">
          {chapters.length > 0 && (
            <h2 className="font-display text-xl text-text-base border-b border-border pb-2 mb-4">
              <T k="wiki.otherPages" />
            </h2>
          )}
          <PageGrid pages={uncategorized} bookSlug={bookSlug} />
        </section>
      )}

      {pages.length === 0 && (
        <p className="text-text-muted py-8 text-center"><T k="wiki.noPagesInBook" /></p>
      )}
    </div>
  );
}

function PageGrid({ pages, bookSlug }: { pages: { slug: string; title: string; summary: string | null }[]; bookSlug: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {pages.map((page) => (
        <Link prefetch={false}
          key={page.slug}
          href={`/wiki/${bookSlug}/${page.slug}`}
          className="group block p-4 bg-bg-surface border border-border rounded-lg hover:border-accent-gold/40 transition-colors"
        >
          <h3 className="text-sm font-medium text-text-base group-hover:text-accent-gold transition-colors">
            {page.title}
          </h3>
          {page.summary && (
            <p className="mt-1 text-xs text-text-muted line-clamp-2">{page.summary}</p>
          )}
        </Link>
      ))}
    </div>
  );
}
