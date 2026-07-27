import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 5MB" },
      { status: 400 },
    );
  }

  const ext = EXT_MAP[file.type];
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const filename = `wiki-${timestamp}-${random}.${ext}`;

  const uploadDir = join(process.cwd(), "public", "uploads", "wiki");
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(uploadDir, filename), buffer);

  // Serve via the dynamic media route, not the static /uploads path. Next
  // negative-caches 404s for static files for ~300s, so a just-uploaded image
  // under /uploads/ would 404 until the cache expires; /api/media reads the
  // file from disk on every request, so it works immediately.
  return NextResponse.json({ url: `/api/media/wiki/${filename}` }, { status: 201 });
}
