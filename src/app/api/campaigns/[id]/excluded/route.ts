import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { getExcludedPlayers } from "@/lib/db/queries/campaigns";
import { withApi, parseId } from "@/lib/api/route-helpers";

type Params = { params: Promise<{ id: string }> };

/** The players the DM has removed and excluded from the campaign (L6). */
export const GET = withApi(async (_req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const excluded = await getExcludedPlayers(parseId(id), session.user.id);
  if (!excluded) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  return NextResponse.json(excluded);
});
