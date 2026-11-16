import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { canFollowCampaign } from "@/lib/db/queries/campaigns";
import { withApi, parseId } from "@/lib/api/route-helpers";
import { subscribeCampaign, type CampaignChange } from "@/lib/realtime/changes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const HEARTBEAT_MS = 25_000;

/**
 * Live updates for a campaign (#82), as server-sent events. Each event says
 * only which table changed ({"t": "characters"}); the page refetches what it
 * shows. Its DM and its players may follow it; the stream ends when a player
 * is removed or the campaign goes to the trash.
 */
export const GET = withApi(async (req: NextRequest, { params }: Params): Promise<Response> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;
  const campaignId = parseId(id);
  if (!(await canFollowCampaign(campaignId, userId))) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let cleanup = (): void => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (text: string): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup();
        }
      };

      const unsubscribe = await subscribeCampaign(campaignId, (change: CampaignChange) => {
        // Membership or the campaign itself changed: still allowed to follow?
        if (change.t === "campaign_players" || change.t === "campaign_bans" || change.t === "campaigns") {
          void canFollowCampaign(campaignId, userId).then((ok) => {
            if (!ok) {
              send(`event: gone\ndata: {}\n\n`);
              cleanup();
            } else {
              send(`data: ${JSON.stringify({ t: change.t })}\n\n`);
            }
          });
          return;
        }
        send(`data: ${JSON.stringify({ t: change.t })}\n\n`);
      });
      const heartbeat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      };
      req.signal.addEventListener("abort", () => cleanup());

      // Reconnect after 5 s if the connection drops; "ready" tells the page
      // to refetch once, for what changed while it was not listening.
      send(`retry: 5000\nevent: ready\ndata: {}\n\n`);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
