import { NextRequest, NextResponse } from "next/server";
import { parseBody, withApi } from "@/lib/api/route-helpers";
import { requireStashDm } from "@/lib/api/stash-auth";
import { StashContentSchema } from "@/lib/schemas/stash";
import { createStashEntry, listStash } from "@/lib/db/queries/stash";

type Params = { params: Promise<{ id: string }> };


// The campaign stash (DM only): every entry with where it is placed and who holds it.
export const GET = withApi(async (_req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const { campaignId } = await requireStashDm((await params).id);
  return NextResponse.json(await listStash(campaignId));
});

export const POST = withApi(async (req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const { campaignId } = await requireStashDm((await params).id);
  const { kind, data } = await parseBody(req, StashContentSchema);
  const row = await createStashEntry(campaignId, kind, data);
  return NextResponse.json(row, { status: 201 });
});

