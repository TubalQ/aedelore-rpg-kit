"use client";

import { X } from "lucide-react";
import { ATTRIBUTE_NAMES, SKILL_NAMES } from "@/lib/domain/attributes";
import { useT, tAttr, tSkill } from "@/lib/i18n";
import { normalizeStatName } from "@/lib/i18n/game-terms";

export interface BonusEntry {
  stat: string;
  value: number;
}

interface BonusEditorProps {
  bonuses: BonusEntry[];
  disabled?: boolean;
  onChange: (bonuses: BonusEntry[]) => void;
  /** Accentfärg för lägg till-knappen (Tailwind-textklass). */
  addButtonClass?: string;
}

const MIN_VALUE = -5;
const MAX_VALUE = 5;

/**
 * Redigerare för utrustningsbonusar ({stat, value}). Stat väljs ur rullista
 * med de kanoniska engelska namnen som värden (visade lokaliserat) - fritext
 * gav tysta missar eftersom bonus-beräkningen matchar exakt sträng
 * ("styrka"/"STR" räknades aldrig). Värdet sätts med ±-stegare och kan vara
 * negativt (t.ex. tung rustning −1 Dexterity).
 */
export function BonusEditor({ bonuses, disabled = false, onChange, addButtonClass = "text-accent-gold hover:text-accent-gold/80" }: BonusEditorProps) {
  const { t, locale } = useT();
  // Computed at render (not module load) so live-added attributes/skills appear.
  const KNOWN_STATS = new Set<string>([...ATTRIBUTE_NAMES, ...SKILL_NAMES]);

  function update(i: number, patch: Partial<BonusEntry>) {
    onChange(bonuses.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }

  function bump(i: number, delta: number) {
    const next = Math.max(MIN_VALUE, Math.min(MAX_VALUE, (bonuses[i]?.value ?? 0) + delta));
    update(i, { value: next });
  }

  return (
    <div className="space-y-1">
      {/* Rubrik + hint visas alltid - bonusar förväxlades med "fördel" (som inte
          påverkar builden); det här är fältet som ger "+2 Str från vapnet". */}
      <span className="text-[10px] text-text-faint">
        {t("sessionCard.equipment.bonuses")}
        <span className="ml-1 italic opacity-70">({t("bonusEditor.hint")})</span>
      </span>
      {bonuses.map((b, i) => {
        // Äldre bonusar kan ha fritext-statnamn - visa normaliserat om möjligt,
        // annars som egen post så datat inte försvinner tyst ur rullistan.
        const statValue = normalizeStatName(b.stat) ?? b.stat;
        return (
        <div key={i} className="flex items-center gap-1">
          <select
            value={statValue}
            onChange={(e) => update(i, { stat: e.target.value })}
            disabled={disabled}
            className="min-w-0 flex-1 max-w-48 rounded border border-border bg-bg-base px-1.5 py-1 text-xs text-text-base disabled:opacity-50 focus:outline-none"
          >
            <option value="">{t("bonusEditor.selectStat")}</option>
            {statValue && !KNOWN_STATS.has(statValue) && (
              <option value={statValue}>{statValue} (?)</option>
            )}
            <optgroup label={t("bonusEditor.attributes")}>
              {ATTRIBUTE_NAMES.map((a) => (
                <option key={a} value={a}>{tAttr(a, locale)}</option>
              ))}
            </optgroup>
            <optgroup label={t("bonusEditor.skills")}>
              {SKILL_NAMES.map((s) => (
                <option key={s} value={s}>{tSkill(s, locale)}</option>
              ))}
            </optgroup>
          </select>
          <button
            onClick={() => bump(i, -1)}
            disabled={disabled || b.value <= MIN_VALUE}
            aria-label={t("common.decrease")}
            className="w-6 h-6 pointer-coarse:w-9 pointer-coarse:h-9 rounded bg-bg-surface text-xs text-red-400 disabled:opacity-30"
          >
            -
          </button>
          <span className={`w-8 text-center font-mono text-xs ${b.value > 0 ? "text-green-400" : b.value < 0 ? "text-red-400" : "text-text-faint"}`}>
            {b.value > 0 ? `+${b.value}` : b.value}
          </span>
          <button
            onClick={() => bump(i, 1)}
            disabled={disabled || b.value >= MAX_VALUE}
            aria-label={t("common.increase")}
            className="w-6 h-6 pointer-coarse:w-9 pointer-coarse:h-9 rounded bg-bg-surface text-xs text-green-400 disabled:opacity-30"
          >
            +
          </button>
          {!disabled && (
            <button
              onClick={() => onChange(bonuses.filter((_, j) => j !== i))}
              aria-label={t("common.remove")}
              className="p-2 -m-2 text-red-400 hover:text-red-300"
            >
              <X size={14} />
            </button>
          )}
        </div>
        );
      })}
      {!disabled && (
        <button
          onClick={() => onChange([...bonuses, { stat: "", value: 1 }])}
          className={`text-[10px] ${addButtonClass}`}
        >
          {t("sessionCard.equipment.addBonus")}
        </button>
      )}
    </div>
  );
}
