import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { SpendXpSchema } from "@/lib/schemas/character";
import { spendXp } from "@/lib/db/queries/characters";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const charId = Number(id);
  if (Number.isNaN(charId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = SpendXpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await spendXp(charId, session.user.id, parsed.data);
  if (!updated) {
    return NextResponse.json(
      { error: "Otillräckligt med XP, inga poäng angivna, eller karaktär hittades inte" },
      { status: 400 },
    );
  }

  return NextResponse.json(updated);
}
