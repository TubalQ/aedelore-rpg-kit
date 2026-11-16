import { describe, expect, it } from "vitest";
import { isReservedCharacterName } from "./visibility";
import { isVisibleTo } from "./session";
import { CreateCharacterSchema, UpdateCharacterSchema } from "./character";

describe("reserved character names", () => {
  it("are the visibility values, in any case and with surrounding spaces", () => {
    for (const n of ["dm", "DM", "Dm", " dm ", "all", "ALL", " All"]) expect(isReservedCharacterName(n), n).toBe(true);
  });

  it("do not catch names that merely contain them", () => {
    for (const n of ["Dmitri", "Allan", "d m", "dmm", "Mira"]) expect(isReservedCharacterName(n), n).toBe(false);
  });

  it("are refused when a character is created or renamed, with a message saying why", () => {
    const created = CreateCharacterSchema.safeParse({ name: "dm" });
    expect(created.success).toBe(false);
    expect(JSON.stringify(created.error?.issues)).toContain("reserved");
    expect(UpdateCharacterSchema.safeParse({ name: " All " }).success).toBe(false);
    expect(CreateCharacterSchema.safeParse({ name: "Dmitri" }).success).toBe(true);
    // Renaming is optional: an update without a name is untouched.
    expect(UpdateCharacterSchema.safeParse({ data: {} }).success).toBe(true);
  });
});

describe("isVisibleTo", () => {
  const cases: [string | string[], string | null, boolean][] = [
    ["all", "Mira", true],
    ["all", null, true],
    ["dm", "Mira", false],
    ["dm", null, false],
    [["Mira"], "Mira", true],
    [["Mira"], "Arvid", false],
    ["Mira", "Mira", true],
    ["Mira", "Arvid", false],
    [["Mira", "all"], "Arvid", true],
    // S1: a character called "dm" must not see what is hidden from players.
    ["dm", "dm", false],
    ["dm", "DM", false],
    ["dm", " dm ", false],
    [["dm"], "dm", false],
    // ...nor match a list by a reserved name; what everyone sees it still sees.
    [["all"], "all", true],
    ["all", "dm", true],
  ];
  it.each(cases)("visibleTo %j for %j is %s", (visibleTo, name, expected) => {
    expect(isVisibleTo(visibleTo, name)).toBe(expected);
  });
});
