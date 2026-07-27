import { NextRequest, NextResponse } from "next/server";
import { getPageBySlug } from "@/lib/db/queries/wiki";

type Params = { params: Promise<{ slug: string; pageSlug: string }> };

// Publik läsning: en specifik sidas fulla innehåll via bok-slug + sid-slug (icke-deletad).
// Backar MCP:ns read_wiki_page. Publikt via middleware (/api/wiki).
export async function GET(_req: NextRequest, { params }: Params) {
  const { slug, pageSlug } = await params;
  const page = await getPageBySlug(slug, pageSlug);
  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(page);
}
