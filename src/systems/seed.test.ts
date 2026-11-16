import { describe, expect, it } from "vitest";
import { SYSTEMS } from "@/systems";
import { KIND_SCHEMAS, crossRefErrors, type CrossRefs } from "@/lib/schemas/system-data";

// The bundled JSON seeds are the fallback for every kind and the start data of
// a fresh install; they are cast (not parsed) when imported, so drift would
// only show at runtime. Validate each against the same schemas the editor uses.
describe.each(Object.entries(SYSTEMS))("seed data of system %s", (_id, sys) => {
  const refs: CrossRefs = {
    attributeNames: sys.attributes.attributeNames,
    skillNames: sys.attributes.skillNames,
    weaponNames: sys.weapons.weapons.map((w) => w.name),
    classNames: sys.classes.names,
    shieldNames: (sys.armor.shields ?? []).map((s) => s.name),
    armorNames: sys.armor.armor.map((a) => a.name),
    bodyParts: sys.armor.bodyParts ?? [],
  };

  it.each(Object.keys(KIND_SCHEMAS))("%s matches its schema and cross-references", (kind) => {
    const data: unknown = Object.hasOwn(sys, kind) ? sys[kind as keyof typeof sys] : undefined;
    const parsed = KIND_SCHEMAS[kind].safeParse(data);
    expect(parsed.success ? [] : parsed.error.issues.slice(0, 5)).toEqual([]);
    expect(crossRefErrors(kind, data, refs).errors).toEqual([]);
  });
});
