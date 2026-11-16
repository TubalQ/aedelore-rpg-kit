import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeCredentials, passwordFingerprint, type CredentialDeps, type CredentialUser } from "./credentials";
import { hashPassword } from "./password";
import { __resetLimiter } from "./rate-limit";

const PASSWORD = "correct horse battery staple";

async function deps(user: CredentialUser | null): Promise<CredentialDeps & { log: ReturnType<typeof vi.fn> }> {
  return { findUser: vi.fn(async () => user), saveHash: vi.fn(async () => {}), log: vi.fn(async () => {}) };
}

async function account(over: Partial<CredentialUser> = {}): Promise<CredentialUser> {
  return { id: "u1", email: "anna@example.com", name: "Anna", passwordHash: await hashPassword(PASSWORD), deletedAt: null, ...over };
}

describe("authorizeCredentials", () => {
  beforeEach(() => __resetLimiter());

  it("signs in with the right password, any case of the address", async () => {
    const d = await deps(await account());
    expect(await authorizeCredentials(" Anna@Example.com ", PASSWORD, d)).toEqual({ id: "u1", email: "anna@example.com", name: "Anna" });
    expect(d.findUser).toHaveBeenCalledWith("anna@example.com");
    // Logged once, by events.signIn; logging here too wrote every sign-in twice.
    expect(d.log).not.toHaveBeenCalled();
  });

  it("refuses a wrong password, an unknown address and an OIDC-only or deleted account alike", async () => {
    expect(await authorizeCredentials("anna@example.com", "wrong password here", await deps(await account()))).toBeNull();
    expect(await authorizeCredentials("nobody@example.com", PASSWORD, await deps(null))).toBeNull();
    expect(await authorizeCredentials("anna@example.com", PASSWORD, await deps(await account({ passwordHash: null })))).toBeNull();
    expect(await authorizeCredentials("anna@example.com", PASSWORD, await deps(await account({ deletedAt: new Date() })))).toBeNull();
  });

  it("locks the account after repeated failures, even for the right password", async () => {
    const d = await deps(await account());
    for (let i = 0; i < 5; i++) await authorizeCredentials("anna@example.com", "wrong password here", d);
    expect(await authorizeCredentials("anna@example.com", PASSWORD, d)).toBeNull();
    expect(d.log).toHaveBeenLastCalledWith(null, false, "credentials:locked");
  });
});

describe("passwordFingerprint", () => {
  it("changes when the hash changes", async () => {
    expect(passwordFingerprint(await hashPassword("a"))).not.toBe(passwordFingerprint(await hashPassword("a")));
  });
});
