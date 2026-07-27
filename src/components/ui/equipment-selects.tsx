"use client";

import { X } from "lucide-react";
import { ATTRIBUTE_NAMES, SKILL_NAMES } from "@/lib/domain/attributes";
import { WEAPON_CATEGORIES, getWeaponsByType, getWeapon } from "@/lib/domain/weapons";
import type { WeaponData } from "@/lib/domain/weapons";
import { ARMOR, SHIELDS, BODY_PARTS } from "@/lib/domain/armor";
import type { ArmorData, ShieldData } from "@/lib/domain/armor";
import { useT, tAttr, tSkill } from "@/lib/i18n";
import { normalizeStatName } from "@/lib/i18n/game-terms";

/**
 * Rullistor för utrustningsfält (DM ska välja, inte skriva fritext):
 * - DiceSelect: skadetärningar (1d6 …)
 * - AtkSelect: attackbonus (−2 … +5, lagras som "+1"-sträng som i vapendatat)
 * - StatNameSelect: attribut/färdighet (kanoniskt namn lagras)
 * - BaseWeaponSelect / BaseArmorSelect / ShieldSelect: basföremål ur domändatat
 *   som förifyller stats (redigerbara efteråt)
 * - DisadvantageEditor: bygger arms nackdelssträng i det STRUKTURERADE formatet
 *   "-1 Stl, -1 Acro" som aggregateDisadvantages parsar - fritext här bröt
 *   AC-panelens straffsummering.
 */

const SELECT_CLS =
  "min-w-0 rounded border border-border bg-bg-base px-1.5 py-1 text-xs text-text-base disabled:opacity-50 focus:outline-none";

const DICE_VALUES = ["-", "1", "1d4", "1d6", "1d8", "1d10", "1d12", "2d4", "2d6", "2d8", "2d10", "2d12", "3d6"];
const ATK_VALUES = ["-2", "-1", "+0", "+1", "+2", "+3", "+4", "+5"];

interface SelectProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
}

function LegacyOption({ value, known }: { value: string; known: readonly string[] }) {
  if (!value || known.includes(value)) return null;
  return <option value={value}>{value} (?)</option>;
}

export function DiceSelect({ value, disabled, onChange, className = "" }: SelectProps) {
  const { t } = useT();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`${SELECT_CLS} ${className}`}>
      <option value="">{t("equipSelect.none")}</option>
      <LegacyOption value={value} known={DICE_VALUES} />
      {DICE_VALUES.map((d) => (
        <option key={d} value={d}>{d}</option>
      ))}
    </select>
  );
}

export function AtkSelect({ value, disabled, onChange, className = "" }: SelectProps) {
  const { t } = useT();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`${SELECT_CLS} ${className}`}>
      <option value="">{t("equipSelect.none")}</option>
      <LegacyOption value={value} known={ATK_VALUES} />
      {ATK_VALUES.map((a) => (
        <option key={a} value={a}>{a}</option>
      ))}
    </select>
  );
}

/** Attribut/färdighet ur rullista - kanoniskt engelskt namn lagras. */
export function StatNameSelect({ value, disabled, onChange, className = "", placeholderKey = "bonusEditor.selectStat" }: SelectProps & { placeholderKey?: "bonusEditor.selectStat" | "equipSelect.none" }) {
  const { t, locale } = useT();
  const canonical = value ? normalizeStatName(value) ?? value : "";
  const known: string[] = [...ATTRIBUTE_NAMES, ...SKILL_NAMES];
  return (
    <select value={canonical} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={`${SELECT_CLS} ${className}`}>
      <option value="">{t(placeholderKey)}</option>
      <LegacyOption value={canonical} known={known} />
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
  );
}

/** Basvapen ur vapendatat; anropar onPick med hela vapnet för förifyllnad. */
export function BaseWeaponSelect({ value, disabled, onChange, onPick, className = "" }: SelectProps & { onPick: (weapon: WeaponData) => void }) {
  const { t } = useT();
  const names = WEAPON_CATEGORIES.flatMap((c) => getWeaponsByType(c).map((w) => w.name));
  return (
    <select
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        const w = getWeapon(e.target.value);
        if (w) onPick(w);
      }}
      disabled={disabled}
      className={`${SELECT_CLS} ${className}`}
    >
      <option value="">{t("equipSelect.custom")}</option>
      <LegacyOption value={value} known={names} />
      {WEAPON_CATEGORIES.map((cat) => (
        <optgroup key={cat} label={cat}>
          {getWeaponsByType(cat).map((w) => (
            <option key={w.name} value={w.name}>{w.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Basrustning (alla kroppsdelar); onPick förifyller AC/HP/kroppsdel/nackdel. */
export function BaseArmorSelect({ value, disabled, onChange, onPick, className = "" }: SelectProps & { onPick: (armor: ArmorData) => void }) {
  const { t } = useT();
  const names = ARMOR.map((a) => a.name);
  return (
    <select
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        const a = ARMOR.find((x) => x.name === e.target.value);
        if (a) onPick(a);
      }}
      disabled={disabled}
      className={`${SELECT_CLS} ${className}`}
    >
      <option value="">{t("equipSelect.custom")}</option>
      <LegacyOption value={value} known={names} />
      {BODY_PARTS.map((part) => (
        <optgroup key={part} label={t(`equipment.body.${part}` as never)}>
          {ARMOR.filter((a) => a.bodypart === part).map((a) => (
            <option key={a.name} value={a.name}>{a.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Bassköld; onPick förifyller AC/HP/skada/nackdel. */
export function ShieldSelect({ value, disabled, onChange, onPick, className = "" }: SelectProps & { onPick: (shield: ShieldData) => void }) {
  const { t } = useT();
  const names = SHIELDS.map((s) => s.name);
  return (
    <select
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        const s = SHIELDS.find((x) => x.name === e.target.value);
        if (s) onPick(s);
      }}
      disabled={disabled}
      className={`${SELECT_CLS} ${className}`}
    >
      <option value="">{t("equipSelect.custom")}</option>
      <LegacyOption value={value} known={names} />
      {SHIELDS.map((s) => (
        <option key={s.name} value={s.name}>{s.name}</option>
      ))}
    </select>
  );
}

// --- Fördelsbyggare --------------------------------------------------------

interface AdvEntry {
  value: number; // positivt
  stat: string; // kanoniskt namn
}

function parseAdvantages(raw: string): { entries: AdvEntry[]; unparseable: boolean } {
  if (!raw.trim()) return { entries: [], unparseable: false };
  const entries: AdvEntry[] = [];
  for (const part of raw.split(",")) {
    const match = part.trim().match(/^\+?(\d+)\s+(.+)$/);
    if (match) {
      entries.push({ value: parseInt(match[1]), stat: match[2] });
      continue;
    }
    // Rent statnamn (tidigare format utan värde) → tolka som +1
    const stat = normalizeStatName(part);
    if (stat) {
      entries.push({ value: 1, stat });
      continue;
    }
    return { entries: [], unparseable: true };
  }
  return { entries, unparseable: false };
}

function serializeAdvantages(entries: AdvEntry[]): string {
  return entries.map((e) => `+${e.value} ${e.stat}`).join(", ");
}

/**
 * Fördel = stat (rullista) + styrka (+1…+5), lagrad läsbart som "+3 Stealth".
 * Ingenting parsar advantage maskinellt (ren visning för spelaren), men
 * formatet speglar bonus-syntaxen. Äldre fritext som inte matchar visas som
 * redigerbar text i stället för att skrivas över.
 */
export function AdvantageEditor({ value, disabled, onChange }: SelectProps) {
  const { t } = useT();
  const { entries, unparseable } = parseAdvantages(value);

  if (unparseable) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${SELECT_CLS} w-full`}
        placeholder={t("sessionCard.equipment.advantage")}
      />
    );
  }

  function updateEntry(i: number, patch: Partial<AdvEntry>) {
    onChange(serializeAdvantages(entries.map((e, j) => (j === i ? { ...e, ...patch } : e))));
  }

  return (
    <div className="space-y-1">
      <span className="text-[10px] text-text-faint">
        {t("sessionCard.equipment.advantage")}
        {/* Förtydligande - fördel förväxlades med stat-bonus (påverkar ej builden) */}
        <span className="ml-1 italic opacity-70">({t("equipSelect.advantageHint")})</span>
      </span>
      {entries.map((e, i) => (
        <div key={i} className="flex items-center gap-1">
          <StatNameSelect
            value={e.stat}
            disabled={disabled}
            onChange={(v) => updateEntry(i, { stat: v })}
            className="flex-1 max-w-48"
            placeholderKey="bonusEditor.selectStat"
          />
          <button
            onClick={() => updateEntry(i, { value: Math.max(1, e.value - 1) })}
            disabled={disabled || e.value <= 1}
            aria-label={t("common.decrease")}
            className="w-6 h-6 pointer-coarse:w-9 pointer-coarse:h-9 rounded bg-bg-surface text-xs text-red-400 disabled:opacity-30"
          >
            -
          </button>
          <span className="w-8 text-center font-mono text-xs text-green-400">+{e.value}</span>
          <button
            onClick={() => updateEntry(i, { value: Math.min(5, e.value + 1) })}
            disabled={disabled || e.value >= 5}
            aria-label={t("common.increase")}
            className="w-6 h-6 pointer-coarse:w-9 pointer-coarse:h-9 rounded bg-bg-surface text-xs text-green-400 disabled:opacity-30"
          >
            +
          </button>
          {!disabled && (
            <button
              onClick={() => onChange(serializeAdvantages(entries.filter((_, j) => j !== i)))}
              aria-label={t("common.remove")}
              className="p-2 -m-2 text-red-400 hover:text-red-300"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          onClick={() => onChange(serializeAdvantages([...entries, { value: 1, stat: "Strength" }]))}
          className="text-[10px] text-green-400/80 hover:text-green-300"
        >
          {t("equipSelect.addAdvantage")}
        </button>
      )}
    </div>
  );
}

// --- Nackdelsbyggare -------------------------------------------------------

/** Förkortningarna som armor-datat + aggregateDisadvantages använder. */
const PENALTY_ABBRS: { abbr: string; skill: string }[] = [
  { abbr: "Acro", skill: "Acrobatics" },
  { abbr: "Ath", skill: "Athletics" },
  { abbr: "Per", skill: "Perception" },
  { abbr: "SoH", skill: "Sleight of Hand" },
  { abbr: "Stl", skill: "Stealth" },
];

interface PenaltyEntry {
  value: number; // negativt
  abbr: string;
}

function parsePenalties(raw: string): { entries: PenaltyEntry[]; unparseable: boolean } {
  if (!raw.trim()) return { entries: [], unparseable: false };
  const entries: PenaltyEntry[] = [];
  for (const part of raw.split(",")) {
    const match = part.trim().match(/^(-\d+)\s+(.+)$/);
    if (!match) return { entries: [], unparseable: true };
    entries.push({ value: parseInt(match[1]), abbr: match[2] });
  }
  return { entries, unparseable: false };
}

function serializePenalties(entries: PenaltyEntry[]): string {
  return entries.map((e) => `${e.value} ${e.abbr}`).join(", ");
}

export function DisadvantageEditor({ value, disabled, onChange }: SelectProps) {
  const { t, locale } = useT();
  const { entries, unparseable } = parsePenalties(value);

  // Äldre fritext som inte följer formatet ("Dexterity checks") - rör inte,
  // visa som redigerbar text så datat inte korrumperas.
  if (unparseable) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${SELECT_CLS} w-full`}
        placeholder={t("sessionCard.equipment.disadvantage")}
      />
    );
  }

  function updateEntry(i: number, patch: Partial<PenaltyEntry>) {
    onChange(serializePenalties(entries.map((e, j) => (j === i ? { ...e, ...patch } : e))));
  }

  return (
    <div className="space-y-1">
      <span className="text-[10px] text-text-faint">{t("sessionCard.equipment.disadvantage")}</span>
      {entries.map((e, i) => (
        <div key={i} className="flex items-center gap-1">
          <select
            value={e.abbr}
            onChange={(ev) => updateEntry(i, { abbr: ev.target.value })}
            disabled={disabled}
            className={`${SELECT_CLS} flex-1 max-w-44`}
          >
            {!PENALTY_ABBRS.some((p) => p.abbr === e.abbr) && (
              <option value={e.abbr}>{e.abbr} (?)</option>
            )}
            {PENALTY_ABBRS.map((p) => (
              <option key={p.abbr} value={p.abbr}>
                {normalizeStatName(p.skill) ? tSkill(p.skill, locale) : p.skill}
              </option>
            ))}
          </select>
          <button
            onClick={() => updateEntry(i, { value: Math.max(-5, e.value - 1) })}
            disabled={disabled || e.value <= -5}
            aria-label={t("common.decrease")}
            className="w-6 h-6 pointer-coarse:w-9 pointer-coarse:h-9 rounded bg-bg-surface text-xs text-red-400 disabled:opacity-30"
          >
            -
          </button>
          <span className="w-8 text-center font-mono text-xs text-red-400">{e.value}</span>
          <button
            onClick={() => updateEntry(i, { value: Math.min(-1, e.value + 1) })}
            disabled={disabled || e.value >= -1}
            aria-label={t("common.increase")}
            className="w-6 h-6 pointer-coarse:w-9 pointer-coarse:h-9 rounded bg-bg-surface text-xs text-green-400 disabled:opacity-30"
          >
            +
          </button>
          {!disabled && (
            <button
              onClick={() => onChange(serializePenalties(entries.filter((_, j) => j !== i)))}
              aria-label={t("common.remove")}
              className="p-2 -m-2 text-red-400 hover:text-red-300"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          onClick={() => onChange(serializePenalties([...entries, { value: -1, abbr: "Stl" }]))}
          className="text-[10px] text-text-faint hover:text-text-muted"
        >
          {t("equipSelect.addPenalty")}
        </button>
      )}
    </div>
  );
}
