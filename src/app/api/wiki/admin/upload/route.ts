import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { HttpError, requireApiUser, withApi } from "@/lib/api/route-helpers";
import { readImageUpload } from "@/lib/api/image-upload";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB upload; stored as WebP
const WIKI_IMAGE_DIMENSION = 2400;

export const POST = withApi(async (req: NextRequest): Promise<NextResponse> => {
  const user = await requireApiUser();
  if (!user.isAdmin) throw new HttpError(403, "Forbidden");
  const image = await readImageUpload(req, { maxBytes: MAX_SIZE, maxDimension: WIKI_IMAGE_DIMENSION });

  const filename = `wiki-${Date.now()}-${randomUUID().slice(0, 8)}.${image.extension}`;
  const uploadDir = join(process.cwd(), "public", "uploads", "wiki");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, filename), image.buffer);

  // Serve via the dynamic media route, not the static /uploads path. Next
  // negative-caches 404s for static files for ~300s, so a just-uploaded image
  // under /uploads/ would 404 until the cache expires; /api/media reads the
  // file from disk on every request, so it works immediately.
  return NextResponse.json({ url: `/api/media/wiki/${filename}` }, { status: 201 });
});
