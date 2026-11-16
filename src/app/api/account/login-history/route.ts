import { NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { getLoginHistory } from "@/lib/db/queries/users";
import { withApi } from "@/lib/api/route-helpers";

export const GET = withApi(async (): Promise<NextResponse> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const history = await getLoginHistory(session.user.id);

  return NextResponse.json(history);
});
