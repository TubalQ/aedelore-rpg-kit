import { z } from "zod";
import { QuestItemSchema, DmEquipmentSchema } from "./character";

// ---------------------------------------------------------------------------
// Campaign item box (förråd) - DM-authored items created ahead of time
// ---------------------------------------------------------------------------

// Innehållet i ett låd-föremål, per typ (återanvänder karaktärsschemana = SSoT).
export const BoxItemInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("quest"), quest: QuestItemSchema }),
  z.object({ kind: z.literal("equipment"), equipment: DmEquipmentSchema }),
]);
export type BoxItemInput = z.infer<typeof BoxItemInputSchema>;

// En rad i campaign_items som klienten ser den.
export type CampaignBoxItem = {
  id: number;
  kind: "quest" | "equipment";
  data: Record<string, unknown>;
  sortOrder: number;
};

// POST /api/campaigns/[id]/box - diskriminerade åtgärder (som characters/control).
export const CampaignBoxActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), item: BoxItemInputSchema }),
  z.object({ action: z.literal("remove"), id: z.number().int().positive() }),
  z.object({
    action: z.literal("handout"),
    id: z.number().int().positive(),
    characterId: z.number().int().positive(),
  }),
]);
export type CampaignBoxAction = z.infer<typeof CampaignBoxActionSchema>;

// ---------------------------------------------------------------------------
// API request schemas
// ---------------------------------------------------------------------------

export const CreateCampaignSchema = z.object({
  name: z.string().min(1, "Kampanjnamn krävs").max(100),
  description: z.string().max(2000).default(""),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;

export const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
});

export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;

export const JoinCampaignSchema = z.object({
  shareCode: z.string().min(1, "Delningskod krävs").max(8),
  // The character the player brings into the campaign. Optional - a player
  // without a character yet can join and attach one later from the campaign view.
  characterId: z.number().int().positive().optional(),
});

export type JoinCampaignInput = z.infer<typeof JoinCampaignSchema>;

// ---------------------------------------------------------------------------
// Response types (derived from DB rows, not schemas for validation)
// ---------------------------------------------------------------------------

export type CampaignRow = {
  id: number;
  userId: string;
  name: string;
  description: string | null;
  shareCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type CampaignWithCounts = CampaignRow & {
  sessionCount: number;
  playerCount: number;
  role: "dm" | "player";
  lastActiveSessionId: number | null;
};

export type CampaignPlayer = {
  id: string;
  username: string | null;
  joinedAt: Date;
  character: {
    id: number;
    name: string;
    race: string | null;
    class: string | null;
  } | null;
};
