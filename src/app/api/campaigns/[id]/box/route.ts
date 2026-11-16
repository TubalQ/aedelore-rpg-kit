import { NextRequest, NextResponse } from "next/server";
import { CampaignBoxActionSchema } from "@/lib/schemas/campaign";
import { StashQuestSchema } from "@/lib/schemas/stash";
import { createStashEntry, deleteStashEntry, getStashEntry, listStash } from "@/lib/db/queries/stash";
import { dmGiveEquipment, dmGiveItem } from "@/lib/db/queries/characters";
import { HttpError, parseBody, withApi } from "@/lib/api/route-helpers";
import { requireStashDm } from "@/lib/api/stash-auth";

// The original item-box API, kept for existing clients (the MCP box tools).
// The box IS the campaign stash now; see /api/campaigns/:id/stash.

type Params = { params: Promise<{ id: string }> };

export const GET = withApi(async (_req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const { campaignId } = await requireStashDm((await params).id);
  const entries = await listStash(campaignId);
  return NextResponse.json(entries.map(({ id, kind, data, sortOrder }) => ({ id, kind, data, sortOrder })));
});

export const POST = withApi(async (req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const { campaignId, userId } = await requireStashDm((await params).id);
  const action = await parseBody(req, CampaignBoxActionSchema);

  switch (action.action) {
    case "add": {
      const item = action.item;
      const row =
        item.kind === "quest"
          ? await createStashEntry(campaignId, "quest", StashQuestSchema.parse(item.quest))
          : await createStashEntry(campaignId, "equipment", item.equipment);
      return NextResponse.json(row);
    }
    case "remove": {
      const result = await deleteStashEntry(campaignId, action.id);
      if (result === "in_use") {
        throw new HttpError(409, "The entry is placed in a session or held by a character; remove it there first");
      }
      if (result === "not_found") throw new HttpError(404, "Not found");
      return NextResponse.json({ success: true });
    }
    case "handout": {
      // The entry stays in the stash; the character gets a linked copy.
      const entry = await getStashEntry(campaignId, action.id);
      if (!entry) throw new HttpError(404, "Not found");
      const result =
        entry.kind === "quest"
          ? await dmGiveItem(action.characterId, userId, campaignId, { ...StashQuestSchema.parse(entry.data), stashId: entry.id })
          : await dmGiveEquipment(action.characterId, userId, campaignId, { ...entry.data, stashId: entry.id });
      if (!result) throw new HttpError(404, "Character not found in this campaign");
      return NextResponse.json(result);
    }
  }
});
