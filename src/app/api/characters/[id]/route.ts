import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { UpdateCharacterSchema } from "@/lib/schemas/character";
import {
  getCharacterForViewer,
  updateCharacter,
  softDeleteCharacter,
} from "@/lib/db/queries/characters";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const charId = Number(id);
  if (Number.isNaN(charId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const char = await getCharacterForViewer(charId, session.user.id);
  if (!char) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(char);
}

export async function PUT(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const charId = Number(id);
  if (Number.isNaN(charId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = UpdateCharacterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await updateCharacter(charId, session.user.id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const charId = Number(id);
  if (Number.isNaN(charId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const deleted = await softDeleteCharacter(charId, session.user.id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
