import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

// Uppladdning av karaktärsporträtt. Kräver inloggning (vem som helst får ladda upp
// sin egen bild); filen namnges slumpmässigt och sparas i det bind-mountade
// uploads-trädet. Klienten sparar den returnerade URL:en i character.data.avatarImage
// via den vanliga PATCH-vägen - den här endpointen rör inte databasen.

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: "File too large. Maximum size is 5MB" }, { status: 400 });
  }

  const ext = EXT_MAP[file.type];
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const random = Math.random().toString(36).substring(2, 12);
  const filename = `char-${now.getTime()}-${random}.${ext}`;

  const uploadDir = join(process.cwd(), "public", "uploads", "images", "character", month);
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(uploadDir, filename), buffer);

  // Serveras via den dynamiska /api/media-routen (inte statiska /uploads/) så en
  // nyss uppladdad bild syns direkt, utan Next:s 404-negativcache (~300s).
  return NextResponse.json(
    { url: `/api/media/images/character/${month}/${filename}` },
    { status: 201 },
  );
}
