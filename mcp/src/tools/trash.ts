import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../api/client.js";
import * as trashApi from "../api/trash.js";
import { safeTool } from "./safe-tool.js";
import { text, asRecord } from "./helpers.js";

export function registerTrashTools(
  server: McpServer,
  client: ApiClient,
  token: string,
): void {
  safeTool(
    server,
    "list_trash",
    "List all soft-deleted items (campaigns, characters, sessions, wiki pages) in the trash",
    {},
    async () => {
      const trashRaw = await trashApi.listTrash(client, token);

      // trash may be an object with keys per type, or an array
      if (Array.isArray(trashRaw)) {
        if (trashRaw.length === 0) return text("Trash is empty.");

        let output = `# Trash (${trashRaw.length} items)\n\n`;
        for (const item of trashRaw as Array<Record<string, unknown>>) {
          output += `- **${item.name || item.title || "Untitled"}** (${item.type || "?"}, ID: ${item.id})`;
          if (item.deletedAt) output += ` -- deleted ${item.deletedAt}`;
          output += "\n";
        }
        output +=
          "\nUse restore_item to restore any item, providing the type and ID.\n";
        return text(output.trim());
      }

      // Object with type keys
      const trash = asRecord(trashRaw);
      let totalCount = 0;
      let output = "# Trash\n\n";

      const typeLabels: Record<string, string> = {
        campaigns: "Campaigns",
        characters: "Characters",
        sessions: "Sessions",
        "wiki-books": "Wiki Books",
        "wiki-chapters": "Wiki Chapters",
        "wiki-pages": "Wiki Pages",
      };

      for (const [key, label] of Object.entries(typeLabels)) {
        const items = (trash[key] || []) as Array<Record<string, unknown>>;
        if (items.length === 0) continue;
        totalCount += items.length;
        output += `## ${label} (${items.length})\n`;
        for (const item of items) {
          output += `- **${item.name || item.title || "Untitled"}** (ID: ${item.id})`;
          if (item.deletedAt) output += ` -- deleted ${item.deletedAt}`;
          output += "\n";
        }
        output += "\n";
      }

      if (totalCount === 0) return text("Trash is empty.");

      output +=
        "Use restore_item to restore any item, providing the type and ID.\n";
      return text(output.trim());
    },
  );

  safeTool(
    server,
    "restore_item",
    "Restore a soft-deleted item from the trash",
    {
      type: z
        .enum([
          "campaign",
          "character",
          "session",
          "wiki-book",
          "wiki-chapter",
          "wiki-page",
        ])
        .describe("Type of item to restore"),
      id: z.number().describe("ID of the item to restore"),
    },
    async ({ type, id }) => {
      const itemType = type as string;
      const itemId = id as number;

      const result = asRecord(await trashApi.restoreItem(
        client,
        token,
        itemType,
        itemId,
      ));

      return text(
        (result.message as string) ||
          `Restored ${itemType} (ID: ${itemId}) from trash.`,
      );
    },
  );
}
