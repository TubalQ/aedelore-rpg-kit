"use client";

import { X } from "lucide-react";
import { ENEMY_STATUSES, newEnemy, type EncounterEnemy, type EnemyStatus } from "@/lib/schemas/session";
import { useUndoableRemove } from "@/hooks/useUndoableRemove";
import { useT, type TranslationKey } from "@/lib/i18n";
import { AutoTextarea } from "@/components/ui/auto-textarea";

// MCP prep tools fill these; the DM can edit them in prep mode and sees them
// as one line during play.
const ENEMY_STAT_FIELDS: { key: "role" | "weapon" | "armor" | "atkBonus" | "dmg"; label: TranslationKey; width: string }[] = [
  { key: "role", label: "sessionCard.encounter.enemyRole", width: "w-24" },
  { key: "weapon", label: "sessionCard.encounter.enemyWeapon", width: "w-28" },
  { key: "armor", label: "sessionCard.encounter.enemyArmor", width: "w-28" },
  { key: "atkBonus", label: "sessionCard.encounter.enemyAtk", width: "w-14" },
  { key: "dmg", label: "sessionCard.encounter.enemyDmg", width: "w-16" },
];

const ENEMY_STATUS_LABEL_KEYS: Record<EnemyStatus, TranslationKey> = {
  fighting: "sessionCard.encounter.enemyStatusFighting",
  fled: "sessionCard.encounter.enemyStatusFled",
  surrendered: "sessionCard.encounter.enemyStatusSurrendered",
  captured: "sessionCard.encounter.enemyStatusCaptured",
};

function enemyStatLine(enemy: EncounterEnemy): string {
  return [
    enemy.role,
    enemy.weapon,
    enemy.armor,
    enemy.atkBonus && `ATK ${enemy.atkBonus}`,
    enemy.dmg && `DMG ${enemy.dmg}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

interface EnemyListProps {
  enemies: EncounterEnemy[];
  mode: "prep" | "play";
  disabled: boolean;
  onChange: (enemies: EncounterEnemy[]) => void;
}

/** An encounter's enemies: stats and notes in prep, HP tracking in play. */
export function EnemyList({ enemies, mode, disabled, onChange }: EnemyListProps) {
  const { t } = useT();

  function addEnemy() {
    onChange([...enemies, newEnemy()]);
  }

  function updateEnemy(i: number, patch: Record<string, unknown>) {
    onChange(enemies.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  }

  const removeEnemyAt = useUndoableRemove(enemies, onChange);
  function removeEnemy(i: number) {
    removeEnemyAt(i, enemies[i]?.name);
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-faint">{t("sessionCard.encounter.enemies")} ({enemies.length})</span>
        {!disabled && (
          <button onClick={addEnemy} className="text-xs text-accent-red hover:text-accent-red pointer-coarse:min-h-11 pointer-coarse:px-3">{t("sessionCard.encounter.addEnemy")}</button>
        )}
      </div>
      {enemies.map((enemy, i) => {
        // Defeated at 0 HP in play (#85): greyed out and marked, still in the
        // list; "+" brings it back. Fled, surrendered or captured (#71) is also
        // out of the fight, set by the DM or the AI, and keeps its HP.
        // The badge reads the same in prep and play (0 HP goes before the
        // status); the greying and strike-through are play only.
        const atZero = enemy.maxHp > 0 && enemy.hp <= 0;
        const defeated = mode === "play" && atZero;
        const left = enemy.status !== "fighting";
        const badge = atZero ? t("sessionCard.encounter.defeated") : left ? t(ENEMY_STATUS_LABEL_KEYS[enemy.status]) : null;
        return (
        <div key={i} className={mode === "play" && (atZero || left) ? "opacity-60" : undefined}>
          <div className="flex items-center gap-1">
            {badge && (
              <span className="shrink-0 rounded bg-bg-surface px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-faint">
                {badge}
              </span>
            )}
            <input
              type="text"
              value={enemy.name}
              onChange={(e) => updateEnemy(i, { name: e.target.value })}
              disabled={disabled}
              className={`min-w-0 flex-1 rounded border border-border bg-bg-base px-1.5 py-0.5 text-xs text-text-base disabled:opacity-50 focus:outline-none ${defeated ? "line-through" : ""}`}
              placeholder={t("sessionCard.encounter.enemyNamePlaceholder")} aria-label={t("sessionCard.encounter.enemyNamePlaceholder")}
            />
            {mode === "play" && (
              <div className="flex items-center gap-0.5">
                <button
                  aria-label="−1 HP"
                  onClick={() => updateEnemy(i, { hp: Math.max(0, enemy.hp - 1) })}
                  disabled={disabled}
                  className="rounded bg-bg-surface px-1 py-1 pointer-coarse:min-h-11 pointer-coarse:min-w-11 text-xs text-accent-red disabled:opacity-50"
                >
                  −
                </button>
                <span className={`w-8 text-center text-xs font-mono ${
                  enemy.maxHp > 0 && enemy.hp <= 0 ? "text-accent-red" :
                  enemy.maxHp > 0 && enemy.hp <= enemy.maxHp * 0.25 ? "text-accent-red" :
                  enemy.maxHp > 0 && enemy.hp <= enemy.maxHp * 0.5 ? "text-accent-gold" : "text-accent-green"
                }`}>
                  {enemy.hp}
                </span>
                <span className="text-xs text-text-faint">/</span>
                <input
                  type="number"
                  value={enemy.maxHp}
                  onChange={(e) => updateEnemy(i, { maxHp: Number(e.target.value) })}
                  disabled={disabled}
                  className="w-10 rounded border border-border bg-bg-base px-1 py-0.5 text-xs text-text-base disabled:opacity-50 focus:outline-none text-center"
                />
                <button
                  aria-label="+1 HP"
                  onClick={() => updateEnemy(i, { hp: Math.min(enemy.maxHp, enemy.hp + 1) })}
                  disabled={disabled}
                  className="rounded bg-bg-surface px-1 py-1 pointer-coarse:min-h-11 pointer-coarse:min-w-11 text-xs text-accent-green disabled:opacity-50"
                >
                  +
                </button>
              </div>
            )}
            {mode === "prep" && (
              <>
                <input
                  type="number"
                  value={enemy.hp}
                  onChange={(e) => updateEnemy(i, { hp: Number(e.target.value) })}
                  disabled={disabled}
                  className="w-12 rounded border border-border bg-bg-base px-1 py-0.5 text-xs text-text-base disabled:opacity-50 focus:outline-none"
                  placeholder="HP" aria-label="HP"
                />
                <span className="text-xs text-text-faint">/</span>
                <input
                  type="number"
                  value={enemy.maxHp}
                  onChange={(e) => updateEnemy(i, { maxHp: Number(e.target.value) })}
                  disabled={disabled}
                  className="w-12 rounded border border-border bg-bg-base px-1 py-0.5 text-xs text-text-base disabled:opacity-50 focus:outline-none"
                  placeholder="Max" aria-label="Max"
                />
              </>
            )}
            {!disabled && (
              <button onClick={() => removeEnemy(i)} aria-label={t("common.remove")} className="ml-2 p-1 text-accent-red hover:text-accent-red pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:items-center pointer-coarse:justify-center"><X size={14} /></button>
            )}
          </div>
          {mode === "play" && !disabled && (
            <select
              value={enemy.status}
              onChange={(e) => updateEnemy(i, { status: e.target.value })}
              aria-label={t("sessionCard.encounter.enemyStatus")}
              className="mt-0.5 rounded border border-border bg-bg-base px-1 py-0.5 text-[11px] text-text-base focus:outline-none pointer-coarse:min-h-11"
            >
              {ENEMY_STATUSES.map((st) => (
                <option key={st} value={st}>{t(ENEMY_STATUS_LABEL_KEYS[st])}</option>
              ))}
            </select>
          )}
          {mode === "prep" ? (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {ENEMY_STAT_FIELDS.map(({ key, label, width }) => (
                <input
                  key={key}
                  type="text"
                  value={enemy[key]}
                  onChange={(e) => updateEnemy(i, { [key]: e.target.value })}
                  disabled={disabled}
                  aria-label={t(label)}
                  placeholder={t(label)}
                  className={`${width} rounded border border-border bg-bg-base px-1.5 py-0.5 text-[11px] text-text-base disabled:opacity-50 focus:border-accent-gold focus:outline-none`}
                />
              ))}
            </div>
          ) : (
            enemyStatLine(enemy) && (
              <p className="mt-0.5 text-[11px] text-text-muted">{enemyStatLine(enemy)}</p>
            )
          )}
          {mode === "prep" && (
            <AutoTextarea
              value={enemy.notes}
              onChange={(e) => updateEnemy(i, { notes: e.target.value })}
              disabled={disabled}
              rows={1}
              className="mt-0.5 w-full rounded border border-accent-gold/20 bg-bg-base px-1.5 py-0.5 text-[10px] text-accent-gold/80 disabled:opacity-50 focus:outline-none"
              placeholder={t("sessionCard.notesLabel")} aria-label={t("sessionCard.notesLabel")}
            />
          )}
          {mode === "play" && enemy.maxHp > 0 && (
            <div className="h-1.5 rounded-full bg-bg-surface overflow-hidden mt-0.5">
              <div
                className={`h-full rounded-full transition-all ${
                  enemy.hp <= 0 ? "bg-text-faint" :
                  enemy.hp / enemy.maxHp <= 0.25 ? "bg-accent-red" :
                  enemy.hp / enemy.maxHp <= 0.5 ? "bg-accent-gold" : "bg-accent-green"
                }`}
                style={{ width: `${Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100))}%` }}
              />
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}
