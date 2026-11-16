import { describe, expect, it } from "vitest";
import { safeCallback } from "./safe-callback";

describe("safeCallback (F5)", () => {
  it("keeps a path on this site with its query, so an invite keeps its code", () => {
    expect(safeCallback("/campaigns/join?code=AB12CD34")).toBe("/campaigns/join?code=AB12CD34");
  });

  it("never sends the user to another origin", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", undefined, ""]) {
      expect(safeCallback(bad)).toBe("/dashboard");
    }
  });
});
