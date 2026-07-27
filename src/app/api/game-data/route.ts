import { NextResponse } from "next/server";
import { loadActiveSystem } from "@/systems/load";

// Public read-only endpoint that serves the active system's game data (races,
// classes, weapons, ...) in the shape the MCP server consumes. This is the SAME
// reference data shown publicly on the landing page and character creation, so
// it needs no auth (whitelisted in middleware.ts). It replaces the old static
// JSON export pipeline: the MCP server reads this live, so admin edits in
// /system-admin reach the AI tools without regenerating files or restarting MCP.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const s = await loadActiveSystem();
  return NextResponse.json({
    weapons: {
      weapons: s.weapons.weapons,
      ammunition: s.weapons.ammunition,
      categories: s.weapons.categories ?? [],
    },
    armor: {
      armor: s.armor.armor,
      shields: s.armor.shields,
      baseAc: s.armor.baseAc,
      bodyParts: s.armor.bodyParts,
    },
    spells: s.spells,
    races: { names: s.races.names, data: s.races.data },
    classes: { names: s.classes.names, data: s.classes.data },
    religions: { names: s.religions.names, data: s.religions.data },
    attributes: {
      attributeNames: s.attributes.attributeNames,
      attributes: s.attributes.attributes,
      skillNames: s.attributes.skillNames,
      skills: s.attributes.skills,
      freePointsTotal: s.attributes.freePointsTotal,
      maxPointsPerField: s.attributes.maxPointsPerField,
      maxThirdEye: s.attributes.maxThirdEye,
      xpPerPoint: s.attributes.xpPerPoint,
    },
  });
}
