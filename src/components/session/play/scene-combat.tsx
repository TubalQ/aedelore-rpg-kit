"use client";

import { useT } from "@/lib/i18n";
import type { SessionEncounter } from "@/lib/schemas/session";
import { EnemyList } from "../cards/enemy-list";

interface SceneCombatProps {
  encounter: SessionEncounter;
  disabled: boolean;
  onUpdate: (patch: Partial<SessionEncounter>) => void;
}

/** Combat in the active scene: tactics to remember, enemy HP, what they drop. */
export function SceneCombat({ encounter, disabled, onUpdate }: SceneCombatProps) {
  const { t } = useT();
  if (encounter.enemies.length === 0 && !encounter.tactics && !encounter.loot) {
    return <p className="text-sm text-text-faint">{t("play.noCombat")}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {encounter.tactics && (
        <p className="whitespace-pre-line rounded-lg border border-accent-red/25 bg-accent-red/5 px-3 py-2 text-sm text-text-muted">
          <span className="mr-1 font-medium text-accent-red">{t("plan.tactics")}:</span>
          {encounter.tactics}
        </p>
      )}
      <EnemyList enemies={encounter.enemies} mode="play" disabled={disabled} onChange={(enemies) => onUpdate({ enemies })} />
      {encounter.loot && (
        <p className="whitespace-pre-line text-sm text-text-muted">
          <span className="mr-1 font-medium text-accent-gold">{t("plan.loot")}:</span>
          {encounter.loot}
        </p>
      )}
    </div>
  );
}
