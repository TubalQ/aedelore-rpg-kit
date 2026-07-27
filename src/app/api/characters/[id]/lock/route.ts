import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { LockStepSchema } from "@/lib/schemas/character";
import { lockCharacterStep, getCharacterById } from "@/lib/db/queries/characters";

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
  const parsed = LockStepSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Lås är en kampanjfunktion: utanför kampanj får spelaren låsa/låsa upp
  // fritt, men i en kampanj är upplåsning DM:ns beslut (via control-endpointen).
  if (parsed.data.locked === false) {
    const character = await getCharacterById(charId, session.user.id);
    if (!character) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (character.campaignId != null) {
      return NextResponse.json(
        { error: "Only the DM can unlock steps while the character is in a campaign" },
        { status: 403 },
      );
    }
  }

  const updated = await lockCharacterStep(
    charId,
    session.user.id,
    parsed.data.step,
    parsed.data.locked,
  );
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
