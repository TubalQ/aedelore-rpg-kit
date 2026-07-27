import { NextRequest, NextResponse } from "next/server";
import { WikiSearchParamsSchema } from "@/lib/schemas/wiki";
import { searchPages } from "@/lib/db/queries/wiki";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const obj = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = WikiSearchParamsSchema.safeParse(obj);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid search params", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const results = await searchPages(parsed.data);
  return NextResponse.json(results);
}
