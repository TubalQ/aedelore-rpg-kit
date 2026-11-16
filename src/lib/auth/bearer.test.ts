import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/db/client", () => ({ db: {} }));

describe("audienceMatches (A9)", async () => {
  process.env.AUTH_KEYCLOAK_ID = "aedelore-app";
  process.env.MCP_KEYCLOAK_CLIENT_ID = "aedelore-mcp";
  const { audienceMatches } = await import("./bearer");

  it("accepts tokens our clients got", () => {
    expect(audienceMatches({ aud: "account", azp: "aedelore-mcp" })).toBe(true);
    expect(audienceMatches({ aud: "account", azp: "aedelore-app" })).toBe(true);
  });

  it("refuses a token another client in the realm got, even with aud account", () => {
    expect(audienceMatches({ aud: "account", azp: "admin-cli" })).toBe(false);
    expect(audienceMatches({ aud: ["account", "aedelore-mcp"], azp: "admin-cli" })).toBe(false);
  });

  it("without azp, one of our clients must be the audience", () => {
    expect(audienceMatches({ aud: "account" })).toBe(false);
    expect(audienceMatches({ aud: ["aedelore-mcp"] })).toBe(true);
  });
});
