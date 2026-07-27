import { NextResponse } from "next/server";
import { getBooks } from "@/lib/db/queries/wiki";

export async function GET(): Promise<NextResponse> {
  const books = await getBooks();
  return NextResponse.json(books);
}
