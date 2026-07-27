import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { CampaignBoxActionSchema } from "@/lib/schemas/campaign";
import {
  getCampaignBox,
  addCampaignBoxItem,
  removeCampaignBoxItem,
  getCampaignBoxItem,
} from "@/lib/db/queries/campaigns";
import { dmGiveItem, dmGiveEquipment } from "@/lib/db/queries/characters";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const campaignId = Number(id);
  if (Number.isNaN(campaignId)) {
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
  }
  const box = await getCampaignBox(campaignId, session.user.id);
  if (box === null) {
    return NextResponse.json({ error: "Not found or not DM" }, { status: 404 });
  }
  return NextResponse.json(box);
}

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const campaignId = Number(id);
  if (Number.isNaN(campaignId)) {
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = CampaignBoxActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userId = session.user.id;
  const data = parsed.data;
  let result: unknown = null;

  switch (data.action) {
    case "add": {
      const item = data.item;
      const payload = item.kind === "quest" ? item.quest : item.equipment;
      result = await addCampaignBoxItem(campaignId, userId, item.kind, payload as Record<string, unknown>);
      break;
    }
    case "remove":
      result = await removeCampaignBoxItem(campaignId, userId, data.id);
      break;
    case "handout": {
      // Mall: föremålet stannar i lådan; vi delar bara ut en kopia till karaktären
      // via samma kanoniska väg som DM-panelen (dedup på namn → idempotent).
      const boxItem = await getCampaignBoxItem(campaignId, userId, data.id);
      if (!boxItem) break;
      if (boxItem.kind === "quest") {
        const q = boxItem.data as { name: string; description?: string; sessionName?: string };
        result = await dmGiveItem(data.characterId, userId, campaignId, {
          name: q.name,
          description: q.description ?? "",
          sessionName: q.sessionName,
        });
      } else {
        result = await dmGiveEquipment(data.characterId, userId, campaignId, boxItem.data);
      }
      break;
    }
  }

  if (!result) {
    return NextResponse.json(
      { error: "Åtgärden misslyckades (hittades ej eller inte DM)" },
      { status: 404 },
    );
  }
  return NextResponse.json(result);
}
