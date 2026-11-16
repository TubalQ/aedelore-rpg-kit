import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { JoinCampaignSchema } from "@/lib/schemas/campaign";
import { joinCampaign } from "@/lib/db/queries/campaigns";
import { withApi, readJson, codedError } from "@/lib/api/route-helpers";

export const POST = withApi(async (req: NextRequest): Promise<NextResponse> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJson(req);
  const parsed = JoinCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await joinCampaign(parsed.data.shareCode, session.user.id, parsed.data.characterId);
  if ("code" in result) {
    return codedError(400, result.code, result.params);
  }

  return NextResponse.json(result);
});
