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
// An unreachable issuer must fail fast, not hang the authorize page or a tool call.
const UPSTREAM_TIMEOUT_MS = 5000;
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
  const res = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
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
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return (await res.json()) as TokenResponse;
}

/**
 * Refresh an access token at the upstream token endpoint (confidential client).
 */
/** The token endpoint answered with an error (as opposed to not answering at all). */
export class UpstreamTokenError extends Error {
  constructor(
    readonly status: number,
    readonly oauthError: string | undefined,
    body: string,
  ) {
    super(`Token refresh failed: ${status} ${body}`);
    this.name = "UpstreamTokenError";
  }
}

/**
 * What the client is told when a refresh fails (M1). Only an answer from the
 * provider saying the grant is bad means the refresh token is dead; a timeout,
 * a network error or a 5xx is temporary, and the client must keep its token
 * and try again instead of sending the user through a new sign-in.
 */
export function refreshFailure(err: unknown): { status: number; body: { error: string; error_description: string } } {
  if (err instanceof UpstreamTokenError && err.status >= 400 && err.status < 500) {
    return { status: 400, body: { error: "invalid_grant", error_description: "Refresh token expired or revoked" } };
  }
  return {
    status: 503,
    body: { error: "temporarily_unavailable", error_description: "The sign-in service did not answer. Try again shortly." },
  };
}

export async function refreshTokens(
  issuerUrl: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<TokenResponse> {
  const config = await discoverOidc(issuerUrl);
  const res = await fetch(config.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }).toString(),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text();
    let oauthError: string | undefined;
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object" && "error" in parsed && typeof parsed.error === "string") oauthError = parsed.error;
    } catch {
      // Not JSON (a proxy error page): the status decides.
      oauthError = undefined;
    }
    throw new UpstreamTokenError(res.status, oauthError, text);
  }
  return (await res.json()) as TokenResponse;
}
