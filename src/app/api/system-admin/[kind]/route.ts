import { NextRequest, NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { getKind, setKind } from "@/lib/db/queries/system-data";
import { KIND_SCHEMAS, crossRefErrors } from "@/lib/schemas/system-data";
import { withApi, readJsonObject } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

// Kinds an admin may READ (to populate the editor's cross-reference dropdowns).
// A superset of the editable kinds: `attributes` is read-only here (it defines
// the character-sheet schema and is edited in JSON), but the editor needs its
// attribute/skill names for the bonus pickers.
const READABLE_KINDS = new Set([...Object.keys(KIND_SCHEMAS), "attributes"]);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 as const };
  if (!session.user.isAdmin) return { error: "Forbidden", status: 403 as const };
  return null;
}

export const GET = withApi(async (
  _req: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
) => {
  const gate = await requireAdmin();
  if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { kind } = await params;
  if (!READABLE_KINDS.has(kind)) {
    return NextResponse.json({ error: "Unknown kind" }, { status: 404 });
  }
  return NextResponse.json({ kind, data: await getKind(kind) });
});

export const PUT = withApi(async (
  req: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
) => {
  const gate = await requireAdmin();
  if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { kind } = await params;
  const schema = Object.hasOwn(KIND_SCHEMAS, kind) ? KIND_SCHEMAS[kind] : undefined;
  if (!schema) return NextResponse.json({ error: "Unknown kind" }, { status: 404 });

  const body = await readJsonObject(req);
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 },
    );
  }

  // Cross-reference checks against the other kinds' current data.
  const [attributes, weaponsData, classesData, armorData, racesData, spellsData] = await Promise.all([
    getKind("attributes"),
    getKind("weapons"),
    getKind("classes"),
    getKind("armor"),
    getKind("races"),
    getKind("spells"),
  ]);
  // What races and classes start with, and which classes have spells (Y5).
  type Se = { weapon?: string; shield?: string; armor?: Record<string, string> };
  const usedBy = { weapons: [] as { name: string; by: string }[], armor: [] as { name: string; by: string }[], shields: [] as { name: string; by: string }[], bodyParts: [] as { name: string; by: string }[], spellClasses: Object.keys((spellsData as object | null) ?? {}) };
  for (const [kindName, src] of [["race", racesData], ["class", classesData]] as const) {
    for (const [name, entry] of Object.entries((src as { data?: Record<string, { startingEquipment?: Se }> } | null)?.data ?? {})) {
      const se = entry.startingEquipment ?? {};
      const by = `${kindName} "${name}"`;
      if (se.weapon) usedBy.weapons.push({ name: se.weapon, by });
      if (se.shield) usedBy.shields.push({ name: se.shield, by });
      for (const [slot, armorName] of Object.entries(se.armor ?? {})) {
        usedBy.armor.push({ name: armorName, by });
        usedBy.bodyParts.push({ name: slot, by });
      }
    }
  }
  const attr = attributes as { attributeNames?: string[]; skillNames?: string[] } | null;
  const ar = armorData as { armor?: { name: string }[]; shields?: { name: string }[]; bodyParts?: string[] } | null;
  const refs = {
    attributeNames: attr?.attributeNames ?? [],
    skillNames: attr?.skillNames ?? [],
    weaponNames: ((weaponsData as { weapons?: { name: string }[] })?.weapons ?? []).map((w) => w.name),
    classNames: (classesData as { names?: string[] })?.names ?? [],
    shieldNames: (ar?.shields ?? []).map((s) => s.name),
    armorNames: (ar?.armor ?? []).map((a) => a.name),
    bodyParts: ar?.bodyParts ?? [],
    usedBy,
  };
  const { errors, warnings } = crossRefErrors(kind, parsed.data, refs);
  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
  }

  await setKind(kind, parsed.data);
  return NextResponse.json({ ok: true, warnings });
});
