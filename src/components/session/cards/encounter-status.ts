import type { TranslationKey } from "@/lib/i18n";
import { ENCOUNTER_STATUSES, type EncounterStatus } from "@/lib/schemas/session";

export const STATUS_LABEL_KEYS: Record<EncounterStatus, TranslationKey> = {
  planned: "sessionCard.encounter.statusPlanned",
  started: "sessionCard.encounter.statusStarted",
  completed: "sessionCard.encounter.statusCompleted",
};
export const STATUS_STYLES: Record<EncounterStatus, string> = {
  planned: "bg-bg-base text-text-faint",
  started: "bg-accent-gold/15 text-accent-gold",
  completed: "bg-accent-green/15 text-accent-green",
};

export function nextStatus(s: EncounterStatus): EncounterStatus {
  const order = ENCOUNTER_STATUSES;
  return order[(order.indexOf(s) + 1) % order.length];
}
