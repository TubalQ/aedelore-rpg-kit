import { NextResponse } from "next/server";
import { getAllTags } from "@/lib/db/queries/wiki";
import { withApi } from "@/lib/api/route-helpers";

export const GET = withApi(async (): Promise<NextResponse> => {
  const tags = await getAllTags();
  return NextResponse.json(tags);
});
