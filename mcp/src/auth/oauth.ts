import { Router, type Request, type Response } from "express";
import { generatePkce, verifyPkce } from "./pkce.js";
import { checkRateLimit } from "./rate-limit.js";
import { discoverOidc, exchangeCode, validateJwt } from "./oidc.js";
import { logger } from "../logger.js";

export interface OAuthConfig {
  publicUrl: string;
  keycloakIssuerUrl: string;
  keycloakClientId: string;
  keycloakClientSecret: string;
  allowedRedirectHosts: string[];
}

// --- In-memory stores ---

interface AuthCodeEntry {
  token: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: number;
}

interface PkceStoreEntry {
  verifier: string;
  clientRedirectUri: string;
  clientState: string;
  codeChallenge: string;
  expiresAt: number;
}

const authCodes = new Map<string, AuthCodeEntry>();
const pkceStore = new Map<string, PkceStoreEntry>();

const CODE_TTL = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, entry] of authCodes) {
    if (now > entry.expiresAt) authCodes.delete(key);
  }
  for (const [key, entry] of pkceStore) {
    if (now > entry.expiresAt) pkceStore.delete(key);
  }
}

const cleanupTimer = setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

// --- Router ---

export function createOAuthRouter(config: OAuthConfig): Router {
  const router = Router();

  // RFC 8414 OAuth Authorization Server Metadata
  router.get("/.well-known/oauth-authorization-server", (_req: Request, res: Response) => {
    res.json({
      issuer: config.publicUrl,
      authorization_endpoint: config.publicUrl + "/mcp/oauth/authorize",
      token_endpoint: config.publicUrl + "/mcp/oauth/token",
      registration_endpoint: config.publicUrl + "/mcp/oauth/register",
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    });
  });

  // RFC 9728 Protected Resource Metadata
  router.get("/.well-known/oauth-protected-resource", (_req: Request, res: Response) => {
    res.json({
      resource: config.publicUrl + "/mcp",
      authorization_servers: [config.publicUrl],
      bearer_methods_supported: ["header"],
    });
  });

  // Dynamic Client Registration
  router.post("/mcp/oauth/register", async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const clientId = (body.client_id as string) || crypto.randomUUID();
      res.status(201).json({ ...body, client_id: clientId });
    } catch (err) {
      logger.warn({ err }, "[oauth] registration error");
      res.status(500).json({ error: "registration_failed" });
    }
  });

  // Authorization Endpoint
  router.get("/mcp/oauth/authorize", async (req: Request, res: Response) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      if (checkRateLimit(ip)) {
        res.status(429).json({ error: "rate_limited" });
        return;
      }

      const {
        client_id,
        redirect_uri,
        state,
        code_challenge,
        code_challenge_method,
        scope,
        response_type,
      } = req.query as Record<string, string>;

      // Validate required params
      if (!client_id || !redirect_uri || !code_challenge) {
        res.status(400).json({ error: "invalid_request", error_description: "Missing required parameters" });
        return;
      }

      if (code_challenge_method && code_challenge_method !== "S256") {
        res.status(400).json({ error: "invalid_request", error_description: "Only S256 code_challenge_method is supported" });
        return;
      }

      if (response_type && response_type !== "code") {
        res.status(400).json({ error: "unsupported_response_type" });
        return;
      }

      // Validate redirect_uri host + scheme
      try {
        const redirectUrl = new URL(redirect_uri);
        if (!config.allowedRedirectHosts.includes(redirectUrl.hostname)) {
          res.status(400).json({ error: "invalid_request", error_description: "Redirect URI host not allowed" });
          return;
        }
        // Kräv https (utom localhost för dev) - hindrar nedgradering till osäker callback.
        const isLocal =
          redirectUrl.hostname === "localhost" || redirectUrl.hostname === "127.0.0.1";
        if (redirectUrl.protocol !== "https:" && !isLocal) {
          res.status(400).json({ error: "invalid_request", error_description: "Redirect URI must use https" });
          return;
        }
      } catch {
        res.status(400).json({ error: "invalid_request", error_description: "Invalid redirect_uri" });
        return;
      }

      // Generate PKCE pair for the Keycloak leg
      const keycloakPkce = generatePkce();
      const oauthState = crypto.randomUUID();

      // Store PKCE + client info keyed by the state we send to Keycloak
      pkceStore.set(oauthState, {
        verifier: keycloakPkce.verifier,
        clientRedirectUri: redirect_uri,
        clientState: state || "",
        codeChallenge: code_challenge,
        expiresAt: Date.now() + CODE_TTL,
      });

      // Build Keycloak authorization URL
      const oidcConfig = await discoverOidc(config.keycloakIssuerUrl);
      const keycloakAuthUrl = new URL(oidcConfig.authorization_endpoint);
      keycloakAuthUrl.searchParams.set("client_id", config.keycloakClientId);
      keycloakAuthUrl.searchParams.set("response_type", "code");
      keycloakAuthUrl.searchParams.set("scope", scope || "openid profile email");
      keycloakAuthUrl.searchParams.set("redirect_uri", config.publicUrl + "/mcp/oauth/oidc-callback");
      keycloakAuthUrl.searchParams.set("state", oauthState);
      keycloakAuthUrl.searchParams.set("code_challenge", keycloakPkce.challenge);
      keycloakAuthUrl.searchParams.set("code_challenge_method", "S256");

      // Serve login page with redirect button
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aedelore MCP - Sign In</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f1117;
      color: #e4e4e7;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #1a1b23;
      border: 1px solid #2a2b35;
      border-radius: 12px;
      padding: 2.5rem;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    h1 { font-size: 1.4rem; margin-bottom: 0.5rem; color: #f4f4f5; }
    p { font-size: 0.9rem; color: #a1a1aa; margin-bottom: 2rem; }
    .btn {
      display: inline-block;
      background: #6366f1;
      color: #fff;
      text-decoration: none;
      padding: 0.75rem 2rem;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      transition: background 0.15s;
    }
    .btn:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Aedelore MCP</h1>
    <p>Authenticate to connect your MCP client.</p>
    <a class="btn" href="${keycloakAuthUrl.toString()}">Sign in with Keycloak</a>
  </div>
</body>
</html>`;

      res.type("html").send(html);
    } catch (err) {
      logger.warn({ err }, "[oauth] authorize error");
      res.status(500).json({ error: "server_error" });
    }
  });

  // OIDC Callback (Keycloak redirects here after user authenticates)
  router.get("/mcp/oauth/oidc-callback", async (req: Request, res: Response) => {
    try {
      const { code, state, error, error_description } = req.query as Record<string, string>;

      if (error) {
        logger.warn({ error, error_description }, "[oauth] idp returned error");
        res.status(400).json({ error, error_description });
        return;
      }

      if (!code || !state) {
        res.status(400).json({ error: "invalid_request", error_description: "Missing code or state" });
        return;
      }

      // Look up the stored PKCE data
      const stored = pkceStore.get(state);
      if (!stored) {
        res.status(400).json({ error: "invalid_request", error_description: "Unknown or expired state" });
        return;
      }

      if (Date.now() > stored.expiresAt) {
        pkceStore.delete(state);
        res.status(400).json({ error: "invalid_request", error_description: "Authorization request expired" });
        return;
      }

      pkceStore.delete(state);

      // Exchange the Keycloak code for tokens
      const tokens = await exchangeCode(
        config.keycloakIssuerUrl,
        config.keycloakClientId,
        config.keycloakClientSecret,
        code,
        config.publicUrl + "/mcp/oauth/oidc-callback",
        stored.verifier,
      );

      // Validate the ID token if present
      if (tokens.id_token) {
        const payload = await validateJwt(
          tokens.id_token,
          config.keycloakIssuerUrl,
          config.keycloakClientId,
        );
        if (!payload) {
          logger.warn("[oauth] id token validation failed");
          res.status(401).json({ error: "invalid_token" });
          return;
        }
      }

      // Generate an MCP authorization code for the client
      const mcpCode = crypto.randomUUID();
      authCodes.set(mcpCode, {
        token: tokens.access_token,
        redirectUri: stored.clientRedirectUri,
        codeChallenge: stored.codeChallenge,
        expiresAt: Date.now() + CODE_TTL,
      });

      logger.debug({ redirect: stored.clientRedirectUri }, "[oauth] oidc callback success");

      // Redirect back to the MCP client
      const redirectUrl = new URL(stored.clientRedirectUri);
      redirectUrl.searchParams.set("code", mcpCode);
      if (stored.clientState) {
        redirectUrl.searchParams.set("state", stored.clientState);
      }

      res.redirect(redirectUrl.toString());
    } catch (err) {
      logger.warn({ err }, "[oauth] oidc callback error");
      res.status(500).json({ error: "server_error" });
    }
  });

  // Token Endpoint
  router.post("/mcp/oauth/token", async (req: Request, res: Response) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      if (checkRateLimit(ip)) {
        res.status(429).json({ error: "rate_limited" });
        return;
      }

      const body = (req.body ?? {}) as Record<string, string>;
      const { grant_type, code, code_verifier, redirect_uri } = body;

      if (grant_type !== "authorization_code") {
        res.status(400).json({ error: "unsupported_grant_type" });
        return;
      }

      if (!code || !code_verifier) {
        res.status(400).json({ error: "invalid_request", error_description: "Missing code or code_verifier" });
        return;
      }

      const stored = authCodes.get(code);
      if (!stored) {
        res.status(400).json({ error: "invalid_grant", error_description: "Unknown or expired authorization code" });
        return;
      }

      if (Date.now() > stored.expiresAt) {
        authCodes.delete(code);
        res.status(400).json({ error: "invalid_grant", error_description: "Authorization code expired" });
        return;
      }

      // Verify PKCE
      if (!verifyPkce(code_verifier, stored.codeChallenge)) {
        authCodes.delete(code);
        res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
        return;
      }

      // redirect_uri angavs vid authorize → MÅSTE anges och matcha här (RFC 6749 §4.1.3).
      // (Tidigare kollades bara "om närvarande" → en klient kunde utelämna det.)
      if (stored.redirectUri && redirect_uri !== stored.redirectUri) {
        authCodes.delete(code);
        res.status(400).json({ error: "invalid_grant", error_description: "redirect_uri missing or mismatch" });
        return;
      }

      // Authorization code is single-use
      authCodes.delete(code);

      logger.debug("[oauth] token exchange success");
      res.json({
        access_token: stored.token,
        token_type: "Bearer",
        expires_in: 86400,
      });
    } catch (err) {
      logger.warn({ err }, "[oauth] token error");
      res.status(500).json({ error: "server_error" });
    }
  });

  return router;
}
