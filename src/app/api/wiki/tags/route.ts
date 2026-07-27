import { NextResponse } from "next/server";
import { getAllTags } from "@/lib/db/queries/wiki";

export async function GET(): Promise<NextResponse> {
  const tags = await getAllTags();
  return NextResponse.json(tags);
}
