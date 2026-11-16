import { describe, expect, it } from "vitest";
import { keyRows } from "./named-rows";

type Row = { name: string; hp?: number };
const byName = (r: Row) => r.name;

describe("keyRows (Y2)", () => {
  it("keys rows by name in order", () => {
    const out = keyRows<Row>([{ name: "Elf", hp: 4 }, { name: " Dwarf ", hp: 6 }], byName, "Race");
    expect(out.names).toEqual(["Elf", "Dwarf"]);
    expect(out.byName.Dwarf.hp).toBe(6);
    expect(out.problems).toEqual([]);
  });

  it("reports a name typed into an existing one instead of overwriting it", () => {
    const out = keyRows<Row>([{ name: "Elf", hp: 4 }, { name: "Elf", hp: 9 }], byName, "Race");
    expect(out.byName.Elf.hp).toBe(4);
    expect(out.problems).toEqual(['Race "Elf" appears more than once.']);
  });

  it("reports a cleared name instead of deleting the row", () => {
    const out = keyRows<Row>([{ name: "Elf" }, { name: "  " }], byName, "Race");
    expect(out.names).toEqual(["Elf"]);
    expect(out.problems).toEqual(["Race 2 needs a name."]);
  });

  it("calls the key an ID for rows keyed by ID (palettes)", () => {
    const out = keyRows<{ id: string }>([{ id: "" }], (r) => r.id, "Palette", "ID");
    expect(out.problems).toEqual(["Palette 1 needs an ID."]);
  });
});
