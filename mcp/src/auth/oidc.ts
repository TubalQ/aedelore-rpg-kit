import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { logger } from "../logger.js";

interface OidcConfig {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  [key: string]: unknown;
}

interface OidcCacheEntry {
  config: OidcConfig;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const configCache = new Map<string, OidcCacheEntry>();
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/**
 * Fetch and cache the OpenID Connect discovery document.
 */
export async function discoverOidc(issuerUrl: string): Promise<OidcConfig> {
  const cached = configCache.get(issuerUrl);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.config;
  }

  const url = issuerUrl.replace(/\/+$/, "") + "/.well-known/openid-configuration";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OIDC discovery failed: ${res.status} ${res.statusText}`);
  }

  const config = (await res.json()) as OidcConfig;
  configCache.set(issuerUrl, { config, fetchedAt: Date.now() });

  return config;
}

/**
 * Validate a JWT using the issuer's JWKS endpoint.
 * Returns the decoded payload on success, null on failure.
 */
export async function validateJwt(
  token: string,
  issuerUrl: string,
  clientId: string,
): Promise<JWTPayload | null> {
  try {
    const config = await discoverOidc(issuerUrl);

    let jwks = jwksCache.get(config.jwks_uri);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(config.jwks_uri));
      jwksCache.set(config.jwks_uri, jwks);
    }

    const { payload } = await jwtVerify(token, jwks, {
      issuer: issuerUrl,
    });

    // Bind token till DENNA klient. Pocket-ID lägger klient-id i `aud` (och/eller `azp`),
    // INTE resurs-URL:en, så äkta resurs-audience-binding (RFC 8707) är inte möjlig här -
    // client_id-bindning mot en enda konfidentiell klient är den korrekta gränsen i detta setup.
    // Signatur + issuer verifieras redan av jwtVerify (jose, JWKS → inget alg:none).
    const azp = payload.azp as string | undefined;
    const aud = payload.aud;
    const audMatch =
      aud === clientId ||
      (Array.isArray(aud) && aud.includes(clientId)) ||
      azp === clientId;

    if (!audMatch) {
      logger.warn({ aud, azp, expected: clientId }, "[oidc] JWT aud/azp mismatch");
      return null;
    }

    return payload;
  } catch (err) {
    logger.warn({ err }, "[oidc] JWT validation failed");
    return null;
  }
}

export interface TokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  [key: string]: unknown;
}

/**
 * Exchange an authorization code for tokens at the Keycloak token endpoint.
 */
export async function exchangeCode(
  issuerUrl: string,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const config = await discoverOidc(issuerUrl);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const res = await fetch(config.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return (await res.json()) as TokenResponse;
}
