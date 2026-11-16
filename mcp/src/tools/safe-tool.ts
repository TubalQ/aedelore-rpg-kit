import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../logger.js";

// Every tool module defines its operations with `safeTool`. Operations are not
// offered to the client directly: the profiles expose a smaller set of broader
// tools (see tools/facade.ts) that run these operations through `runOp`. Either way the operation's own
// schema validates the arguments, and errors come back the same way.

// OBS: `role` + [DM only]/[Player]-taggarna är RÅDGIVANDE hintar till LLM:en om vilka verktyg
// som passar i DM- resp. spelar-kontext. De upprätthålls INTE här - och ska inte göras det:
// rollen är per-kampanj (samma användare är DM för egna kampanjer och spelare i andras). Den
// riktiga behörighetsgränsen är app-API:t, som verifierar ägarskap/medlemskap per kampanj
// (t.ex. verifyDmOwnsCharacter i lib/db/queries/characters.ts) på den vidarebefordrade tokenen.
export type ToolRole = "dm" | "player" | "any";

export interface SafeToolOptions {
  role?: ToolRole;
  rateLimit?: number;
  /** Overrides the annotations derived from the tool name. */
  annotations?: ToolAnnotations;
}

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

type OpHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

interface Op {
  description: string;
  schema: z.ZodRawShape;
  handler: OpHandler;
  rateLimit: number;
  role: ToolRole;
}

// MCP tool annotations tell clients which tools only read and which remove
// data, so they can skip or ask for confirmation. Derived from the naming
// convention the tools already follow; a tool that breaks it passes
// `annotations` explicitly.
const READ_ONLY_PREFIXES = ["get_", "list_", "search_", "browse_", "read_"];
const DESTRUCTIVE_PREFIXES = ["delete_", "remove_", "kick_", "revoke_", "leave_"];

function deriveAnnotations(name: string): ToolAnnotations {
  if (READ_ONLY_PREFIXES.some((p) => name.startsWith(p))) {
    return { readOnlyHint: true, openWorldHint: false };
  }
  return {
    readOnlyHint: false,
    destructiveHint: DESTRUCTIVE_PREFIXES.some((p) => name.startsWith(p)),
    openWorldHint: false,
  };
}

const ROLE_TAGS: Record<ToolRole, string> = {
  dm: "[DM only] ",
  player: "[Player] ",
  any: "",
};

const DEFAULT_RATE_LIMIT = 60;
const WINDOW_MS = 60_000;

// Windows are kept per McpServer, i.e. per MCP session (one per connected
// client), so one user looping a tool never rate-limits everyone else.
const callWindowsByServer = new WeakMap<McpServer, Map<string, number[]>>();

function checkRateLimit(server: McpServer, key: string, limit: number): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  let callWindows = callWindowsByServer.get(server);
  if (!callWindows) {
    callWindows = new Map();
    callWindowsByServer.set(server, callWindows);
  }
  let calls = callWindows.get(key);
  if (!calls) {
    calls = [];
    callWindows.set(key, calls);
  }
  while (calls.length > 0 && calls[0] < cutoff) calls.shift();
  if (calls.length >= limit) return false;
  calls.push(now);
  return true;
}

const opsByServer = new WeakMap<McpServer, Map<string, Op>>();

function errorResult(message: string): ToolResult {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

/** Runs a handler with rate limiting, logging and the shared error format. */
async function execute(
  server: McpServer,
  name: string,
  rateLimit: number,
  args: Record<string, unknown>,
  handler: OpHandler,
): Promise<ToolResult> {
  const start = Date.now();
  if (!checkRateLimit(server, name, rateLimit)) {
    logger.warn({ tool: name }, "tool_rate_limited");
    return errorResult("Rate limit exceeded. Try again shortly.");
  }
  try {
    const result = await handler(args);
    // A handler that answers with an error result failed, even though it did
    // not throw (M5): it used to be logged as a success.
    if (result.isError) {
      const first = result.content.find((c) => c.type === "text");
      const error = first && "text" in first ? String(first.text).slice(0, 200) : "";
      logger.warn({ tool: name, error, durationMs: Date.now() - start, argsKeys: Object.keys(args) }, "tool_error");
    } else {
      logger.info({ tool: name, durationMs: Date.now() - start, argsKeys: Object.keys(args) }, "tool_success");
    }
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.match(/^API (\d+):/)?.[1] || "";
    const safeMsg = status
      ? `Error (${status}): ${message.replace(/^API \d+:\s*/, "") || "Operation failed"}`
      : `Error: ${message || "Operation failed"}`;
    logger.warn({ tool: name, error: message, durationMs: Date.now() - start, argsKeys: Object.keys(args) }, "tool_error");
    return errorResult(safeMsg);
  }
}

/** Registers a tool with the client: validation by the SDK, then `execute`. */
export function exposeTool<S extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  schema: S,
  handler: (args: z.infer<z.ZodObject<S>>) => Promise<ToolResult>,
  options?: SafeToolOptions,
): void {
  const rateLimit = options?.rateLimit ?? DEFAULT_RATE_LIMIT;
  // The SDK types the callback from the shape itself; the handler is typed from
  // S above, so the registration uses the plain shape and casts once below.
  const config = {
    description: `${ROLE_TAGS[options?.role ?? "any"]}${description}`,
    inputSchema: schema as z.ZodRawShape,
    annotations: options?.annotations ?? deriveAnnotations(name),
  };
  server.registerTool(name, config, async (args: Record<string, unknown>) =>
    execute(server, name, rateLimit, args, handler as OpHandler),
  );
}

/** Defines an operation, run by the broad tools in tools/facade.ts. */
export function safeTool<S extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  schema: S,
  handler: (args: z.infer<z.ZodObject<S>>) => Promise<ToolResult>,
  options?: SafeToolOptions,
): void {
  let ops = opsByServer.get(server);
  if (!ops) {
    ops = new Map();
    opsByServer.set(server, ops);
  }
  ops.set(name, {
    description,
    schema,
    handler: handler as OpHandler,
    rateLimit: options?.rateLimit ?? DEFAULT_RATE_LIMIT,
    role: options?.role ?? "any",
  });
}

function op(server: McpServer, name: string): Op {
  const found = opsByServer.get(server)?.get(name);
  if (!found) throw new Error(`Internal: operation "${name}" is not defined`);
  return found;
}

/** The input shape of an operation, for tools that pass part of it through. */
export function opShape(server: McpServer, name: string): z.ZodRawShape {
  return op(server, name).schema;
}

/** The rate limit of an operation, for tools that pass it through unchanged. */
export function opRateLimit(server: McpServer, name: string): number {
  return op(server, name).rateLimit;
}

/** The role tag of an operation, for tools that pass it through unchanged. */
export function opRole(server: McpServer, name: string): ToolRole {
  return op(server, name).role;
}

/** The description of an operation, for tools that pass it through unchanged. */
export function opDescription(server: McpServer, name: string): string {
  return op(server, name).description;
}

/**
 * Runs an operation from a broader tool. The arguments are validated with the
 * operation's own schema; a failure names the offending fields so the model
 * can correct its call.
 */
export async function runOp(
  server: McpServer,
  name: string,
  args: Record<string, unknown>,
  options: { strict?: boolean; direct?: boolean } = {},
): Promise<ToolResult> {
  const target = op(server, name);
  const clean = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined));
  // strict: an unknown field is an error naming it, not silently dropped (M2).
  const schema = options.strict ? z.object(target.schema).strict() : z.object(target.schema);
  const parsed = schema.safeParse(clean);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(arguments)"}: ${i.message}`).join("; ");
    return errorResult(`Invalid arguments: ${issues}`);
  }
  // direct: the caller is the operation's own exposed tool, which already
  // counted the call against the rate limit and logs it (M5: going through
  // execute again halved the limit and logged every call twice).
  if (options.direct) return target.handler(parsed.data);
  return execute(server, name, target.rateLimit, parsed.data, target.handler);
}
