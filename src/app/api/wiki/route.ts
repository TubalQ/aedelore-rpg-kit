import { NextResponse } from "next/server";
import { getBooks } from "@/lib/db/queries/wiki";
import { withApi } from "@/lib/api/route-helpers";

export const GET = withApi(async (): Promise<NextResponse> => {
  const books = await getBooks();
  return NextResponse.json(books);
});
