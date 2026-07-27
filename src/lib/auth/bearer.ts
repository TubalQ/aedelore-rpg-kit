import { headers } from "next/headers";
import { db } from "@/lib/db/client";
import { users, accounts } from "@/lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";

const KEYCLOAK_ISSUER = process.env.AUTH_KEYCLOAK_ISSUER!;
const KEYCLOAK_CLIENT_ID = process.env.AUTH_KEYCLOAK_ID!;
// MCP-serverns Pocket-ID-klient (t.ex. "claude"). MCP forwardar användarens token till
// app-API:t; det tokenet bär aud/azp = denna klient, inte app-klienten (aedelore-app).
const MCP_CLIENT_ID = process.env.MCP_CLIENT_ID;

interface JwksKey {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n?: string;
  e?: string;
  x?: string;
  y?: string;
  crv?: string;
}

let jwksCache: { keys: JwksKey[]; fetchedAt: number } | null = null;
const JWKS_TTL = 60 * 60 * 1000;

async function getJwks(): Promise<JwksKey[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL) {
    return jwksCache.keys;
  }
  const wellKnown = await fetch(
    `${KEYCLOAK_ISSUER}/.well-known/openid-configuration`,
  );
  const { jwks_uri } = await wellKnown.json();
  const jwksRes = await fetch(jwks_uri);
  const { keys } = await jwksRes.json();
  jwksCache = { keys, fetchedAt: Date.now() };
  return keys;
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeJwtPayload(
  token: string,
): { header: Record<string, string>; payload: Record<string, unknown> } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(parts[0])),
    );
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(parts[1])),
    );
    return { header, payload };
  } catch {
    return null;
  }
}

async function importJwk(jwk: JwksKey): Promise<CryptoKey> {
  const alg = jwk.alg || "RS256";
  const algMap: Record<string, RsaHashedImportParams | EcKeyImportParams> = {
    RS256: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    RS384: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" },
    RS512: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
    ES256: { name: "ECDSA", namedCurve: "P-256" },
    ES384: { name: "ECDSA", namedCurve: "P-384" },
  };
  const params = algMap[alg];
  if (!params) throw new Error(`Unsupported algorithm: ${alg}`);
  return crypto.subtle.importKey("jwk", jwk as JsonWebKey, params, false, [
    "verify",
  ]);
}

async function verifyJwtSignature(token: string): Promise<boolean> {
  const decoded = decodeJwtPayload(token);
  if (!decoded) return false;

  const keys = await getJwks();
  const key = keys.find((k) => k.kid === decoded.header.kid);
  if (!key) return false;

  const parts = token.split(".");
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`) as Uint8Array<ArrayBuffer>;
  const signature = base64UrlDecode(parts[2]) as Uint8Array<ArrayBuffer>;

  const cryptoKey = await importJwk(key);
  const alg = key.alg || "RS256";

  if (alg.startsWith("RS")) {
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, data);
  }
  const hashMap: Record<string, string> = {
    ES256: "SHA-256",
    ES384: "SHA-384",
  };
  return crypto.subtle.verify(
    { name: "ECDSA", hash: hashMap[alg] || "SHA-256" },
    cryptoKey,
    signature,
    data,
  );
}

export interface BearerSession {
  user: {
    id: string;
    isAdmin: boolean;
  };
}

export async function bearerAuth(): Promise<BearerSession | null> {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const decoded = decodeJwtPayload(token);
  if (!decoded) return null;

  const { payload } = decoded;

  if (payload.iss !== KEYCLOAK_ISSUER) return null;

  const aud = payload.aud;
  const audiences = Array.isArray(aud) ? aud : [aud];
  const azp = payload.azp as string | undefined;
  // Godkänn app-klienten (session-tokens), "account" (Keycloak-arv) samt MCP-klienten.
  // Pocket-ID kan lägga klienten i aud ELLER azp - kolla båda.
  const acceptedClients = [KEYCLOAK_CLIENT_ID, "account", MCP_CLIENT_ID].filter(
    Boolean,
  ) as string[];
  const audMatch =
    audiences.some((a) => typeof a === "string" && acceptedClients.includes(a)) ||
    (azp !== undefined && acceptedClients.includes(azp));
  if (!audMatch) {
    console.warn("[bearer] aud/azp mismatch", { aud, azp, accepted: acceptedClients });
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) return null;

  // verifyJwtSignature kan kasta (t.ex. ohämtbar JWKS) - fånga så det blir 401, inte 500.
  let valid = false;
  try {
    valid = await verifyJwtSignature(token);
  } catch (e) {
    console.error("[bearer] signature verification error", (e as Error)?.message);
  }
  if (!valid) return null;

  const sub = payload.sub as string | undefined;
  if (!sub) return null;

  let [user] = await db
    .select({ id: users.id, isAdmin: users.isAdmin })
    .from(users)
    .where(and(eq(users.oidcSub, sub), isNull(users.deletedAt)))
    .limit(1);

  // Fallback: matcha Pocket-ID:s sub mot accounts-länkningen (samma källa som session-login).
  // users.oidc_sub kan vara inaktuell (importerad från gamla servern); accounts uppdateras vid login.
  if (!user) {
    [user] = await db
      .select({ id: users.id, isAdmin: users.isAdmin })
      .from(users)
      .innerJoin(accounts, eq(accounts.userId, users.id))
      .where(and(eq(accounts.providerAccountId, sub), isNull(users.deletedAt)))
      .limit(1);
  }

  if (!user) {
    console.warn("[bearer] no user for sub", sub);
    return null;
  }

  return {
    user: {
      id: user.id,
      isAdmin: user.isAdmin ?? false,
    },
  };
}
