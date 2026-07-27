import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { getCampaignCharacters } from "@/lib/db/queries/campaigns";

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
  const campaignId = Number(id);
  if (Number.isNaN(campaignId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const characters = await getCampaignCharacters(campaignId, session.user.id);
  if (characters === null) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json(characters);
}
