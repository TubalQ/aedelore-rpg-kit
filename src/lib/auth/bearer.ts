import { headers } from "next/headers";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { db } from "@/lib/db/client";
import { users, accounts } from "@/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";

// Bearer auth for the MCP server, which forwards the user's upstream access
// token to this API. Keycloak is the only trusted issuer (Pocket-ID was retired
// 2026-09). A token is accepted when:
//  - its signature verifies against the issuer's JWKS (jose: alg from the key,
//    no alg:none, unknown `kid` triggers one rate-limited JWKS refetch),
//  - `iss` is the Keycloak issuer and `exp` is present and in the future,
//  - `aud` or `azp` is one of our clients,
//  - `sub` is linked to a live user through an `accounts` row of the SAME
//    provider (so a subject from another issuer can never match).

const PROVIDER_ID = "keycloak";
const ISSUER = process.env.AUTH_KEYCLOAK_ISSUER;

// Clients whose tokens are accepted: the web app's and the MCP server's.
// Keycloak puts "account" in aud of every token in the realm, so accepting it
// (A9) let a token from any client in, e.g. admin-cli with direct grants. The
// authorized party (azp, the client that got the token) must be one of ours.
const ACCEPTED_CLIENTS = [
  process.env.AUTH_KEYCLOAK_ID,
  process.env.MCP_KEYCLOAK_CLIENT_ID,
].filter((c): c is string => Boolean(c));

const UPSTREAM_TIMEOUT_MS = 3000;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksFailedAt = 0;
const JWKS_RETRY_MS = 60_000;

async function getJwks(): Promise<ReturnType<typeof createRemoteJWKSet> | null> {
  if (jwks) return jwks;
  if (!ISSUER || Date.now() - jwksFailedAt < JWKS_RETRY_MS) return null;
  try {
    const res = await fetch(`${ISSUER}/.well-known/openid-configuration`, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`discovery ${res.status}`);
    const { jwks_uri } = (await res.json()) as { jwks_uri?: string };
    if (!jwks_uri) throw new Error("discovery without jwks_uri");
    jwks = createRemoteJWKSet(new URL(jwks_uri), {
      timeoutDuration: UPSTREAM_TIMEOUT_MS,
      cooldownDuration: 30_000,
      cacheMaxAge: 60 * 60 * 1000,
    });
    return jwks;
  } catch (e) {
    // Remember the failure so a dead issuer does not stall every request.
    jwksFailedAt = Date.now();
    console.error("[bearer] OIDC discovery failed", (e as Error).message);
    return null;
  }
}

export function audienceMatches(payload: JWTPayload): boolean {
  const azp = typeof payload.azp === "string" ? payload.azp : undefined;
  if (azp !== undefined) return ACCEPTED_CLIENTS.includes(azp);
  // No azp (not issued by Keycloak's token endpoint): one of our clients must
  // be the audience.
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  return audiences.some((a) => typeof a === "string" && ACCEPTED_CLIENTS.includes(a));
}

export interface BearerSession {
  user: {
    id: string;
    isAdmin: boolean;
  };
}

export async function bearerAuth(): Promise<BearerSession | null> {
  const authHeader = (await headers()).get("authorization");
  if (!authHeader?.startsWith("Bearer ") || !ISSUER) return null;
  const token = authHeader.slice(7);

  const keySet = await getJwks();
  if (!keySet) return null;

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, keySet, {
      issuer: ISSUER,
      requiredClaims: ["exp", "sub"],
    }));
  } catch (e) {
    console.warn("[bearer] token rejected", (e as Error).message);
    return null;
  }

  if (!audienceMatches(payload)) {
    console.warn("[bearer] aud/azp mismatch", { aud: payload.aud, azp: payload.azp });
    return null;
  }

  const [user] = await db
    .select({ id: users.id, isAdmin: users.isAdmin })
    .from(users)
    .innerJoin(accounts, eq(accounts.userId, users.id))
    .where(
      and(
        eq(accounts.provider, PROVIDER_ID),
        eq(accounts.providerAccountId, payload.sub as string),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!user) {
    console.warn("[bearer] no linked user for this Keycloak subject");
    return null;
  }

  return { user: { id: user.id, isAdmin: user.isAdmin ?? false } };
}
