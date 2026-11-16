import { afterEach, describe, expect, it } from "vitest";
import { getSystem, setSystem } from "@/systems/runtime";
import { getTransformsForClass } from "./transforms";
import { aedeloreActive } from "@/systems/aedelore-active";

// #83 (547): with the class renamed away in the system editor, the sheet said
// the class no longer exists and hid Arcana, but still offered Wildshape:
// transforms are keyed by class name and were looked up without the class.

const original = getSystem();
afterEach(() => setSystem(original));

describe.skipIf(!aedeloreActive)("getTransformsForClass", () => {
  it("returns the Druid's forms while the class exists", () => {
    expect(getTransformsForClass("Druid")).toBeDefined();
  });

  it("returns nothing for a class that is no longer in the system", () => {
    const { Druid: _removed, ...rest } = original.classes.data;
    setSystem({
      ...original,
      classes: { ...original.classes, data: rest, names: original.classes.names.filter((n) => n !== "Druid") },
    });
    expect(original.transforms.Druid).toBeDefined();
    expect(getTransformsForClass("Druid")).toBeUndefined();
  });
});
