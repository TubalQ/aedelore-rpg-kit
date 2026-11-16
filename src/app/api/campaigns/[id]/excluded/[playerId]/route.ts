import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { liftExclusion } from "@/lib/db/queries/campaigns";
import { withApi, parseId } from "@/lib/api/route-helpers";

type Params = { params: Promise<{ id: string; playerId: string }> };

/** Lift an exclusion (L6): the player can join again with the share code. */
export const DELETE = withApi(async (_req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, playerId } = await params;
  const player = z.string().uuid().safeParse(playerId);
  if (!player.success) {
    return NextResponse.json({ error: "Campaign or player not found" }, { status: 404 });
  }
  const lifted = await liftExclusion(parseId(id), player.data, session.user.id);
  if (!lifted) {
    return NextResponse.json({ error: "Campaign or player not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
});
