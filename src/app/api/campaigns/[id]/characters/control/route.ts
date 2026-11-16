import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import {
  DmGiveXpSchema,
  DmResetXpSchema,
  DmGiveItemSchema,
  DmRemoveItemSchema,
  DmGiveEquipmentSchema,
  DmRemoveEquipmentSchema,
  DmSetLocksSchema,
  DmUpdateHpSchema,
  DmAdjustStatsSchema,
  DmUpdateEquipmentHpSchema,
} from "@/lib/schemas/character";
import {
  dmGiveXp,
  dmResetXp,
  dmGiveItem,
  dmRemoveItem,
  dmGiveEquipment,
  dmRemoveEquipment,
  dmSetLocks,
  dmUpdateHp,
  dmAdjustStats,
  dmUpdateEquipmentHp,
} from "@/lib/db/queries/characters";
import { detachOwnCharacter } from "@/lib/db/queries/campaigns";
import { withApi, parseId, readJson, HttpError, CodedHttpError, codedError } from "@/lib/api/route-helpers";
import type { TakeBackResult } from "@/lib/db/queries/characters";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("giveXp"), ...DmGiveXpSchema.shape }),
  z.object({ action: z.literal("resetXp"), ...DmResetXpSchema.shape }),
  z.object({ action: z.literal("giveItem"), ...DmGiveItemSchema.shape }),
  z.object({ action: z.literal("removeItem"), ...DmRemoveItemSchema.shape }),
  z.object({ action: z.literal("giveEquipment"), ...DmGiveEquipmentSchema.shape }),
  z.object({ action: z.literal("removeEquipment"), ...DmRemoveEquipmentSchema.shape }),
  z.object({ action: z.literal("setLocks"), ...DmSetLocksSchema.shape }),
  z.object({ action: z.literal("updateHp"), ...DmUpdateHpSchema.shape }),
  z.object({ action: z.literal("adjustStats"), ...DmAdjustStatsSchema.shape }),
  z.object({ action: z.literal("updateEquipmentHp"), ...DmUpdateEquipmentHpSchema.shape }),
  // L3: the DM's own character leaves the DM's own campaign.
  z.object({ action: z.literal("detachOwn"), characterId: z.number().int().positive() }),
]);

type Params = { params: Promise<{ id: string }> };

// Taking back something the character does not have is an error the DM
// should see (a rename, or someone already took it), never a silent success.
function takenBack(result: TakeBackResult): { success: true } | null {
  if (result.taken) return { success: true };
  if (result.reason === "notHeld") throw new CodedHttpError(404, "itemNotHeld");
  return null;
}

export const POST = withApi(async (req: NextRequest, { params }: Params): Promise<NextResponse> => {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const campaignId = parseId(id);

  const body = await readJson(req);
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const dmUserId = session.user.id;
  const data = parsed.data;
  let result: unknown = null;

  switch (data.action) {
    case "giveXp":
      result = await dmGiveXp(data.characterId, dmUserId, campaignId, data.amount);
      break;
    case "resetXp":
      result = await dmResetXp(data.characterId, dmUserId, campaignId);
      break;
    case "giveItem":
      result = await dmGiveItem(data.characterId, dmUserId, campaignId, data.item, { move: data.move });
      break;
    case "removeItem":
      result = takenBack(await dmRemoveItem(data.characterId, dmUserId, campaignId, { name: data.itemName, stashId: data.stashId }));
      break;
    case "giveEquipment":
      result = await dmGiveEquipment(data.characterId, dmUserId, campaignId, data.equipment, { move: data.move });
      break;
    case "removeEquipment":
      result = takenBack(await dmRemoveEquipment(data.characterId, dmUserId, campaignId, { name: data.equipmentName, stashId: data.stashId }));
      break;
    case "setLocks":
      result = await dmSetLocks(data.characterId, dmUserId, campaignId, {
        raceClassLocked: data.raceClassLocked,
        attributesLocked: data.attributesLocked,
        abilitiesLocked: data.abilitiesLocked,
      });
      break;
    case "updateHp":
      if ((data.hp === undefined) === (data.delta === undefined)) throw new HttpError(400, "Send hp or delta");
      result = await dmUpdateHp(data.characterId, dmUserId, campaignId, data.delta !== undefined ? { delta: data.delta } : { hp: data.hp ?? 0 });
      break;
    case "adjustStats":
      result = await dmAdjustStats(data.characterId, dmUserId, campaignId, {
        attributes: data.attributes,
        skills: data.skills,
      });
      break;
    case "updateEquipmentHp":
      result = await dmUpdateEquipmentHp(data.characterId, dmUserId, campaignId, { index: data.equipmentIndex, stashId: data.stashId, name: data.name }, data.hp);
      break;
    case "detachOwn":
      result = (await detachOwnCharacter(campaignId, data.characterId, dmUserId)) ? { success: true } : null;
      break;
  }

  if (!result) {
    return codedError(404, "notDmOrNotFound");
  }

  return NextResponse.json(result);
});
