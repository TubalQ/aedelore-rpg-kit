import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { CreatePageSchema } from "@/lib/schemas/wiki";
import { createPage, getPagesByBook } from "@/lib/db/queries/wiki";

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

  const pages = await getPagesByBook(bookId);
  return NextResponse.json(pages);
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
  const parsed = CreatePageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await createPage(parsed.data);
  return NextResponse.json(result, { status: 201 });
}
