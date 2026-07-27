import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/", "/login", "/register", "/wiki", "/api/auth", "/api/errors", "/api/wiki", "/api/avatar", "/api/media", "/api/game-data"];

function isPublic(pathname: string): boolean {
  return publicPaths.some((p) =>
    pathname === p || pathname.startsWith(p + "/")
  );
}

// In-memory rate limiter (resets on server restart, per-worker)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 300;
const RATE_WINDOW = 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 60 * 1000);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rate limit API endpoints
  if (pathname.startsWith("/api/")) {
    const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const hasSession =
    req.cookies.has("__Secure-authjs.session-token") ||
    req.cookies.has("authjs.session-token");

  const hasBearer = req.headers.get("authorization")?.startsWith("Bearer ");

  if (!hasSession && !hasBearer) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts|images|music|uploads).*)"],
};
