import { describe, expect, it } from "vitest";
import { verifyPassword, needsRehash } from "./password";
// @ts-expect-error - plain .mjs script without types
import { hashPasswordCli } from "../../../scripts/set-password.mjs";

// The reset script hashes on its own (it runs without the app's TypeScript);
// this keeps its format and cost in step with src/lib/auth/password.ts.
describe("scripts/set-password.mjs", () => {
  it("makes a hash the app verifies and does not want to rehash", async () => {
    const hash: string = await hashPasswordCli("a long enough password");
    expect(await verifyPassword("a long enough password", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(needsRehash(hash)).toBe(false);
  });
});
