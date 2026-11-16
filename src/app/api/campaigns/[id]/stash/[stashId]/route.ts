import { NextRequest, NextResponse } from "next/server";
import { HttpError, parseBody, withApi } from "@/lib/api/route-helpers";
import { requireStashEntry } from "@/lib/api/stash-auth";
import { StashEquipmentSchema, StashQuestSchema } from "@/lib/schemas/stash";
import { deleteStashEntry, updateStashEntry } from "@/lib/db/queries/stash";
import { z } from "zod";

type Params = { params: Promise<{ id: string; stashId: string }> };


const entryFrom = async (params: Params["params"]) => {
  const p = await params;
  return requireStashEntry(p.id, p.stashId);
};

// Editing the entry edits it everywhere: sessions and characters read their
// content from here.
export const PUT = withApi(async (req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const { campaignId, stashId, entry } = await entryFrom(params);
  const schema = entry.kind === "quest" ? StashQuestSchema : StashEquipmentSchema;
  const { data } = await parseBody(req, z.object({ data: schema }));
  const row = await updateStashEntry(campaignId, stashId, data);
  return NextResponse.json(row);
});

export const DELETE = withApi(async (_req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const { campaignId, stashId } = await entryFrom(params);
  const result = await deleteStashEntry(campaignId, stashId);
  if (result === "in_use") {
    throw new HttpError(409, "The entry is placed in a session or held by a character; remove it there first");
  }
  if (result === "not_found") throw new HttpError(404, "Stash entry not found");
  return NextResponse.json({ success: true });
});

