import { NextRequest, NextResponse } from "next/server";
import { getPageById } from "@/lib/db/queries/wiki";

type Params = { params: Promise<{ id: string }> };

// Publik läsning: en wiki-sidas fulla innehåll via id (icke-deletad). Ligger under /api/wiki
// (publikt via middleware). Används av MCP:n för att hydrera sök-/listträffar med brödtext -
// sök-API:t returnerar bara metadata.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const pageId = Number(id);
  if (!Number.isInteger(pageId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }
  const page = await getPageById(pageId);
  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(page);
}
