import { test } from "node:test";
import assert from "node:assert/strict";
import { errors } from "jose";
import { serializeError } from "./logger.js";

// M7: an expired token's claims (e-mail, name, roles) must not reach the log.
test("a jose JWT error is logged without its payload", () => {
  const payload = { email: "spelare@example.com", name: "Spelare", realm_access: { roles: ["user"] } };
  const err = new errors.JWTExpired('"exp" claim timestamp check failed', payload, "exp", "check_failed");
  const out = serializeError(err) as Record<string, unknown>;
  assert.equal(out.payload, undefined);
  assert.equal(out.claim, "exp");
  assert.doesNotMatch(JSON.stringify(out), /spelare@example\.com/);
});

test("token-looking strings in an error message are redacted", () => {
  const token = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig";
  const out = serializeError(new Error(`bad token ${token}`)) as Record<string, unknown>;
  assert.equal(out.message, "bad token [REDACTED].sig");
});
