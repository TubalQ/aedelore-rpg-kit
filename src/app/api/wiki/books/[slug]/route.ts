import { NextRequest, NextResponse } from "next/server";
import {
  getBookBySlug,
  getChaptersByBook,
  getPagesByBook,
  getPagesByBookWithContent,
} from "@/lib/db/queries/wiki";
import { toPublicWiki, viewerCanSeeGmContent } from "@/lib/wiki/public-view";
import { withApi } from "@/lib/api/route-helpers";

type Params = { params: Promise<{ slug: string }> };

// Publik läsning: en bok som träd (metadata + kapitel + sidor). `?full=1` → sidorna
// inkluderar brödtext (för MCP:ns get_rules). Publikt via proxy (/api/wiki).
export const GET = withApi(async (req: NextRequest, { params }: Params) => {
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const full = req.nextUrl.searchParams.get("full") === "1";
  const [chapters, pages] = await Promise.all([
    getChaptersByBook(book.id),
    full ? getPagesByBookWithContent(book.id) : getPagesByBook(book.id),
  ]);
  const gm = await viewerCanSeeGmContent();
  return NextResponse.json({
    ...toPublicWiki(book, gm),
    chapters: chapters.map((c) => toPublicWiki(c, gm)),
    pages: pages.map((p) => toPublicWiki(p, gm)),
  });
});
