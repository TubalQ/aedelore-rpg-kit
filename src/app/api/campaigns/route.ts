import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { CreateCampaignSchema } from "@/lib/schemas/campaign";
import { getCampaignsByUser, createCampaign } from "@/lib/db/queries/campaigns";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await getCampaignsByUser(session.user.id);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CreateCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const campaign = await createCampaign(
    session.user.id,
    parsed.data.name,
    parsed.data.description,
  );
  return NextResponse.json(campaign, { status: 201 });
}
