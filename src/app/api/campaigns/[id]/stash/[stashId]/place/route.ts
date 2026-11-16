import { NextRequest, NextResponse } from "next/server";
import { HttpError, parseBody, withApi } from "@/lib/api/route-helpers";
import { PlaceStashEntrySchema } from "@/lib/schemas/stash";
import { placeStashEntry } from "@/lib/db/queries/stash";
import { requireStashEntry } from "@/lib/api/stash-auth";

type Params = { params: Promise<{ id: string; stashId: string }> };

// Place a stash entry in one of the campaign's sessions.
export const POST = withApi(async (req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const { campaignId, stashId } = await requireStashEntry((await params).id, (await params).stashId);
  const placement = await parseBody(req, PlaceStashEntrySchema);
  const result = await placeStashEntry(campaignId, stashId, placement);
  if (result === "locked") throw new HttpError(409, "The session is locked");
  if (result === "not_found") throw new HttpError(404, "Session not found in this campaign");
  return NextResponse.json({ success: true }, { status: 201 });
});
