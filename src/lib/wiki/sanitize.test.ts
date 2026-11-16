import { describe, expect, it } from "vitest";
import { sanitizeWikiHtml } from "./sanitize";

describe("sanitizeWikiHtml (W6)", () => {
  it("drops style tags and form controls", () => {
    const out = sanitizeWikiHtml('<style>body{display:none}</style><form action="https://x"><input name="pw"><button>Log in</button></form><p>ok</p>');
    expect(out).not.toMatch(/<style|<form|<input|<button/i);
    expect(out).toContain("<p>ok</p>");
  });

  it("takes out fixed and sticky positioning but keeps the wiki's own layout", () => {
    const out = sanitizeWikiHtml('<div style="position:fixed;inset:0;background:#000">x</div><div style="position:relative;padding-left:60px">y</div>');
    expect(out).not.toMatch(/position:\s*fixed/i);
    expect(out).toContain("background:#000");
    expect(out).toContain("position:relative;padding-left:60px");
  });
});
