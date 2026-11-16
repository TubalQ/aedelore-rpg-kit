import { z } from "zod";
import { DmEquipmentSchema, QuestItemSchema } from "@/lib/schemas/character";
import { VISIBLE_TO_ALL, VISIBLE_TO_DM, type SessionEquipment, type SessionItem } from "@/lib/schemas/session";

// ---------------------------------------------------------------------------
// Campaign stash (förråd). An entry is an item ("quest") or a piece of DM
// equipment; its content has the same shape as on a character, without the
// per-holder fields.
// ---------------------------------------------------------------------------

export const STASH_KINDS = ["quest", "equipment"] as const;
export type StashKind = (typeof STASH_KINDS)[number];

export const StashQuestSchema = QuestItemSchema.omit({ sessionName: true, stashId: true });
export const StashEquipmentSchema = DmEquipmentSchema.omit({ sessionName: true, stashId: true });
export type StashQuest = z.infer<typeof StashQuestSchema>;
export type StashEquipment = z.infer<typeof StashEquipmentSchema>;

/** The fields of a placement that are stash content (the rest is about the placement). */
export const STASH_QUEST_KEYS = Object.keys(StashQuestSchema.shape) as (keyof SessionItem & string)[];
export const STASH_EQUIPMENT_KEYS = Object.keys(StashEquipmentSchema.shape) as (keyof SessionEquipment & string)[];

export const StashContentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("quest"), data: StashQuestSchema }),
  z.object({ kind: z.literal("equipment"), data: StashEquipmentSchema }),
]);
export type StashContent = z.infer<typeof StashContentSchema>;

/** Where an entry is placed: one session placement. */
export type StashPlacement = {
  sessionId: number;
  sessionNumber: number;
  sessionTitle: string;
  plannedLocation: string;
  day: string | null;
  time: string | null;
  /** Items only: found in play (null for equipment). */
  found: boolean | null;
  /** The characters holding it, by name. */
  givenTo: string[];
  visibleTo: string | string[];
};

/** Who holds an entry: a character in the campaign. */
export type StashHolder = { characterId: number; characterName: string; archived: boolean };

export type StashEntry = {
  id: number;
  kind: StashKind;
  data: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  placements: StashPlacement[];
  holders: StashHolder[];
};

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/**
 * Who sees a placement unless the DM says otherwise. Equipment is planned
 * loot: players see it only once the DM reveals it (or hands it out), as with
 * equipment added in the session itself. An item may be visible at once,
 * since players see items only when they are found.
 */
export function defaultPlacementVisibility(kind: StashKind): string {
  return kind === "equipment" ? VISIBLE_TO_DM : VISIBLE_TO_ALL;
}

export const PlaceStashEntrySchema = z.object({
  sessionId: z.number().int().positive(),
  plannedLocation: z.string().max(200).default(""),
  day: z.string().max(10).nullable().default(null),
  time: z.string().max(20).nullable().default(null),
  // Left out: the default for the entry's kind (defaultPlacementVisibility).
  visibleTo: z.union([z.string(), z.array(z.string())]).optional(),
  notes: z.string().max(5000).default(""),
});
export type PlaceStashEntryInput = z.infer<typeof PlaceStashEntrySchema>;

export const GiveStashEntrySchema = z.object({
  characterId: z.number().int().positive(),
});
