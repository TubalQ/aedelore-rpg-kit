import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { CreateChapterSchema } from "@/lib/schemas/wiki";
import { createChapter, getChaptersByBook } from "@/lib/db/queries/wiki";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bookId = Number(req.nextUrl.searchParams.get("bookId"));
  if (!bookId || Number.isNaN(bookId)) {
    return NextResponse.json({ error: "bookId query param required" }, { status: 400 });
  }

  const chapters = await getChaptersByBook(bookId);
  return NextResponse.json(chapters);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CreateChapterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await createChapter(parsed.data);
  return NextResponse.json(result, { status: 201 });
}
