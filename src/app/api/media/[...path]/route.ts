import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, normalize, extname } from "path";

// Serverar uppladdad media dynamiskt ur det bind-mountade uploads-trädet.
// Anledning: Next 16:s statiska filservering (`next start`, public/) negativ-cachar
// 404-lookups i ~300s, så en NYSS uppladdad fil under /uploads/ 404:ar tills cachen
// släpper eller appen startas om - trasigt för spelar-uppladdade avatarer. Den här
// routen läser filen vid varje request → syns direkt. Publik (vitlistad i middleware.ts).

const ROOT = join(process.cwd(), "public", "uploads");

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path: segments } = await params;
  const rel = normalize(segments.join("/"));
  const filePath = join(ROOT, rel);

  // Traversal-skydd: den lösta sökvägen måste ligga kvar under ROOT.
  if (filePath !== ROOT && !filePath.startsWith(ROOT + "/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const type = CONTENT_TYPES[extname(filePath).toLowerCase()];
  if (!type) {
    return NextResponse.json({ error: "Unsupported media type" }, { status: 400 });
  }

  const buf = await readFile(filePath).catch(() => null);
  if (!buf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
