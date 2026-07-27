import { NextRequest, NextResponse } from "next/server";
import {
  getBookBySlug,
  getChaptersByBook,
  getPagesByBook,
  getPagesByBookWithContent,
} from "@/lib/db/queries/wiki";

type Params = { params: Promise<{ slug: string }> };

// Publik läsning: en bok som träd (metadata + kapitel + sidor). `?full=1` → sidorna
// inkluderar brödtext (för MCP:ns get_rules). Publikt via middleware (/api/wiki).
export async function GET(req: NextRequest, { params }: Params) {
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
  return NextResponse.json({ ...book, chapters, pages });
}
