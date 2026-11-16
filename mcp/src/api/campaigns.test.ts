import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiClient } from "./client.js";
import { kickPlayer } from "./campaigns.js";

// M10: the player id is one path segment, whatever the model passes.
test("kickPlayer keeps the player id inside its path segment", async () => {
  const paths: string[] = [];
  const client = new ApiClient("http://app.invalid");
  client.request = async <T>(path: string): Promise<T> => {
    paths.push(path);
    return {} as T;
  };
  await kickPlayer(client, "token", 3, "../../9");
  assert.deepEqual(paths, ["/api/campaigns/3/players/..%2F..%2F9"]);
});
