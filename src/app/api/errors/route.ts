import { NextRequest, NextResponse } from "next/server";
import { lt } from "drizzle-orm";
import { z } from "zod";
import { apiAuth } from "@/lib/auth/api-auth";
import { db } from "@/lib/db/client";
import { frontendErrors } from "@/lib/db/schema";
import { HttpError, parseBody, withApi } from "@/lib/api/route-helpers";
import { clientIp, createRateLimiter } from "@/lib/api/rate-limit";

const ErrorReportSchema = z.object({
  errorType: z.string().max(50),
  message: z.string().max(2000),
  stack: z.string().max(10000).nullable().optional(),
  url: z.string().max(2000),
});

// The endpoint is public (errors happen before login too), so it gets its own
// tight per-IP budget, and old reports are pruned so the table cannot grow
// without bound.
const isLimited = createRateLimiter(10, 60_000);
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const PRUNE_EVERY_MS = 60 * 60 * 1000;
let lastPrune = 0;

async function pruneOldReports(): Promise<void> {
  if (Date.now() - lastPrune < PRUNE_EVERY_MS) return;
  lastPrune = Date.now();
  await db.delete(frontendErrors).where(lt(frontendErrors.createdAt, new Date(Date.now() - RETENTION_MS)));
}

export const POST = withApi(async (req: NextRequest): Promise<NextResponse> => {
  if (isLimited(clientIp(req))) throw new HttpError(429, "Too many error reports");
  const { errorType, message, stack, url } = await parseBody(req, ErrorReportSchema);
  const session = await apiAuth();

  await db.insert(frontendErrors).values({
    userId: session?.user?.id ?? null,
    errorType,
    message,
    stack: stack ?? null,
    url,
    userAgent: req.headers.get("user-agent"),
  });
  await pruneOldReports();

  return NextResponse.json({ ok: true });
});
