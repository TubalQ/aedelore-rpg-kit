"use client";

import Link from "next/link";
import { Box, Gift, MapPin } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { StashEntry } from "@/lib/schemas/stash";
import { TIME_LABEL_KEYS, asTimeOfDay } from "@/lib/domain/time";

interface StashWhereProps {
  entry: StashEntry;
  onTakeBack: (characterId: number, characterName: string) => void;
  pending: boolean;
}

/** Every place an entry is: session placements and the characters holding it. */
export function StashWhere({ entry, onTakeBack, pending }: StashWhereProps) {
  const { t } = useT();
  const empty = entry.placements.length === 0 && entry.holders.length === 0;

  const when = (day: string | null, time: string | null): string => {
    const tod = asTimeOfDay(time);
    return [day ? t("contentMeta.dayN", { n: day }) : "", tod ? t(TIME_LABEL_KEYS[tod]) : ""]
      .filter(Boolean)
      .join(" · ");
  };

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">{t("stash.colWhere")}</h3>
      {empty && (
        <p className="flex items-center gap-2 rounded-lg border border-border bg-bg-base px-3 py-3 text-sm text-text-faint">
          <Box size={15} aria-hidden="true" />
          {t("stash.nowhere")}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {entry.placements.map((p, i) => (
          <li key={`p${i}`} className="flex items-start gap-3 rounded-lg border border-border bg-bg-base px-3 py-2.5">
            <MapPin size={15} className="mt-0.5 shrink-0 text-accent-cyan" aria-hidden="true" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
              <Link href={`/sessions/${p.sessionId}`} className="font-medium text-text-base hover:text-accent-gold">
                {t("stash.placedIn", { n: p.sessionNumber })}
                {p.sessionTitle && ` · ${p.sessionTitle}`}
              </Link>
              <span className="text-xs text-text-faint">
                {[p.plannedLocation, when(p.day, p.time), p.found ? t("stash.foundBy") : "", p.givenTo.length > 0 ? `→ ${p.givenTo.join(", ")}` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          </li>
        ))}
        {entry.holders.map((h) => (
          <li key={`h${h.characterId}`} className="flex items-center gap-3 rounded-lg border border-border bg-bg-base px-3 py-2.5">
            <Gift size={15} className="shrink-0 text-accent-green" aria-hidden="true" />
            <span className="flex-1 text-sm text-text-base">
              {t("stash.statusGiven", { name: h.characterName })}
              {h.archived && <span className="text-text-faint"> ({t("stash.archived")})</span>}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => onTakeBack(h.characterId, h.characterName)}
              className="min-h-9 rounded-lg px-2 text-sm text-text-muted hover:text-text-base disabled:opacity-50"
            >
              {t("stash.takeBack")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
