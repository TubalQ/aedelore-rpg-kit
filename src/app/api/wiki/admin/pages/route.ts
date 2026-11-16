import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { CreatePageSchema } from "@/lib/schemas/wiki";
import { createPage, getPagesByBook } from "@/lib/db/queries/wiki";
import { parseId, withApi, readJson } from "@/lib/api/route-helpers";

export const GET = withApi(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bookId = parseId(req.nextUrl.searchParams.get("bookId") ?? "", "bookId");

  const pages = await getPagesByBook(bookId);
  return NextResponse.json(pages);
});

export const POST = withApi(async (req: NextRequest) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await readJson(req);
  const parsed = CreatePageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await createPage(parsed.data);
  return NextResponse.json(result, { status: 201 });
});
