import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { CreateSessionSchema } from "@/lib/schemas/session";
import { getSessionsByCampaign, createSession } from "@/lib/db/queries/sessions";
import { withApi, parseId, readJsonObject } from "@/lib/api/route-helpers";

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
  const sessions = await getSessionsByCampaign(parseId(id), session.user.id);
  return NextResponse.json(sessions);
});

export const POST = withApi(async (
  req: NextRequest,
  { params }: Params,
): Promise<NextResponse> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await readJsonObject(req);
  const parsed = CreateSessionSchema.safeParse({ ...body, campaignId: parseId(id) });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const created = await createSession(session.user.id, parseId(id), parsed.data);
  if (!created) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json(created, { status: 201 });
});
