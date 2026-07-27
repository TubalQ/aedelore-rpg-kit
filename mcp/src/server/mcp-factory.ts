import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import { registerAllTools } from "../tools/registry.js";
import { DM_PROMPTS } from "../prompts/dm-prompts.js";
import { PLAYER_PROMPTS } from "../prompts/player-prompts.js";
import { logger } from "../logger.js";

interface CreateMcpServerOptions {
  apiUrl: string;
  token: string;
  userId: string;
  isAdmin: boolean;
}

export function createMcpServer(options: CreateMcpServerOptions): McpServer {
  const { apiUrl, token, userId, isAdmin } = options;

  const server = new McpServer({
    name: "Aedelore v2",
    version: "1.0.0",
  });

  const client = new ApiClient(apiUrl);

  registerAllTools(server, client, token);

  const allPrompts = [...DM_PROMPTS, ...PLAYER_PROMPTS];
  for (const prompt of allPrompts) {
    const argSchema: Record<string, z.ZodString | z.ZodOptional<z.ZodString>> = {};
    for (const arg of prompt.args) {
      const base = z.string().describe(arg.description);
      argSchema[arg.name] = arg.required ? base : base.optional();
    }

    server.prompt(prompt.name, prompt.description, argSchema, async (args) => {
      const context = `User ID: ${userId} | Admin: ${isAdmin}`;
      const promptText = prompt.buildPrompt(args as Record<string, string>, context);
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
