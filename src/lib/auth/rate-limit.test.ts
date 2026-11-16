import { describe, it, expect, beforeEach } from "vitest";
import { checkLimit, recordFailure, clearFailures, __resetLimiter } from "./rate-limit";

beforeEach(() => __resetLimiter());

describe("checkLimit / recordFailure", () => {
  it("leaves an unknown key open", () => {
    expect(checkLimit("a@exempel.se").blocked).toBe(false);
  });

  it("tolerates four failures and locks on the fifth", () => {
    for (let i = 0; i < 4; i++) {
      expect(recordFailure("a@exempel.se").blocked).toBe(false);
    }
    expect(checkLimit("a@exempel.se").blocked).toBe(false);

    const fifth = recordFailure("a@exempel.se");
    expect(fifth.blocked).toBe(true);
    expect(fifth.retryAfter).toBeGreaterThan(0);
    expect(checkLimit("a@exempel.se").blocked).toBe(true);
  });

  it("keeps keys independent, so one account cannot lock another", () => {
    for (let i = 0; i < 6; i++) recordFailure("a@exempel.se");
    expect(checkLimit("a@exempel.se").blocked).toBe(true);
    expect(checkLimit("b@exempel.se").blocked).toBe(false);
  });

  it("backs off further on each failure past the limit", () => {
    for (let i = 0; i < 4; i++) recordFailure("a@exempel.se");
    const fifth = recordFailure("a@exempel.se");
    const sixth = recordFailure("a@exempel.se");
    const seventh = recordFailure("a@exempel.se");
    expect(sixth.retryAfter).toBeGreaterThan(fifth.retryAfter);
    expect(seventh.retryAfter).toBeGreaterThan(sixth.retryAfter);
  });

  it("caps the lockout at an hour rather than growing forever", () => {
    for (let i = 0; i < 40; i++) recordFailure("a@exempel.se");
    const status = checkLimit("a@exempel.se");
    expect(status.blocked).toBe(true);
    expect(status.retryAfter).toBeLessThanOrEqual(3600);
  });
});

describe("clearFailures", () => {
  it("releases the lock after a successful sign-in", () => {
    for (let i = 0; i < 6; i++) recordFailure("a@exempel.se");
    expect(checkLimit("a@exempel.se").blocked).toBe(true);
    clearFailures("a@exempel.se");
    expect(checkLimit("a@exempel.se").blocked).toBe(false);
  });
});
