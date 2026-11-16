// In-process attempt limiter for the credentials sign-in and registration
// paths.
//
// This complements the Traefik `rate-auth` middleware rather than duplicating
// it. Traefik throttles per client IP and cannot see *which account* is being
// guessed, so a spread-out attack from many addresses walks straight past it.
// Here we can lock the targeted account itself.
//
// State is in-process and therefore resets when the container restarts, and
// would not be shared if the app were ever scaled to more than one instance.
// Both are acceptable for a single-container deployment; a restart-proof
// version needs a shared store (the app's Postgres would do). Traefik's IP
// limit remains the floor either way.

interface Bucket {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

const buckets = new Map<string, Bucket>();

/** Failures tolerated inside WINDOW_MS before the key locks. */
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const BASE_LOCK_MS = 60 * 1000;
const MAX_LOCK_MS = 60 * 60 * 1000;

// Keep the map from growing without bound under a sustained attack: entries
// that can no longer affect a decision are dropped on write.
const MAX_ENTRIES = 10_000;

function sweep(now: number): void {
  for (const [key, b] of buckets) {
    if (b.lockedUntil <= now && now - b.firstFailureAt > WINDOW_MS) {
      buckets.delete(key);
    }
  }
  if (buckets.size > MAX_ENTRIES) {
    // Still oversized: drop the oldest entries outright. Losing a counter can
    // only ever grant an extra attempt, never a false lockout.
    const sorted = [...buckets.entries()].sort(
      (a, b) => a[1].firstFailureAt - b[1].firstFailureAt,
    );
    for (const [key] of sorted.slice(0, buckets.size - MAX_ENTRIES)) {
      buckets.delete(key);
    }
  }
}

export interface LimitStatus {
  blocked: boolean;
  /** Seconds until the caller may try again; 0 when not blocked. */
  retryAfter: number;
}

/**
 * Whether `key` is currently locked out. Call this BEFORE doing any password
 * hashing - the whole point is to avoid paying ~200 ms of scrypt for an
 * attempt we are going to refuse anyway.
 */
export function checkLimit(key: string): LimitStatus {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket) return { blocked: false, retryAfter: 0 };
  if (bucket.lockedUntil > now) {
    return { blocked: true, retryAfter: Math.ceil((bucket.lockedUntil - now) / 1000) };
  }
  return { blocked: false, retryAfter: 0 };
}

/** Record a failed attempt, locking the key once it runs out of tolerance. */
export function recordFailure(key: string): LimitStatus {
  const now = Date.now();
  sweep(now);

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.firstFailureAt > WINDOW_MS) {
    bucket = { failures: 0, firstFailureAt: now, lockedUntil: 0 };
    buckets.set(key, bucket);
  }

  bucket.failures += 1;

  if (bucket.failures >= MAX_FAILURES) {
    // Back off exponentially so a persistent guesser gets slower and slower,
    // while an ordinary user who mistypes twice is unaffected.
    const overshoot = bucket.failures - MAX_FAILURES;
    const lockMs = Math.min(BASE_LOCK_MS * 2 ** overshoot, MAX_LOCK_MS);
    bucket.lockedUntil = now + lockMs;
    return { blocked: true, retryAfter: Math.ceil(lockMs / 1000) };
  }

  return { blocked: false, retryAfter: 0 };
}

/** Clear a key after a successful sign-in. */
export function clearFailures(key: string): void {
  buckets.delete(key);
}

/** Test seam - not used in application code. */
export function __resetLimiter(): void {
  buckets.clear();
}
