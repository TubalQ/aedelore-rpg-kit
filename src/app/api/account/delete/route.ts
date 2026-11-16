import { NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { anonymizeUser } from "@/lib/db/queries/users";
import { withApi } from "@/lib/api/route-helpers";

export const POST = withApi(async (): Promise<NextResponse> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await anonymizeUser(session.user.id);

  return NextResponse.json({ ok: true });
});
