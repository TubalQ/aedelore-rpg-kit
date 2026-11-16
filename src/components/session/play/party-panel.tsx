"use client";

import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { CampaignCharacter } from "@/lib/db/queries/campaigns";
import { useDmCharacterControl } from "@/hooks/useCampaigns";
import { cn } from "@/lib/utils/cn";

interface PartyPanelProps {
  campaignId: number;
  characters: CampaignCharacter[];
  disabled: boolean;
}

/** The party at a glance during play, with quick HP steps. */
export function PartyPanel({ campaignId, characters, disabled }: PartyPanelProps) {
  const { t } = useT();
  const control = useDmCharacterControl(campaignId);
  if (characters.length === 0) return <p className="text-sm text-text-faint">{t("play.noCharacters")}</p>;

  return (
    <ul className="flex flex-col gap-2.5">
      {characters.map((c) => {
        const { hp, maxHp } = c.data;
        const pct = maxHp > 0 ? Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100))) : 0;
        const bar = pct > 50 ? "bg-accent-green" : pct > 25 ? "bg-accent-gold" : "bg-accent-red";
        const step = (hpNext: number) => control.mutate({ action: "updateHp", characterId: c.id, delta: hpNext - hp });
        return (
          <li key={c.id} className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/characters/${c.id}`} className="truncate text-sm text-text-base hover:text-accent-gold">{c.name}</Link>
                <span className={cn("shrink-0 font-mono text-xs", pct <= 25 ? "text-accent-red" : "text-text-muted")}>{hp}/{maxHp}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg-base">
                <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${pct}%` }} />
              </div>
            </div>
            {!disabled && (
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => step(Math.max(0, hp - 1))} disabled={control.isPending || hp <= 0} aria-label={t("play.hpDown", { name: c.name })}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-accent-red hover:bg-accent-red/10 disabled:opacity-40"><Minus size={14} /></button>
                <button type="button" onClick={() => step(Math.min(maxHp, hp + 1))} disabled={control.isPending || hp >= maxHp} aria-label={t("play.hpUp", { name: c.name })}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-accent-green hover:bg-accent-green/10 disabled:opacity-40"><Plus size={14} /></button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
