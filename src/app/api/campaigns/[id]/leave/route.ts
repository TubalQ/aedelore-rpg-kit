import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { leaveCampaign } from "@/lib/db/queries/campaigns";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(
  _req: NextRequest,
  { params }: Params,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const left = await leaveCampaign(Number(id), session.user.id);
  if (!left) {
    return NextResponse.json({ error: "Not a member of this campaign" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
