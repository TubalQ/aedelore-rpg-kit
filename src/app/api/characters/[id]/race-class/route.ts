import { NextRequest, NextResponse } from "next/server";
import { ApplyRaceClassSchema } from "@/lib/schemas/character";
import { getCharacterForViewer, updateCharacter } from "@/lib/db/queries/characters";
import { computeStartingEquipment, computeStartingStats } from "@/lib/domain/starting-data";
import { RACE_NAMES } from "@/lib/domain/races";
import { CLASS_NAMES } from "@/lib/domain/classes";
import { RELIGION_NAMES } from "@/lib/domain/religions";
import { activateLiveSystem } from "@/systems/load";
import { HttpError, parseBody, parseId, requireApiUser, withApi } from "@/lib/api/route-helpers";

type Params = { params: Promise<{ id: string }> };

// Sets race/class/religion and applies the starting stats and equipment with
// the same domain functions the character wizard uses, so every client (web,
// MCP) gets identical results from one implementation.
export const POST = withApi(async (req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const user = await requireApiUser();
  const id = parseId((await params).id);
  const input = await parseBody(req, ApplyRaceClassSchema);

  await activateLiveSystem();
  if (!RACE_NAMES.includes(input.race)) {
    throw new HttpError(400, `Unknown race "${input.race}"`, { valid: [...RACE_NAMES] });
  }
  if (!CLASS_NAMES.includes(input.class)) {
    throw new HttpError(400, `Unknown class "${input.class}"`, { valid: [...CLASS_NAMES] });
  }
  if (input.religion && !RELIGION_NAMES.includes(input.religion)) {
    throw new HttpError(400, `Unknown religion "${input.religion}"`, { valid: [...RELIGION_NAMES] });
  }

  const char = await getCharacterForViewer(id, user.id);
  if (!char) throw new HttpError(404, "Not found");
  if (char.raceClassLocked && !char.viewerIsDm) {
    throw new HttpError(409, "Race/class is locked");
  }

  const result = await updateCharacter(id, user.id, {
    data: {
      race: input.race,
      class: input.class,
      ...(input.religion ? { religion: input.religion } : {}),
      ...computeStartingStats(input.race, input.class, input.religion),
      ...computeStartingEquipment(input.class, input.race),
      spells: [],
    },
  });
  if (!result.ok) throw new HttpError(404, "Not found");
  return NextResponse.json(result.character);
});
