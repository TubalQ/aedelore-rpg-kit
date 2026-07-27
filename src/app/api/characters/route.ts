import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { CreateCharacterSchema } from "@/lib/schemas/character";
import { getCharactersByUser, createCharacter } from "@/lib/db/queries/characters";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chars = await getCharactersByUser(session.user.id);
  return NextResponse.json(chars);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CreateCharacterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const char = await createCharacter(
    session.user.id,
    parsed.data.name,
    parsed.data.campaignId,
  );
  if (!char) {
    return NextResponse.json(
      { error: "Du är inte medlem i den angivna kampanjen" },
      { status: 403 },
    );
  }
  return NextResponse.json(char, { status: 201 });
}
