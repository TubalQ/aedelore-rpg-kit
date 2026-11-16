import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { restoreChapter, permanentDeleteChapter } from "@/lib/db/queries/wiki";
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
  const ok = await restoreChapter(parseId(id));
  if (!ok) {
    return NextResponse.json(
      { error: "Kapitlet hör till en raderad bok - återställ boken först." },
      { status: 409 },
    );
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
  await permanentDeleteChapter(parseId(id));
  return new NextResponse(null, { status: 204 });
});
