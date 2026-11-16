"use client";

import { Box, Gift, MapPin } from "lucide-react";
import { useT } from "@/lib/i18n";
import { RARITIES, RARITY_LABEL_KEYS, type Rarity } from "@/lib/domain/equipment-labels";
import type { StashEntry } from "@/lib/schemas/stash";
import { stashStatus } from "@/lib/stash/status";

const RARITY_STYLE: Record<Rarity, string> = {
  common: "bg-bg-elevated text-text-muted",
  enchanted: "bg-accent-blue/15 text-accent-blue",
  rare: "bg-accent-purple/15 text-accent-purple",
  legendary: "bg-accent-gold/15 text-accent-gold",
};

export function RarityTag({ rarity }: { rarity: unknown }) {
  const { t } = useT();
  const r: Rarity = (RARITIES as readonly unknown[]).includes(rarity) ? (rarity as Rarity) : "common";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${RARITY_STYLE[r]}`}>
      {t(RARITY_LABEL_KEYS[r])}
    </span>
  );
}

/** Where an entry is, as one short line with an icon (list rows). */
export function StashStatusLine({ entry }: { entry: StashEntry }) {
  const { t } = useT();
  const status = stashStatus(entry);
  if (status === "given") {
    const held = entry.holders.filter((h) => !h.archived);
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
        <Gift size={14} className="shrink-0 text-accent-green" aria-hidden="true" />
        <span className="truncate">
          {t("stash.statusGiven", { name: held[0].characterName })}
          {held.length > 1 && ` ${t("stash.more", { n: held.length - 1 })}`}
        </span>
      </span>
    );
  }
  if (status === "placed") {
    const p = entry.placements[0];
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
        <MapPin size={14} className="shrink-0 text-accent-cyan" aria-hidden="true" />
        <span className="truncate">
          {t("stash.statusPlaced", { n: p.sessionNumber, where: p.plannedLocation || p.sessionTitle })}
          {entry.placements.length > 1 && ` ${t("stash.more", { n: entry.placements.length - 1 })}`}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-text-faint">
      <Box size={14} className="shrink-0" aria-hidden="true" />
      {t("stash.statusStash")}
    </span>
  );
}
