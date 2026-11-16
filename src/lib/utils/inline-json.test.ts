import { describe, expect, it } from "vitest";
import { inlineJson } from "./inline-json";

const LINE_SEP = String.fromCharCode(0x2028);

describe("inlineJson (W7)", () => {
  it("cannot close the script tag it is embedded in", () => {
    const out = inlineJson({ "bg-base": "</script><script>alert(1)</script>" });
    expect(out).not.toMatch(/<\/script/i);
    expect(out).not.toContain("<");
  });

  it("reads back to the same value", () => {
    const value = { id: `x"&<>${LINE_SEP}`, n: 1 };
    expect(JSON.parse(inlineJson(value))).toEqual(value);
    expect(inlineJson(value)).not.toContain(LINE_SEP);
  });
});
