import { NextRequest, NextResponse } from "next/server";
import { HttpError, parseBody, withApi } from "@/lib/api/route-helpers";
import { GiveStashEntrySchema, StashQuestSchema } from "@/lib/schemas/stash";
import { dmGiveEquipment, dmGiveItem } from "@/lib/db/queries/characters";
import { requireStashEntry } from "@/lib/api/stash-auth";

type Params = { params: Promise<{ id: string; stashId: string }> };

// Hand a stash entry to a character in the campaign (the entry stays in the stash).
export const POST = withApi(async (req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const { campaignId, userId, stashId, entry } = await requireStashEntry((await params).id, (await params).stashId);
  const { characterId } = await parseBody(req, GiveStashEntrySchema);
  const result =
    entry.kind === "quest"
      ? await dmGiveItem(characterId, userId, campaignId, { ...StashQuestSchema.parse(entry.data), stashId })
      : await dmGiveEquipment(characterId, userId, campaignId, { ...entry.data, stashId });
  if (!result) throw new HttpError(404, "Character not found in this campaign");
  return NextResponse.json({ success: true });
});
