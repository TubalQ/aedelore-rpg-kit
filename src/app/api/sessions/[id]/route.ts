import { NextRequest, NextResponse } from "next/server";
import { SessionDataSchema, UpdateSessionSchema } from "@/lib/schemas/session";
import { sanitizeDataPatch } from "@/lib/schemas/tolerant";
import {
  getSessionById,
  updateSession,
  softDeleteSession,
} from "@/lib/db/queries/sessions";
import { HttpError, parseBody, parseId, requireApiUser, withApi } from "@/lib/api/route-helpers";

type Params = { params: Promise<{ id: string }> };

export const GET = withApi(async (_req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const user = await requireApiUser();
  const id = parseId((await params).id);
  const gameSession = await getSessionById(id, user.id);
  if (!gameSession) throw new HttpError(404, "Session not found");
  return NextResponse.json(gameSession);
});

export const PUT = withApi(async (req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const user = await requireApiUser();
  const id = parseId((await params).id);
  const { data, ...meta } = await parseBody(req, UpdateSessionSchema);

  // The data patch is merged into stored JSONB, so it is validated and
  // normalised with the same schema every read uses: unknown keys are refused
  // and every value is stored in the shape a later read returns.
  let dataPatch: Record<string, unknown> | undefined;
  if (data) {
    const result = sanitizeDataPatch(SessionDataSchema, data);
    if (!result.ok) {
      throw new HttpError(400, "Unknown session data keys", { unknownKeys: result.unknownKeys });
    }
    dataPatch = result.patch;
  }

  const updated = await updateSession(id, user.id, { ...meta, data: dataPatch });
  if (!updated) throw new HttpError(404, "Session not found or locked");
  return NextResponse.json(updated);
});

export const DELETE = withApi(async (_req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const user = await requireApiUser();
  const id = parseId((await params).id);
  const deleted = await softDeleteSession(id, user.id);
  if (deleted === "locked") throw new HttpError(409, "The session is locked. Unlock it before deleting it.");
  if (!deleted) throw new HttpError(404, "Session not found");
  return NextResponse.json({ success: true });
});
