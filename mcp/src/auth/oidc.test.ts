import { test } from "node:test";
import assert from "node:assert/strict";
import { UpstreamTokenError, refreshFailure } from "./oidc.js";

// M1: only the provider saying the grant is bad ends the client's session.
test("a rejected grant is passed on as invalid_grant", () => {
  const out = refreshFailure(new UpstreamTokenError(400, "invalid_grant", '{"error":"invalid_grant"}'));
  assert.equal(out.status, 400);
  assert.equal(out.body.error, "invalid_grant");
});

test("a 5xx from the provider is temporary", () => {
  const out = refreshFailure(new UpstreamTokenError(503, undefined, "<html>Service Unavailable</html>"));
  assert.equal(out.status, 503);
  assert.equal(out.body.error, "temporarily_unavailable");
});

test("a timeout or network error is temporary", () => {
  const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
  assert.equal(refreshFailure(timeout).status, 503);
  assert.equal(refreshFailure(new TypeError("fetch failed")).status, 503);
});
