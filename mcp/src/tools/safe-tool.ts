import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../logger.js";

// OBS: `role` + [DM only]/[Player]-taggarna är RÅDGIVANDE hintar till LLM:en om vilka verktyg
// som passar i DM- resp. spelar-kontext. De upprätthålls INTE här - och ska inte göras det:
// rollen är per-kampanj (samma användare är DM för egna kampanjer och spelare i andras). Den
// riktiga behörighetsgränsen är app-API:t, som verifierar ägarskap/medlemskap per kampanj
// (t.ex. verifyDmOwnsCharacter i lib/db/queries/characters.ts) på den vidarebefordrade tokenen.
type ToolRole = "dm" | "player" | "any";

interface SafeToolOptions {
  role?: ToolRole;
  rateLimit?: number;
}

const ROLE_TAGS: Record<ToolRole, string> = {
  dm: "[DM only] ",
  player: "[Player] ",
  any: "",
};

const DEFAULT_RATE_LIMIT = 60;
const WINDOW_MS = 60_000;

const callWindows = new Map<string, number[]>();

function checkRateLimit(toolName: string, limit: number): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  let calls = callWindows.get(toolName);
  if (!calls) {
    calls = [];
    callWindows.set(toolName, calls);
  }
  while (calls.length > 0 && calls[0] < cutoff) calls.shift();
  if (calls.length >= limit) return false;
  calls.push(now);
  return true;
}

export function safeTool(
  server: McpServer,
  name: string,
  description: string,
  schema: Record<string, z.ZodTypeAny>,
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
  }>,
  options?: SafeToolOptions,
): void {
  const role = options?.role ?? "any";
  const rateLimit = options?.rateLimit ?? DEFAULT_RATE_LIMIT;
  toolRoles.set(name, role);

  const taggedDescription = `${ROLE_TAGS[role]}${description}`;

  server.tool(name, taggedDescription, schema, async (args) => {
    const start = Date.now();

    if (!checkRateLimit(name, rateLimit)) {
      logger.warn({ tool: name }, "tool_rate_limited");
      return {
        content: [{ type: "text" as const, text: "Rate limit exceeded. Try again shortly." }],
        isError: true,
      };
    }

    try {
      const result = await handler(args);
      logger.info(
        { tool: name, durationMs: Date.now() - start, argsKeys: Object.keys(args) },
        "tool_success",
      );
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.match(/^API (\d+):/)?.[1] || "";
      const safeMsg = status
        ? `Error (${status}): ${message.replace(/^API \d+:\s*/, "") || "Operation failed"}`
        : `Error: ${message || "Operation failed"}`;
      logger.warn(
        { tool: name, error: message, durationMs: Date.now() - start, argsKeys: Object.keys(args) },
        "tool_error",
      );
      return { content: [{ type: "text" as const, text: safeMsg }], isError: true };
    }
  });
}

export const toolRoles = new Map<string, ToolRole>();
