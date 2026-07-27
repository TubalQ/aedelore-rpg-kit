export const TIMES_OF_DAY = [
  "dawn",
  "morning",
  "noon",
  "afternoon",
  "dusk",
  "evening",
  "night",
] as const;

export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export const TIME_LABELS: Record<TimeOfDay, string> = {
  dawn: "Gryning",
  morning: "Förmiddag",
  noon: "Middag",
  afternoon: "Eftermiddag",
  dusk: "Skymning",
  evening: "Kväll",
  night: "Natt",
};

export const TIME_ORDER: Record<TimeOfDay, number> = {
  dawn: 1,
  morning: 2,
  noon: 3,
  afternoon: 4,
  dusk: 5,
  evening: 6,
  night: 7,
};

export const CONTENT_TYPES = {
  place: { label: "Plats", color: "text-cyan-400", border: "border-cyan-800" },
  encounter: { label: "Encounter", color: "text-red-400", border: "border-red-800" },
  npc: { label: "NPC", color: "text-blue-400", border: "border-blue-800" },
  item: { label: "Föremål", color: "text-amber-400", border: "border-amber-800" },
  readAloud: { label: "Uppläsning", color: "text-purple-400", border: "border-purple-800" },
} as const;

export type ContentType = keyof typeof CONTENT_TYPES;

export const LINKABLE_TYPES = ["place", "encounter", "npc"] as const;
export type LinkableType = (typeof LINKABLE_TYPES)[number];

export const LINKABLE_LABELS: Record<LinkableType, string> = {
  place: "Plats",
  encounter: "Encounter",
  npc: "NPC",
};
