import type { TranslationKey } from "@/lib/i18n";

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

export const TIME_ORDER: Record<TimeOfDay, number> = {
  dawn: 1,
  morning: 2,
  noon: 3,
  afternoon: 4,
  dusk: 5,
  evening: 6,
  night: 7,
};

export const LINKABLE_TYPES = ["place", "encounter", "npc"] as const;
export type LinkableType = (typeof LINKABLE_TYPES)[number];

// Display labels are translation keys (see lib/i18n), never literal text, so
// they follow the user's language.
export const TIME_LABEL_KEYS: Record<TimeOfDay, TranslationKey> = {
  dawn: "session.timeDawn",
  morning: "session.timeMorning",
  noon: "session.timeNoon",
  afternoon: "session.timeAfternoon",
  dusk: "session.timeDusk",
  evening: "session.timeEvening",
  night: "session.timeNight",
};

export const LINKABLE_LABEL_KEYS: Record<LinkableType, TranslationKey> = {
  place: "session.place",
  encounter: "session.encounter",
  npc: "session.npc",
};

/** Narrow a stored time-of-day string (tolerantly read) to the typed union. */
export function asTimeOfDay(value: string | null | undefined): TimeOfDay | null {
  return (TIMES_OF_DAY as readonly string[]).includes(value ?? "") ? (value as TimeOfDay) : null;
}

/** Narrow a stored link type to the typed union. */
export function asLinkableType(value: string | null | undefined): LinkableType | null {
  return (LINKABLE_TYPES as readonly string[]).includes(value ?? "") ? (value as LinkableType) : null;
}
