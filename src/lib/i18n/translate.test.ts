import { describe, expect, it } from "vitest";
import { translate, TRANSLATION_KEYS } from "./index";

// Y18: values are inserted as they are, in every place the placeholder occurs.
describe("translate", () => {
  it("does not expand $ patterns in a value", () => {
    const key = TRANSLATION_KEYS.find((k) => translate(k, "en").includes("{name}"));
    expect(key).toBeDefined();
    if (!key) return;
    expect(translate(key, "en", { name: "A$&B$'C" })).toContain("A$&B$'C");
  });
});
