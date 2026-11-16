import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "../api/client.js";
import { registerCharacterReadTools } from "./characters/read.js";
import { registerCharacterBuildTools } from "./characters/build.js";
import { registerCharacterEquipmentTools } from "./characters/equipment.js";
import { registerCharacterGameplayTools } from "./characters/gameplay.js";

// Player-facing character tools, split by concern under ./characters/.
// Every write goes through withCharacter (helpers.ts): serialised per
// character and sending only the keys the tool changed.
export function registerPlayerCharacterTools(server: McpServer, client: ApiClient, token: string): void {
  registerCharacterReadTools(server, client, token);
  registerCharacterBuildTools(server, client, token);
  registerCharacterEquipmentTools(server, client, token);
  registerCharacterGameplayTools(server, client, token);
}
