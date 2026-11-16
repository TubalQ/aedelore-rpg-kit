import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type BinaryLike,
  type ScryptOptions,
} from "crypto";

// Password hashing on Node's built-in scrypt - no external dependency, works in
// any Node runtime.
//
// Format: "scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>". The cost parameters live in
// the string itself, so they can be raised later without locking anyone out:
// old hashes keep verifying with their own parameters, and needsRehash() tells
// the caller to re-hash on the next successful sign-in.
//
// Legacy format "scrypt$<saltHex>$<hashHex>" (no parameters) is still accepted
// and interpreted as Node's defaults, which is what it was written with.

// promisify() collapses scrypt to its three-argument overload and drops the
// options parameter, so the cost parameters below would not type-check through
// it. Wrapping the callback directly keeps them, and keeps the result typed as
// Buffer rather than any.
function scrypt(
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

const KEYLEN = 64;
const SALT_BYTES = 16;

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

// OWASP lists several equivalent-work scrypt profiles. The heaviest
// (N=2^17, r=8, p=1) costs 128 MiB per hash, which does not fit this
// container's 1 GiB cap once a handful of sign-ins overlap - it would turn
// login into an OOM lever. N=2^15/r=8/p=3 is the OWASP-equivalent profile that
// does fit: 32 MiB and ~200 ms per hash on this host, roughly five times the
// work of Node's defaults.
export const CURRENT_PARAMS: ScryptParams = { N: 32768, r: 8, p: 3 };

const LEGACY_PARAMS: ScryptParams = { N: 16384, r: 8, p: 1 };

// scrypt needs an explicit maxmem: Node's default cap is 32 MiB and any profile
// at or above that throws without this. 128*N*r is the algorithm's own
// requirement; double it for headroom.
function maxmemFor({ N, r }: ScryptParams): number {
  return 128 * N * r * 2;
}

async function derive(
  password: string,
  salt: Buffer,
  keylen: number,
  params: ScryptParams,
): Promise<Buffer> {
  return scrypt(password, salt, keylen, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: maxmemFor(params),
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await derive(password, salt, KEYLEN, CURRENT_PARAMS);
  const { N, r, p } = CURRENT_PARAMS;
  return `scrypt$${N}$${r}$${p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

interface ParsedHash {
  params: ScryptParams;
  salt: Buffer;
  expected: Buffer;
}

function parseHash(stored: string): ParsedHash | null {
  const parts = stored.split("$");
  if (parts[0] !== "scrypt") return null;

  // Legacy: scrypt$salt$hash
  if (parts.length === 3) {
    return {
      params: LEGACY_PARAMS,
      salt: Buffer.from(parts[1], "hex"),
      expected: Buffer.from(parts[2], "hex"),
    };
  }

  // Current: scrypt$N$r$p$salt$hash
  if (parts.length === 6) {
    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
    if (N < 2 || r < 1 || p < 1) return null;
    // Refuse absurd parameters from a tampered row rather than letting them
    // allocate unbounded memory.
    if (N > 1 << 20 || r > 32 || p > 16) return null;
    return {
      params: { N, r, p },
      salt: Buffer.from(parts[4], "hex"),
      expected: Buffer.from(parts[5], "hex"),
    };
  }

  return null;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  const { params, salt, expected } = parsed;
  if (salt.length === 0 || expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = await derive(password, salt, expected.length, params);
  } catch {
    // Malformed parameters that slipped past validation - treat as a failed
    // verification, never as a crash in the sign-in path.
    return false;
  }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** True when `stored` was made with weaker parameters than we now use. */
export function needsRehash(stored: string): boolean {
  const parsed = parseHash(stored);
  if (!parsed) return true;
  const { N, r, p } = parsed.params;
  return N < CURRENT_PARAMS.N || r < CURRENT_PARAMS.r || p < CURRENT_PARAMS.p;
}

// Cost of one verification, paid deliberately when no account matched, so that
// "unknown email" and "wrong password" take the same time. Without it the
// response time leaks which addresses are registered.
const DUMMY_HASH_PROMISE = hashPassword(randomBytes(32).toString("hex"));

export async function burnVerificationTime(password: string): Promise<void> {
  try {
    await verifyPassword(password, await DUMMY_HASH_PROMISE);
  } catch {
    // Never let the decoy affect the caller.
  }
}
