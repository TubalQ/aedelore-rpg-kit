import { NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { getPlayerCampaignView } from "@/lib/db/queries/campaigns";
import { filterSessionForPlayer } from "@/lib/session/player-view";
import { withApi, parseId, codedError } from "@/lib/api/route-helpers";

type Params = { params: Promise<{ id: string }> };

export const GET = withApi(async (_req: Request, { params }: Params): Promise<NextResponse> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const campaignId = parseId(id);

  const view = await getPlayerCampaignView(campaignId, session.user.id);
  if (!view) {
    return codedError(404, "notCampaignMember");
  }

  const characterName = view.myCharacter?.name || null;

  const filteredSessions = view.sessions.map((s) => ({
    id: s.id,
    sessionNumber: s.sessionNumber,
    title: s.title,
    date: s.date,
    status: s.status,
    data: filterSessionForPlayer(s.data, characterName),
  }));

  return NextResponse.json({
    campaign: view.campaign,
    party: view.party,
    myCharacter: view.myCharacter,
    sessions: filteredSessions,
  });
});
