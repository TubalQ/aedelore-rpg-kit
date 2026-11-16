import { describe, expect, it, vi } from "vitest";
import { endKeycloakSession } from "./keycloak-logout";

const config = {
  issuer: "https://kc.example/auth/realms/test",
  clientId: "app",
  clientSecret: "secret",
};

function fakeFetch(status: number) {
  return vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
      new Response(null, { status }),
  );
}

describe("endKeycloakSession", () => {
  it("posts the refresh token and client credentials to the realm logout endpoint", async () => {
    const fetchImpl = fakeFetch(204);
    const result = await endKeycloakSession("rt-123", config, fetchImpl);

    expect(result).toBe("ended");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://kc.example/auth/realms/test/protocol/openid-connect/logout");
    expect(init?.method).toBe("POST");
    const body = new URLSearchParams(String(init?.body));
    expect(body.get("refresh_token")).toBe("rt-123");
    expect(body.get("client_id")).toBe("app");
    expect(body.get("client_secret")).toBe("secret");
  });

  it("treats 400 as an already ended session", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await endKeycloakSession("rt", config, fakeFetch(400))).toBe("already-ended");
  });

  it("reports other statuses and network errors as failed without throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await endKeycloakSession("rt", config, fakeFetch(500))).toBe("failed");
    const broken = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
        throw new Error("ECONNREFUSED");
      },
    );
    expect(await endKeycloakSession("rt", config, broken)).toBe("failed");
  });

  it("skips without a refresh token or config, and never calls fetch", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = fakeFetch(204);
    expect(await endKeycloakSession(undefined, config, fetchImpl)).toBe("skipped");
    expect(await endKeycloakSession("rt", { ...config, clientSecret: undefined }, fetchImpl)).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
