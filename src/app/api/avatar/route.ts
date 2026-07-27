import { createAvatar, type Style } from "@dicebear/core";
import {
  adventurer,
  avataaars,
  bottts,
  lorelei,
  micah,
  notionists,
  pixelArt,
  thumbs,
} from "@dicebear/collection";
import { getKind } from "@/lib/db/queries/system-data";

export const dynamic = "force-dynamic";

// Generates avatar SVGs locally from a seed (no external calls).
// The style comes from the active game system's theme (live, from the DB).
// Deterministic per seed → cached hard by the browser.
const STYLES = {
  adventurer,
  avataaars,
  bottts,
  lorelei,
  micah,
  notionists,
  pixelArt,
  thumbs,
} as unknown as Record<string, Style<{ seed?: string }>>;

export async function GET(req: Request): Promise<Response> {
  const seed = new URL(req.url).searchParams.get("seed") || "default";
  const theme = (await getKind("theme")) as { avatarStyle?: string } | null;
  const style = STYLES[theme?.avatarStyle ?? "adventurer"] ?? STYLES.adventurer;
  const svg = createAvatar(style, { seed }).toString();
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
