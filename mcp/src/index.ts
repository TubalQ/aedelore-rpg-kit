import express from "express";
import crypto from "crypto";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { loadGameData } from "./game-data/loader.js";
import { createOAuthRouter, type OAuthConfig } from "./auth/oauth.js";
import { McpSessionStore } from "./auth/session-store.js";
import { validateJwt } from "./auth/oidc.js";
import { createMcpServer } from "./server/mcp-factory.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();

// Bakom Traefik: lita på 1 proxy-hop så req.ip blir klientens IP (för rate-limiting),
// inte proxyns - annars delar alla en global rate-limit-bucket.
app.set("trust proxy", 1);

app.use(express.json());
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

// OAuth routes
const oauthConfig: OAuthConfig = {
  publicUrl: config.PUBLIC_URL,
  keycloakIssuerUrl: config.KEYCLOAK_ISSUER,
  keycloakClientId: config.KEYCLOAK_CLIENT_ID,
  keycloakClientSecret: config.KEYCLOAK_CLIENT_SECRET,
  allowedRedirectHosts: config.ALLOWED_REDIRECT_HOSTS,
};
app.use(createOAuthRouter(oauthConfig));

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    sessions: sessionStore.count(),
    uptime: process.uptime(),
  });
});

// --- MCP endpoint ---

// RFC 9728 / MCP-spec: klienter (Claude/ChatGPT) upptäcker auth-servern via WWW-Authenticate
// på 401 och kan då auto-starta OAuth-flödet. Metadata-endpointen finns i oauth-routern.
function setAuthChallenge(res: express.Response): void {
  res.setHeader(
    "WWW-Authenticate",
    `Bearer resource_metadata="${config.PUBLIC_URL}/.well-known/oauth-protected-resource"`,
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

  const payload = await validateJwt(
    token,
    config.KEYCLOAK_ISSUER,
    config.KEYCLOAK_CLIENT_ID,
  );
  if (!payload) {
    logger.warn("JWT validation returned null");
    return null;
  }

  logger.info({ sub: payload.sub }, "Token validated successfully");
  return {
    token,
    userId: payload.sub ?? "",
    isAdmin: false,
  };
}

// POST /mcp - handle JSON-RPC requests
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId) {
    const existing = sessionStore.get(sessionId);
    if (!existing) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    const authResult = await validateToken(req.headers.authorization);
    if (!authResult || authResult.token !== existing.token) {
      setAuthChallenge(res);
      res.status(401).json({
        error: authResult ? "Token mismatch" : "Invalid or missing bearer token",
      });
      return;
    }

    const transport = existing.transport as StreamableHTTPServerTransport;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session
  const authResult = await validateToken(req.headers.authorization);
  if (!authResult) {
    setAuthChallenge(res);
    res.status(401).json({ error: "Invalid or missing bearer token" });
    return;
  }

  const newSessionId = crypto.randomUUID();

  const server = createMcpServer({
    apiUrl: config.API_URL,
    token: authResult.token,
    userId: authResult.userId,
    isAdmin: authResult.isAdmin,
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
    res.status(503).json({ error: "Maximum sessions reached" });
    return;
  }

  await server.connect(transport);

  logger.info({ sessionId: newSessionId, userId: authResult.userId }, "mcp_session_created");

  await transport.handleRequest(req, res, req.body);
});

// GET /mcp - SSE stream for server-to-client notifications
app.get("/mcp", async (req, res) => {
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
  const authResult = await validateToken(req.headers.authorization);
  if (!authResult || authResult.token !== existing.token) {
    setAuthChallenge(res);
    res.status(401).json({
      error: authResult ? "Token mismatch" : "Invalid or missing bearer token",
    });
    return;
  }

  const transport = existing.transport as StreamableHTTPServerTransport;
  await transport.handleRequest(req, res);
});

// DELETE /mcp - close session
app.delete("/mcp", async (req, res) => {
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
  const authResult = await validateToken(req.headers.authorization);
  if (!authResult || authResult.token !== existing.token) {
    setAuthChallenge(res);
    res.status(401).json({
      error: authResult ? "Token mismatch" : "Invalid or missing bearer token",
    });
    return;
  }

  sessionStore.delete(sessionId);
  logger.info({ sessionId }, "mcp_session_closed");
  res.status(204).end();
});

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
