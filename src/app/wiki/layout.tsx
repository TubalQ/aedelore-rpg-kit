import Link from "next/link";
import { getBooks } from "@/lib/db/queries/wiki";
import { WikiSearch } from "@/components/wiki/WikiSearch";
import { WikiBookMenu } from "@/components/wiki/WikiBookMenu";
import { WikiBackLink } from "@/components/wiki/WikiBackLink";

export const dynamic = "force-dynamic";

export default async function WikiLayout({ children }: { children: React.ReactNode }) {
  const books = await getBooks();

  return (
    <div className="min-h-screen bg-bg-base">
      <header className="border-b border-border bg-bg-surface/80 backdrop-blur-sm sticky top-0 z-30">
        {/* Mobil: två rader (nav-rad + fullbredds sökrad) - en enda h-14-rad
            fick inte plats under ~650px och tryckte ut sökfältet ur viewporten. */}
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center gap-x-3 gap-y-2 py-2 md:h-14 md:flex-nowrap md:gap-4 md:py-0">
          <WikiBackLink />
          <Link prefetch={false} href="/wiki" className="shrink-0 font-display text-xl text-accent-gold hover:text-accent-gold/80 transition-colors">
            Wiki
          </Link>
          <WikiBookMenu books={books.map((b) => ({ slug: b.slug, title: b.title }))} />
          <div className="order-last w-full md:order-none md:ml-auto md:w-72">
            <WikiSearch />
          </div>
        </div>
      </header>
      <main className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {children}
      </main>
    </div>
  );
}
