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
  DmUpdateStatsSchema,
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
  dmUpdateStats,
  dmUpdateEquipmentHp,
} from "@/lib/db/queries/characters";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("giveXp"), ...DmGiveXpSchema.shape }),
  z.object({ action: z.literal("resetXp"), ...DmResetXpSchema.shape }),
  z.object({ action: z.literal("giveItem"), ...DmGiveItemSchema.shape }),
  z.object({ action: z.literal("removeItem"), ...DmRemoveItemSchema.shape }),
  z.object({ action: z.literal("giveEquipment"), ...DmGiveEquipmentSchema.shape }),
  z.object({ action: z.literal("removeEquipment"), ...DmRemoveEquipmentSchema.shape }),
  z.object({ action: z.literal("setLocks"), ...DmSetLocksSchema.shape }),
  z.object({ action: z.literal("updateHp"), ...DmUpdateHpSchema.shape }),
  z.object({ action: z.literal("updateStats"), ...DmUpdateStatsSchema.shape }),
  z.object({ action: z.literal("updateEquipmentHp"), ...DmUpdateEquipmentHpSchema.shape }),
]);

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const campaignId = Number(id);
  if (Number.isNaN(campaignId)) {
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
  }

  const body = await req.json();
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
      result = await dmGiveItem(data.characterId, dmUserId, campaignId, data.item);
      break;
    case "removeItem":
      result = await dmRemoveItem(data.characterId, dmUserId, campaignId, data.itemName);
      break;
    case "giveEquipment":
      result = await dmGiveEquipment(data.characterId, dmUserId, campaignId, data.equipment);
      break;
    case "removeEquipment":
      result = await dmRemoveEquipment(data.characterId, dmUserId, campaignId, data.equipmentName);
      break;
    case "setLocks":
      result = await dmSetLocks(data.characterId, dmUserId, campaignId, {
        raceClassLocked: data.raceClassLocked,
        attributesLocked: data.attributesLocked,
        abilitiesLocked: data.abilitiesLocked,
      });
      break;
    case "updateHp":
      result = await dmUpdateHp(data.characterId, dmUserId, campaignId, data.hp);
      break;
    case "updateStats":
      result = await dmUpdateStats(data.characterId, dmUserId, campaignId, {
        attributes: data.attributes,
        skills: data.skills,
      });
      break;
    case "updateEquipmentHp":
      result = await dmUpdateEquipmentHp(data.characterId, dmUserId, campaignId, data.equipmentIndex, data.hp);
      break;
  }

  if (!result) {
    return NextResponse.json(
      { error: "Karaktär hittades inte eller du är inte DM för kampanjen" },
      { status: 404 },
    );
  }

  return NextResponse.json(result);
}
