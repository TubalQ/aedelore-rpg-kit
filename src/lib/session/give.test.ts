import { describe, expect, it } from "vitest";
import { givenAfterGive, givenAfterTakeBack, withGivenTo } from "./give";
import { toNameList } from "@/lib/schemas/tolerant";
import { SessionEquipmentSchema, SessionItemSchema, isGivenTo } from "@/lib/schemas/session";

describe("givenTo as a list of holders", () => {
  it("reads an older row's single name as a one-name list, and an empty one as nobody", () => {
    expect(SessionItemSchema.parse({ name: "Map", givenTo: "Arvid" }).givenTo).toEqual(["Arvid"]);
    expect(SessionItemSchema.parse({ name: "Map", givenTo: "" }).givenTo).toEqual([]);
    expect(SessionItemSchema.parse({ name: "Map" }).givenTo).toEqual([]);
    expect(SessionEquipmentSchema.parse({ name: "Blade", givenTo: "Sigrun" }).givenTo).toEqual(["Sigrun"]);
  });

  it("keeps a list, without blanks, duplicates or non-strings", () => {
    expect(toNameList(["Arvid", " Sigrun ", "", "Arvid", 3, null])).toEqual(["Arvid", "Sigrun"]);
    expect(toNameList(42)).toEqual([]);
  });

  it("is given to every holder, and never to no character", () => {
    expect(isGivenTo(["Arvid", "Sigrun"], "Sigrun")).toBe(true);
    expect(isGivenTo(["Arvid"], "Sigrun")).toBe(false);
    expect(isGivenTo([""], null)).toBe(false);
  });
});

describe("giving and taking back", () => {
  it("a move leaves only the new holder", () => {
    expect(givenAfterGive(["Arvid", "Sigrun"], "Bo", "move")).toEqual(["Bo"]);
  });

  it("sharing adds the new holder once", () => {
    expect(givenAfterGive(["Arvid"], "Bo", "share")).toEqual(["Arvid", "Bo"]);
    expect(givenAfterGive(["Arvid"], "Arvid", "share")).toEqual(["Arvid"]);
  });

  it("taking back removes one holder", () => {
    expect(givenAfterTakeBack(["Arvid", "Bo"], "Arvid")).toEqual(["Bo"]);
    expect(givenAfterTakeBack(["Bo"], "Arvid")).toEqual(["Bo"]);
  });
});

describe("withGivenTo", () => {
  type E = { stashId: number | null; name: string; givenTo: string[]; found?: boolean };
  const list: E[] = [
    { stashId: 1, name: "Map", givenTo: [] },
    { stashId: 2, name: "Key", givenTo: ["Arvid"] },
    { stashId: null, name: "Coin", givenTo: [] },
  ];
  const toBo = (cur: readonly string[]) => givenAfterGive(cur, "Bo", "move");

  it("changes the entry at the index when it is still the same entry", () => {
    expect(withGivenTo(list, 1, { stashId: 2, name: "Key" }, toBo)[1].givenTo).toEqual(["Bo"]);
  });

  it("finds the entry by stash id when the list shifted while the server answered", () => {
    const shifted = [list[2], list[0], list[1]];
    const out = withGivenTo(shifted, 1, { stashId: 2, name: "Key" }, toBo);
    expect(out.map((e) => e.givenTo)).toEqual([[], [], ["Bo"]]);
  });

  it("finds an entry without stash id by name, and applies extra fields", () => {
    const out = withGivenTo(list, 0, { stashId: null, name: "Coin" }, toBo, { found: true });
    expect(out[2]).toEqual({ stashId: null, name: "Coin", givenTo: ["Bo"], found: true });
    expect(out[0]).toBe(list[0]);
  });

  it("returns the same list when the entry is gone", () => {
    expect(withGivenTo(list, 0, { stashId: 99, name: "Gone" }, toBo)).toBe(list);
  });
});
