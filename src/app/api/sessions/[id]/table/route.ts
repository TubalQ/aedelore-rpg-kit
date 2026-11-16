import { NextRequest, NextResponse } from "next/server";
import { getSessionById } from "@/lib/db/queries/sessions";
import { getCampaignCharacters } from "@/lib/db/queries/campaigns";
import { buildTableView } from "@/lib/session/table";
import { HttpError, parseId, requireApiUser, withApi } from "@/lib/api/route-helpers";

type Params = { params: Promise<{ id: string }> };

// The table view of one session (see lib/session/table.ts): the active scene,
// what comes next, the party and the recent log. Same access as the session
// itself: the campaign's DM. `?scene=<encounter name>` picks another scene.
export const GET = withApi(async (req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const user = await requireApiUser();
  const id = parseId((await params).id);
  const gameSession = await getSessionById(id, user.id);
  if (!gameSession) throw new HttpError(404, "Session not found");

  const characters = (await getCampaignCharacters(gameSession.campaignId, user.id)) ?? [];
  const scene = req.nextUrl.searchParams.get("scene") ?? undefined;
  const view = buildTableView(gameSession.data, characters, scene);

  return NextResponse.json({
    session: {
      id: gameSession.id,
      campaignId: gameSession.campaignId,
      sessionNumber: gameSession.sessionNumber,
      title: gameSession.title,
      status: gameSession.status,
    },
    ...view,
  });
});
