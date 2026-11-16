import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { restoreBook, permanentDeleteBook } from "@/lib/db/queries/wiki";
import { withApi, parseId } from "@/lib/api/route-helpers";

type Params = { params: Promise<{ id: string }> };

export const POST = withApi(async (_req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const ok = await restoreBook(parseId(id));
  if (!ok) {
    return NextResponse.json({ error: "Boken kunde inte återställas." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
});

export const DELETE = withApi(async (_req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await permanentDeleteBook(parseId(id));
  return new NextResponse(null, { status: 204 });
});
