import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { db } from "@/lib/db/client";
import { frontendErrors } from "@/lib/db/schema";
import { z } from "zod";

const ErrorReportSchema = z.object({
  errorType: z.string().max(50),
  message: z.string().max(2000),
  stack: z.string().max(10000).nullable().optional(),
  url: z.string().max(2000),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ErrorReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { errorType, message, stack, url } = parsed.data;

  await db.insert(frontendErrors).values({
    userId: session?.user?.id ?? null,
    errorType,
    message,
    stack: stack ?? null,
    url,
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
