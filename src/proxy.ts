import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/", "/login", "/register", "/wiki", "/api/auth", "/api/errors", "/api/wiki", "/api/avatar", "/api/media", "/api/game-data", "/api/contracts"];

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

/**
 * The bucket a request counts against (A4). Requests through Traefik carry
 * x-real-ip and are limited per IP. The MCP server calls the app directly on
 * the loopback without it, so every MCP user shared one "unknown" bucket of
 * 300 a minute; those get one bucket per bearer token (that is, per user).
 * An outside client cannot dodge the IP limit by rotating tokens, because its
 * requests always come through Traefik with x-real-ip.
 */
function rateLimitKey(req: NextRequest): string {
  const ip = req.headers.get("x-real-ip");
  if (ip) return ip;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return `bearer:${createHash("sha256").update(auth.slice(7)).digest("hex").slice(0, 32)}`;
  return req.headers.get("x-forwarded-for") ?? "unknown";
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rate limit API endpoints
  if (pathname.startsWith("/api/")) {
    if (isRateLimited(rateLimitKey(req))) {
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
    // The query goes along (F5): an invite link /campaigns/join?code=... lost
    // its code on the way through sign-in.
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts|images|music|uploads).*)"],
};
