import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { codedError, requireApiUser, withApi } from "@/lib/api/route-helpers";
import { readImageUpload } from "@/lib/api/image-upload";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

// Uppladdning av karaktärsporträtt. Kräver inloggning (vem som helst får ladda upp
// sin egen bild); filen namnges slumpmässigt och sparas i det bind-mountade
// uploads-trädet. Klienten sparar den returnerade URL:en i character.data.avatarImage
// via den vanliga PATCH-vägen - den här endpointen rör inte databasen.

const MAX_SIZE = 5 * 1024 * 1024; // 5MB upload; stored as a small WebP
const AVATAR_DIMENSION = 512;

// A3: uploads per user and hour. Each one is a file on the same disk as the
// database; a stuck client or a script must not fill it. Per process, like the
// API rate limit in proxy.ts.
const UPLOADS_PER_HOUR = 20;
const uploads = new Map<string, number[]>();

function allowUpload(userId: string): boolean {
  const now = Date.now();
  const recent = (uploads.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= UPLOADS_PER_HOUR) {
    uploads.set(userId, recent);
    return false;
  }
  recent.push(now);
  uploads.set(userId, recent);
  return true;
}

export const POST = withApi(async (req: NextRequest): Promise<NextResponse> => {
  const user = await requireApiUser();
  if (!allowUpload(user.id)) {
    return codedError(429, "uploadLimit");
  }
  // A portrait is a still image (A3): an animated one was kept whole, ~2.4 MB.
  const image = await readImageUpload(req, { maxBytes: MAX_SIZE, maxDimension: AVATAR_DIMENSION, animated: false });

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const filename = `char-${now.getTime()}-${randomUUID().slice(0, 12)}.${image.extension}`;

  const uploadDir = join(process.cwd(), "public", "uploads", "images", "character", month);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, filename), image.buffer);

  // Serveras via den dynamiska /api/media-routen (inte statiska /uploads/) så en
  // nyss uppladdad bild syns direkt, utan Next:s 404-negativcache (~300s).
  return NextResponse.json(
    { url: `/api/media/images/character/${month}/${filename}` },
    { status: 201 },
  );
});
