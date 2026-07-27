import { NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { softDeleteUser } from "@/lib/db/queries/users";

export async function POST(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await softDeleteUser(session.user.id);

  return NextResponse.json({ ok: true });
}
