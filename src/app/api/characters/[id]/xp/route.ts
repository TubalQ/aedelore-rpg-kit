import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { SpendXpSchema } from "@/lib/schemas/character";
import { spendXp } from "@/lib/db/queries/characters";
import { withApi, parseId, readJson, codedError } from "@/lib/api/route-helpers";

type Params = { params: Promise<{ id: string }> };

export const POST = withApi(async (req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const charId = parseId(id);

  const body = await readJson(req);
  const parsed = SpendXpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await spendXp(charId, session.user.id, parsed.data);
  if (!updated) {
    return codedError(400, "notEnoughXp");
  }

  return NextResponse.json(updated);
});
