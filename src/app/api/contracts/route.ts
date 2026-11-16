import { NextResponse } from "next/server";
import { withApi } from "@/lib/api/route-helpers";
import { EQUIPMENT_TYPES, LOCK_STEPS, RARITIES } from "@/lib/schemas/character";
import {
  CONTENT_KINDS,
  DEFAULT_DM_NOTE_CATEGORY,
  DM_NOTE_CATEGORIES,
  ENCOUNTER_STATUSES,
  ENEMY_STATUSES,
  NPC_STATUSES,
} from "@/lib/schemas/session";
import { LINKABLE_TYPES, TIMES_OF_DAY } from "@/lib/domain/time";

// The enum lists the app's schemas accept, served publicly (no data, just the
// contract). The MCP server is built separately (own image, zod 3) and keeps
// copies of these lists for its tool inputs; it compares them with this
// endpoint on every game-data refresh and reports drift in its /health.
export const dynamic = "force-dynamic";

const CONTRACTS = {
  equipmentTypes: EQUIPMENT_TYPES,
  rarities: RARITIES,
  lockSteps: LOCK_STEPS,
  encounterStatuses: ENCOUNTER_STATUSES,
  enemyStatuses: ENEMY_STATUSES,
  npcStatuses: NPC_STATUSES,
  dmNoteCategories: DM_NOTE_CATEGORIES,
  defaultDmNoteCategory: DEFAULT_DM_NOTE_CATEGORY,
  timesOfDay: TIMES_OF_DAY,
  linkableTypes: LINKABLE_TYPES,
  contentKinds: CONTENT_KINDS,
} as const;

export const GET = withApi(async (): Promise<NextResponse> => NextResponse.json(CONTRACTS));
