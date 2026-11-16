// Small fixed-window limiter for individual routes (in-memory, per process).
// The global per-IP limit lives in proxy.ts; this is for routes that need
// a much tighter budget, such as the anonymous error-report endpoint.

export function createRateLimiter(limit: number, windowMs: number) {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return function isLimited(key: string): boolean {
    const now = Date.now();
    if (windows.size > 10_000) {
      for (const [k, w] of windows) if (now > w.resetAt) windows.delete(k);
    }
    const entry = windows.get(key);
    if (!entry || now > entry.resetAt) {
      windows.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }
    entry.count++;
    return entry.count > limit;
  };
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
