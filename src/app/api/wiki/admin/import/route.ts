import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { BulkImportPageSchema } from "@/lib/schemas/wiki";
import { bulkImportPages } from "@/lib/db/queries/wiki";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = BulkImportPageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await bulkImportPages(
    parsed.data.bookId,
    parsed.data.chapterId,
    parsed.data.pages,
  );
  return NextResponse.json(result, { status: 201 });
}
