import { describe, expect, it } from "vitest";
import { rewriteLegacyWikiLinks } from "./legacy-links";

describe("rewriteLegacyWikiLinks (W3)", () => {
  it("points v1 hash links at the v2 page", () => {
    expect(rewriteLegacyWikiLinks('<a href="/wiki#the-world/lorenzia">Lorenzia</a>')).toBe('<a href="/wiki/the-world/lorenzia">Lorenzia</a>');
    expect(rewriteLegacyWikiLinks("<a href='/wiki#races-and-classes'>x</a>")).toBe("<a href='/wiki/races-and-classes'>x</a>");
  });

  it("leaves other links alone", () => {
    const html = '<a href="/wiki/the-world/lorenzia#history">x</a><a href="https://example.com/wiki#a/b">y</a><a href="#top">z</a>';
    expect(rewriteLegacyWikiLinks(html)).toBe(html);
  });
});
