import { describe, expect, it } from "vitest";
import { WikiSearchParamsSchema } from "./wiki";

// W10: values that made Postgres fail with a 500 are refused up front.
describe("WikiSearchParamsSchema", () => {
  it("refuses a NUL byte", () => {
    expect(WikiSearchParamsSchema.safeParse({ q: `drake${String.fromCharCode(0)}` }).success).toBe(false);
  });

  it("refuses a book id past the database's integer range", () => {
    expect(WikiSearchParamsSchema.safeParse({ q: "drake", bookId: "99999999999" }).success).toBe(false);
    expect(WikiSearchParamsSchema.safeParse({ q: "drake", bookId: "3" }).success).toBe(true);
  });
});
