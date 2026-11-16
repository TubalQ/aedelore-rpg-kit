interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

const limits = new Map<string, RateLimitEntry>();

/**
 * Returns true if the IP is rate-limited (blocked).
 */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = limits.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    limits.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  if (entry.count > MAX_ATTEMPTS) {
    return true;
  }

  return false;
}

export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [ip, entry] of limits) {
    if (now - entry.windowStart > WINDOW_MS) {
      limits.delete(ip);
    }
  }
}

// Auto-cleanup interval
const cleanupTimer = setInterval(cleanupRateLimits, CLEANUP_INTERVAL_MS);
cleanupTimer.unref();
