import { describe, expect, it } from "vitest";
import { rememberedFor, renameStep } from "./rename";

describe("renameStep", () => {
  it("cascades a plain rename", () => {
    expect(renameStep("Kvarn", "Kvarnen", null)).toEqual({ from: "Kvarn", remember: null });
  });

  it("never cascades from an empty name, so unplaced content stays unplaced (S3)", () => {
    expect(renameStep("", "K", null)).toEqual({ from: null, remember: null });
    expect(renameStep("   ", "K", null)).toEqual({ from: null, remember: null });
  });

  it("remembers a cleared name and cascades from it when typing starts again", () => {
    const cleared = renameStep("Kvarn", "", null);
    expect(cleared).toEqual({ from: null, remember: "Kvarn" });
    expect(renameStep("", "M", cleared.remember)).toEqual({ from: "Kvarn", remember: null });
  });

  it("keeps the remembered name while the name stays empty", () => {
    expect(renameStep("", "", "Kvarn")).toEqual({ from: null, remember: "Kvarn" });
  });

  it("does nothing when the name comes back unchanged", () => {
    expect(renameStep("", "Kvarn", "Kvarn")).toEqual({ from: null, remember: null });
  });
});

describe("rememberedFor", () => {
  it("applies only to the same entry in a list of the same length", () => {
    const cleared = { index: 1, length: 3, name: "Kvarn" };
    expect(rememberedFor(cleared, 1, 3)).toBe("Kvarn");
    expect(rememberedFor(cleared, 0, 3)).toBeNull();
    expect(rememberedFor(cleared, 1, 2)).toBeNull();
    expect(rememberedFor(null, 1, 3)).toBeNull();
  });
});
