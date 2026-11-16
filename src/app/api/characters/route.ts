import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { CreateCharacterSchema } from "@/lib/schemas/character";
import { getCharactersByUser, createCharacter } from "@/lib/db/queries/characters";
import { withApi, readJson, codedError } from "@/lib/api/route-helpers";

export const GET = withApi(async (): Promise<NextResponse> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chars = await getCharactersByUser(session.user.id);
  return NextResponse.json(chars);
});

export const POST = withApi(async (req: NextRequest): Promise<NextResponse> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJson(req);
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
    return codedError(403, "notCampaignMember");
  }
  if (char === "name_taken") {
    return codedError(409, "nameTaken", { name: parsed.data.name.trim() });
  }
  return NextResponse.json(char, { status: 201 });
});
