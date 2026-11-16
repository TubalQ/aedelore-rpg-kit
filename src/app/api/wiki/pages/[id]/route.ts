import { NextRequest, NextResponse } from "next/server";
import { getPageById } from "@/lib/db/queries/wiki";
import { toPublicWiki, viewerCanSeeGmContent } from "@/lib/wiki/public-view";
import { withApi, parseId } from "@/lib/api/route-helpers";

type Params = { params: Promise<{ id: string }> };

// Publik läsning: en wiki-sidas fulla innehåll via id (icke-deletad). Ligger under /api/wiki
// (publikt via proxy). Används av MCP:n för att hydrera sök-/listträffar med brödtext -
// sök-API:t returnerar bara metadata.
export const GET = withApi(async (_req: NextRequest, { params }: Params) => {
  const { id } = await params;
  const pageId = parseId(id);
  if (!Number.isInteger(pageId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }
  const page = await getPageById(pageId);
  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(toPublicWiki(page, await viewerCanSeeGmContent()));
});
