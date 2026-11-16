import type { NextRequest } from "next/server";
import sharp from "sharp";
import { CodedHttpError, HttpError } from "@/lib/api/http-error";

// Shared handling for image uploads (avatars, wiki images).
//  - The declared Content-Length is checked BEFORE the body is parsed, so an
//    oversized request is refused without being buffered in memory.
//  - The format is read from the file's own bytes (sharp), never from the
//    client-supplied MIME type.
//  - Every image is re-encoded to WebP with a size cap: metadata (EXIF, GPS) is
//    dropped, anything that is not a real image fails, and stored files stay small.

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "gif", "webp"]);
const MULTIPART_OVERHEAD = 64 * 1024;

export interface ProcessedImage {
  buffer: Buffer;
  extension: "webp";
}

export async function readImageUpload(
  req: NextRequest,
  options: { maxBytes: number; maxDimension: number; /** Keep GIF/WebP animation (A3: off for portraits). */ animated?: boolean },
): Promise<ProcessedImage> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  const maxMb = Math.round(options.maxBytes / 1024 / 1024);
  if (declared > options.maxBytes + MULTIPART_OVERHEAD) {
    throw new CodedHttpError(413, "imageTooLarge", { max: maxMb });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    throw new HttpError(400, "Expected a multipart form with a file");
  }
  if (!(file instanceof File)) throw new HttpError(400, "No file provided");
  if (file.size > options.maxBytes) {
    throw new CodedHttpError(413, "imageTooLarge", { max: maxMb });
  }

  const input = Buffer.from(await file.arrayBuffer());
  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    format = undefined;
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) {
    throw new CodedHttpError(400, "imageInvalid");
  }

  const animated = (options.animated ?? true) && (format === "gif" || format === "webp");
  // metadata() reads only the header. A file with a valid header and broken
  // pixel data (bad CRC, truncated) fails here, and that is the uploader's
  // file, not a server error.
  let buffer: Buffer;
  try {
    buffer = await sharp(input, { animated })
      .rotate()
      .resize({ width: options.maxDimension, height: options.maxDimension, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new CodedHttpError(400, "imageDamaged");
  }
  return { buffer, extension: "webp" };
}
