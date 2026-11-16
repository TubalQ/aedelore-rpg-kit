import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { readImageUpload } from "@/lib/api/image-upload";
import { CodedHttpError } from "@/lib/api/http-error";

function uploadRequest(bytes: Buffer, type = "image/png"): NextRequest {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(bytes)], "upload.png", { type }));
  return new NextRequest("http://localhost/api/characters/avatar", { method: "POST", body: form });
}

const OPTIONS = { maxBytes: 5 * 1024 * 1024, maxDimension: 512, animated: false };

async function validPng(): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 100, b: 50 } } })
    .png()
    .toBuffer();
}

describe("readImageUpload", () => {
  it("re-encodes a valid PNG to WebP", async () => {
    const result = await readImageUpload(uploadRequest(await validPng()), OPTIONS);
    expect(result.extension).toBe("webp");
    expect((await sharp(result.buffer).metadata()).format).toBe("webp");
  });

  it("rejects a PNG whose header is fine but whose pixel data is broken with 400, not 500", async () => {
    const png = await validPng();
    // Keep the signature and IHDR (so metadata() still reads it as PNG) and
    // garble the IDAT payload, the way a corrupted file or bad CRC looks.
    const idat = png.indexOf("IDAT");
    const broken = Buffer.from(png);
    for (let i = idat + 4; i < Math.min(idat + 40, broken.length - 12); i++) broken[i] = 0xff;
    expect((await sharp(broken).metadata()).format).toBe("png");

    const error = await readImageUpload(uploadRequest(broken), OPTIONS).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CodedHttpError);
    expect((error as CodedHttpError).status).toBe(400);
    expect((error as CodedHttpError).code).toBe("imageDamaged");
  });

  it("rejects bytes that are not an image with 400", async () => {
    const error = await readImageUpload(uploadRequest(Buffer.from("not an image")), OPTIONS).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CodedHttpError);
    expect((error as CodedHttpError).status).toBe(400);
    expect((error as CodedHttpError).code).toBe("imageInvalid");
  });

  it("rejects a file over the limit with 413 and the limit in MB", async () => {
    const error = await readImageUpload(uploadRequest(await validPng()), { ...OPTIONS, maxBytes: 100 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CodedHttpError);
    expect((error as CodedHttpError).status).toBe(413);
    expect((error as CodedHttpError).code).toBe("imageTooLarge");
  });
});
