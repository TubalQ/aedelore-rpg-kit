import express from "express";
import crypto from "crypto";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { gameDataAgeMs, loadGameData } from "./game-data/loader.js";
import { contractDrift } from "./game-data/contracts.js";
import { createOAuthRouter, MCP_PATHS, type OAuthConfig, type UpstreamProvider } from "./auth/oauth.js";
import { McpSessionStore } from "./auth/session-store.js";
import { validateJwt } from "./auth/oidc.js";
import { createMcpServer, type ServerProfile } from "./server/mcp-factory.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

const app = express();

// Bakom Traefik: lita på 1 proxy-hop så req.ip blir klientens IP (för rate-limiting),
// inte proxyns - annars delar alla en global rate-limit-bucket.
app.set("trust proxy", 1);

// import_content payloads can be large; the default 100 kB would reject them
// before they reach MCP, which a client shows as a transport error.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

// CORS - exakt origin-match. `startsWith` var bypass-bar (https://claude.ai.evil.com
// startsWith https://claude.ai). localhost tillåts på valfri port.
const CORS_ORIGINS = new Set([
  "https://claude.ai",
  "https://chatgpt.com",
  "https://chat.openai.com",
  "https://chat.mistral.ai",
]);

function isAllowedOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    return CORS_ORIGINS.has(u.origin);
  } catch {
    return false;
  }
}

app.use((_req, res, next) => {
  const origin = _req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (_req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// Load game data from the app API (once at boot, then refreshed in the
// background - see loader). Top-level await is fine here (module: NodeNext).
logger.info({ apiUrl: config.API_URL }, "Loading game data from app API");
await loadGameData();

// Session store
const sessionStore = new McpSessionStore();

// Upstream OIDC providers. Keycloak is the only one since Pocket-ID was retired
// (2026-09, #57). The list shape stays so another issuer can be added without
// touching the OAuth flow; the authorize page tolerates an unreachable provider.
const providers: UpstreamProvider[] = [
  {
    id: "keycloak",
    label: "Aedelore account",
    issuerUrl: config.KEYCLOAK_ISSUER,
    clientId: config.KEYCLOAK_CLIENT_ID,
    clientSecret: config.KEYCLOAK_CLIENT_SECRET,
  },
];

// OAuth routes
const oauthConfig: OAuthConfig = {
  publicUrl: config.PUBLIC_URL,
  providers,
  allowedRedirectHosts: config.ALLOWED_REDIRECT_HOSTS,
};
app.use(createOAuthRouter(oauthConfig));

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    sessions: sessionStore.count(),
    uptime: process.uptime(),
    gameDataAgeMs: gameDataAgeMs(),
    contractDrift: contractDrift(),
  });
});

// --- MCP endpoints ---

type McpPath = (typeof MCP_PATHS)[number];

// Which tool surface each endpoint serves (see server/mcp-factory.ts).
const PROFILE_BY_PATH: Record<McpPath, ServerProfile> = {
  "/mcp": "full",
  "/mcp/play": "play",
};

// RFC 9728 / MCP-spec: klienter (Claude/ChatGPT) upptäcker auth-servern via WWW-Authenticate
// på 401 och kan då auto-starta OAuth-flödet. Metadata-endpointen finns i oauth-routern.
function setAuthChallenge(res: express.Response, path: McpPath = "/mcp"): void {
  res.setHeader(
    "WWW-Authenticate",
    `Bearer resource_metadata="${config.PUBLIC_URL}/.well-known/oauth-protected-resource${path === "/mcp" ? "" : path}"`,
  );
}

async function validateToken(authHeader: string | undefined): Promise<{
  token: string;
  userId: string;
  isAdmin: boolean;
} | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    logger.warn("Missing or malformed Authorization header");
    return null;
  }
  const token = authHeader.slice(7);
  logger.debug({ tokenLength: token.length }, "Validating token");

  // Try each configured upstream (currently only Keycloak), each with its own
  // client id for the aud/azp binding.
  for (const p of providers) {
    const payload = await validateJwt(token, p.issuerUrl, p.clientId);
    if (payload) {
      logger.info({ sub: payload.sub, provider: p.id }, "Token validated successfully");
      return {
        token,
        userId: payload.sub ?? "",
        isAdmin: false,
      };
    }
  }

  logger.warn("JWT validation returned null for all providers");
  return null;
}

/**
 * Checks the bearer token of a request on an existing session. The tools of a
 * session are bound to the token it started with, so a client that re-authed
 * (same user, new token) gets 404: per the MCP spec it then re-initialises a
 * fresh session with the new token instead of looping on 401. A different
 * user's token is a 401.
 */
async function authorizeSessionRequest(
  req: express.Request,
  res: express.Response,
  sessionId: string,
  existing: { token: string; userId: string },
  path: McpPath,
): Promise<boolean> {
  const authResult = await validateToken(req.headers.authorization);
  if (authResult && authResult.token === existing.token) return true;
  if (authResult && authResult.userId === existing.userId) {
    sessionStore.delete(sessionId);
    logger.info({ sessionId }, "mcp_session_token_rotated");
    res.status(404).json({ error: "Session expired after re-authentication; initialize a new session" });
    return false;
  }
  setAuthChallenge(res, path);
  res.status(401).json({ error: authResult ? "Token belongs to another user" : "Invalid or missing bearer token" });
  return false;
}

for (const path of MCP_PATHS) {
  // POST /mcp - handle JSON-RPC requests
  app.post(path, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId) {
      const existing = sessionStore.get(sessionId);
      if (!existing) {
        res.status(404).json({ error: "Session not found or expired" });
        return;
      }

      if (!(await authorizeSessionRequest(req, res, sessionId, existing, path))) return;

      const transport = existing.transport as StreamableHTTPServerTransport;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    const authResult = await validateToken(req.headers.authorization);
    if (!authResult) {
      setAuthChallenge(res, path);
      res.status(401).json({ error: "Invalid or missing bearer token" });
      return;
    }

    // Authenticated first, so OAuth discovery still gets its 401. Then only
    // an initialize request starts a session (M6). Any other POST
    // without a session id used to create a session that counted against the
    // cap until it expired.
    if (!isInitializeRequest(req.body)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: no valid session id; send initialize first" },
        id: null,
      });
      return;
    }
    const newSessionId = crypto.randomUUID();

    const server = createMcpServer({
      apiUrl: config.API_URL,
      token: authResult.token,
      userId: authResult.userId,
      isAdmin: authResult.isAdmin,
      profile: PROFILE_BY_PATH[path],
    });

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
      onsessioninitialized: () => {},
    });
    // Klient-frånkoppling → städa sessionen direkt (annars läcker den till 24h-svepet).
    transport.onclose = () => {
      sessionStore.delete(newSessionId);
    };

    const stored = sessionStore.set(newSessionId, {
      transport,
      server,
      token: authResult.token,
      userId: authResult.userId,
      isAdmin: authResult.isAdmin,
      createdAt: Date.now(),
    });

    if (!stored) {
      res.status(503).json({ error: "Server busy, try again shortly" });
      return;
    }

    await server.connect(transport);

    logger.info({ sessionId: newSessionId, userId: authResult.userId, profile: PROFILE_BY_PATH[path] }, "mcp_session_created");

    await transport.handleRequest(req, res, req.body);
  });

  // GET /mcp - SSE stream for server-to-client notifications
  app.get(path, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).json({ error: "Mcp-Session-Id header required" });
      return;
    }

    const existing = sessionStore.get(sessionId);
    if (!existing) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // Samma token-kontroll som POST - annars kan vem som helst med ett session-UUID läsa strömmen.
    if (!(await authorizeSessionRequest(req, res, sessionId, existing, path))) return;

    const transport = existing.transport as StreamableHTTPServerTransport;
    await transport.handleRequest(req, res);
  });

  // DELETE /mcp - close session
  app.delete(path, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).json({ error: "Mcp-Session-Id header required" });
      return;
    }

    const existing = sessionStore.get(sessionId);
    if (!existing) {
      res.status(204).end();
      return;
    }
    // Kräv giltig, matchande token - annars kan vem som helst med UUID:t stänga sessionen (DoS).
    if (!(await authorizeSessionRequest(req, res, sessionId, existing, path))) return;

    sessionStore.delete(sessionId);
    logger.info({ sessionId }, "mcp_session_closed");
    res.status(204).end();
  });
}

// Start server
const httpServer = app.listen(config.PORT, "0.0.0.0", () => {
  logger.info({ port: config.PORT, publicUrl: config.PUBLIC_URL }, "MCP server started");
});

// Graceful shutdown - stäng aktiva sessioner (transports/SSE) och HTTP-servern innan exit.
process.on("SIGTERM", () => {
  logger.info("Shutting down");
  sessionStore.destroy();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled rejection");
});
