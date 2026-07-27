import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "../api/client.js";
import { registerCampaignTools } from "./campaigns.js";
import { registerSessionTools } from "./sessions.js";
import { registerSessionContentTools } from "./session-content.js";
import { registerSessionStateTools } from "./session-state.js";
import { registerSessionDeleteTools } from "./session-delete.js";
import { registerSessionMetadataTools } from "./session-metadata.js";
import { registerDmCharacterTools } from "./characters-dm.js";
import { registerPlayerCharacterTools } from "./characters-player.js";
import { registerUtilityTools } from "./utilities.js";
import { registerGameDataTools } from "./game-data.js";
import { registerWikiTools } from "./wiki.js";
import { registerTrashTools } from "./trash.js";
import { registerPlayerManagementTools } from "./player-mgmt.js";

export function registerAllTools(
  server: McpServer,
  client: ApiClient,
  token: string,
): void {
  registerCampaignTools(server, client, token);
  registerSessionTools(server, client, token);
  registerSessionContentTools(server, client, token);
  registerSessionStateTools(server, client, token);
  registerSessionDeleteTools(server, client, token);
  registerSessionMetadataTools(server, client, token);
  registerDmCharacterTools(server, client, token);
  registerPlayerCharacterTools(server, client, token);
  registerUtilityTools(server, client, token);
  registerGameDataTools(server, client, token);
  registerWikiTools(server, client, token);
  registerTrashTools(server, client, token);
  registerPlayerManagementTools(server, client, token);
}
