import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { removePlayer } from "@/lib/db/queries/campaigns";

type Params = { params: Promise<{ id: string; playerId: string }> };

export async function DELETE(
  _req: NextRequest,
  { params }: Params,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, playerId } = await params;
  const removed = await removePlayer(Number(id), playerId, session.user.id);
  if (!removed) {
    return NextResponse.json({ error: "Campaign or player not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
