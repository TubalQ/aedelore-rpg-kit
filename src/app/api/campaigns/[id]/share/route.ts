import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { generateShareCode, revokeShareCode } from "@/lib/db/queries/campaigns";

type Params = { params: Promise<{ id: string }> };

export async function POST(
  _req: NextRequest,
  { params }: Params,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const code = await generateShareCode(Number(id), session.user.id);
  if (!code) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ shareCode: code });
}

export async function DELETE(
  _req: NextRequest,
  { params }: Params,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const revoked = await revokeShareCode(Number(id), session.user.id);
  if (!revoked) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
