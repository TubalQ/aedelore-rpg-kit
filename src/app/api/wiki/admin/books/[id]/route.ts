import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { UpdateBookSchema } from "@/lib/schemas/wiki";
import { getBookById, updateBook, softDeleteBook } from "@/lib/db/queries/wiki";
import { withApi, parseId, readJson } from "@/lib/api/route-helpers";

type Params = { params: Promise<{ id: string }> };

export const GET = withApi(async (_req: NextRequest, { params }: Params) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const bookId = parseId(id);

  const book = await getBookById(bookId);
  if (!book) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(book);
});

export const PATCH = withApi(async (req: NextRequest, { params }: Params) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const bookId = parseId(id);

  const body = await readJson(req);
  const parsed = UpdateBookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await updateBook(bookId, parsed.data);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(result);
});

export const DELETE = withApi(async (_req: NextRequest, { params }: Params) => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const bookId = parseId(id);

  await softDeleteBook(bookId);
  return new NextResponse(null, { status: 204 });
});
