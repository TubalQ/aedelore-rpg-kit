import { NextRequest, NextResponse } from "next/server";
import { CharacterDataSchema, UpdateCharacterSchema } from "@/lib/schemas/character";
import { sanitizeDataPatch } from "@/lib/schemas/tolerant";
import {
  getCharacterForViewer,
  updateCharacter,
  softDeleteCharacter,
} from "@/lib/db/queries/characters";
import { CodedHttpError, HttpError, parseBody, parseId, requireApiUser, withApi } from "@/lib/api/route-helpers";

type Params = { params: Promise<{ id: string }> };

export const GET = withApi(async (_req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const user = await requireApiUser();
  const id = parseId((await params).id);
  const char = await getCharacterForViewer(id, user.id);
  if (!char) throw new HttpError(404, "Not found");
  return NextResponse.json(char);
});

export const PUT = withApi(async (req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const user = await requireApiUser();
  const id = parseId((await params).id);
  const { data, base, ...rest } = await parseBody(req, UpdateCharacterSchema);

  // Same schema as every read: unknown keys are refused, values are stored in
  // the shape a later read returns (no stray or legacy keys reach storage).
  let dataPatch: Record<string, unknown> | undefined;
  if (data) {
    const result = sanitizeDataPatch(CharacterDataSchema, data);
    if (!result.ok) {
      throw new HttpError(400, "Unknown character data keys", { unknownKeys: result.unknownKeys });
    }
    dataPatch = result.patch;
  }

  const result = await updateCharacter(id, user.id, { ...rest, data: dataPatch, base });
  if (!result.ok) {
    if (result.reason === "campaign_change") {
      throw new HttpError(409, "Leave the campaign before moving the character");
    }
    if (result.reason === "name_taken") throw new CodedHttpError(409, "nameTaken", { name: result.name.trim() });
    if (result.reason === "one_per_campaign") throw new HttpError(409, "You already have a character in this campaign");
    throw new HttpError(404, "Not found");
  }
  // Keys not written because they changed meanwhile (C2): only when there are any.
  return NextResponse.json(result.conflicts.length > 0 ? { ...result.character, conflicts: result.conflicts } : result.character);
});

export const DELETE = withApi(async (_req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const user = await requireApiUser();
  const id = parseId((await params).id);
  const deleted = await softDeleteCharacter(id, user.id);
  if (!deleted) throw new HttpError(404, "Not found");
  return NextResponse.json({ success: true });
});
