import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { UpdateCampaignSchema } from "@/lib/schemas/campaign";
import {
  getCampaignById,
  updateCampaign,
  softDeleteCampaign,
} from "@/lib/db/queries/campaigns";
import { withApi, parseId, readJson } from "@/lib/api/route-helpers";

type Params = { params: Promise<{ id: string }> };

export const GET = withApi(async (
  _req: NextRequest,
  { params }: Params,
): Promise<NextResponse> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const campaign = await getCampaignById(parseId(id), session.user.id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json(campaign);
});

export const PUT = withApi(async (
  req: NextRequest,
  { params }: Params,
): Promise<NextResponse> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJson(req);
  const parsed = UpdateCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id } = await params;
  const updated = await updateCampaign(parseId(id), session.user.id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
});

export const DELETE = withApi(async (
  _req: NextRequest,
  { params }: Params,
): Promise<NextResponse> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await softDeleteCampaign(parseId(id), session.user.id);
  if (!deleted) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
});
