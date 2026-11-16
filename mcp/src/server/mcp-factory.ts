import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import { registerAllTools } from "../tools/registry.js";
import { registerFacadeTools, type Profile } from "../tools/facade.js";
import { DM_PROMPTS } from "../prompts/dm-prompts.js";
import { PLAYER_PROMPTS } from "../prompts/player-prompts.js";
import { serverInstructions } from "../prompts/preambles.js";
import { logger } from "../logger.js";

/**
 * "full": the broad tools for play and prep (default, /mcp).
 * "play": only what running a game needs (/mcp/play).
 * The old 88-tool surface (/mcp/legacy) was removed 2026-10-03: unused since the profiles came (#71).
 */
export type ServerProfile = Profile;

interface CreateMcpServerOptions {
  apiUrl: string;
  token: string;
  userId: string;
  isAdmin: boolean;
  profile?: ServerProfile;
}

export function createMcpServer(options: CreateMcpServerOptions): McpServer {
  const { apiUrl, token, userId, isAdmin } = options;
  const profile = options.profile ?? "full";

  const server = new McpServer(
    {
      name: "Aedelore v2",
      version: "1.0.0",
    },
    { instructions: serverInstructions(profile) },
  );

  const client = new ApiClient(apiUrl);

  registerAllTools(server, client, token);
  registerFacadeTools(server, profile);

  const allPrompts = [...DM_PROMPTS, ...PLAYER_PROMPTS].filter((p) => (p.profiles ?? ["full"]).includes(profile));
  for (const prompt of allPrompts) {
    const argSchema: Record<string, z.ZodString | z.ZodOptional<z.ZodString>> = {};
    for (const arg of prompt.args) {
      const base = z.string().describe(arg.description);
      argSchema[arg.name] = arg.required ? base : base.optional();
    }

    server.prompt(prompt.name, prompt.description, argSchema, async (args) => {
      const context = `User ID: ${userId} | Admin: ${isAdmin}`;
      const promptText = prompt.buildPrompt(args as Record<string, string>, context, profile);
      logger.info({ prompt: prompt.name, userId }, "prompt_invoked");
      return {
        messages: [
          {
            role: "user" as const,
            content: { type: "text" as const, text: promptText },
          },
        ],
      };
    });
  }

  return server;
}
