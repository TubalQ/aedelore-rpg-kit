import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { getCampaignPlayers } from "@/lib/db/queries/campaigns";

type Params = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  { params }: Params,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const players = await getCampaignPlayers(Number(id), session.user.id);
  if (!players) {
    return NextResponse.json({ error: "Campaign not found or not authorized" }, { status: 404 });
  }

  return NextResponse.json(players);
}
