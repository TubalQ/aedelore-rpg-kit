"use client";

import type { CharacterData } from "@/lib/schemas/character";
import { CLASSES } from "@/lib/domain/classes";
import type { CharacterClass } from "@/lib/domain/classes";
import { useT } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

interface OverviewProps {
  data: CharacterData;
  onChange: (partial: Partial<CharacterData>) => void;
}

const BLEED_MAX = 6;
const WEAKENED_MAX = 6;
const WILLPOWER_MAX = 3;
const WORTHINESS_MIN = -10;
const WORTHINESS_MAX = 10;

function getHpColor(pct: number): string {
  if (pct >= 60) return "bg-green-500";
  if (pct >= 30) return "bg-yellow-500";
  return "bg-red-500";
}

function getCounterColor(value: number): string {
  if (value <= 2) return "text-green-400";
  if (value <= 4) return "text-yellow-400";
  return "text-red-400";
}

function getWorthinessColor(value: number): string {
  if (value >= 7) return "text-green-400";
  if (value >= 3) return "text-yellow-300";
  if (value >= 0) return "text-text-muted";
  if (value >= -5) return "text-orange-400";
  return "text-red-400";
}

function getWorthinessDescKey(value: number): TranslationKey {
  if (value === 10) return "overview.worthiness.10";
  if (value >= 9) return "overview.worthiness.9";
  if (value >= 7) return "overview.worthiness.7";
  if (value >= 5) return "overview.worthiness.5";
  if (value >= 3) return "overview.worthiness.3";
  if (value >= 1) return "overview.worthiness.1";
  if (value === 0) return "overview.worthiness.0";
  if (value >= -2) return "overview.worthiness.-2";
  if (value >= -5) return "overview.worthiness.-5";
  if (value >= -8) return "overview.worthiness.-8";
  return "overview.worthiness.-10";
}

function StatBar({
  label,
  value,
  max,
  colorFn,
  onChange,
  onMaxChange,
}: {
  label: string;
  value: number;
  max: number;
  colorFn: (pct: number) => string;
  onChange: (value: number) => void;
  onMaxChange?: (value: number) => void;
}) {
  const { t } = useT();
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-muted">{label}</span>
        <div className="flex items-center gap-1 font-mono text-text-base">
          <button
            onClick={() => onChange(Math.max(0, value - 1))}
            aria-label={`${t("common.decrease")} ${label}`}
            className="w-5 h-5 rounded bg-bg-base text-xs text-text-faint hover:text-text-base"
          >
            -
          </button>
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Math.max(0, Math.min(Number(e.target.value), max)))}
            className="w-10 bg-transparent text-center outline-none"
            min={0}
            max={max}
          />
          <span className="text-text-faint">/</span>
          {onMaxChange ? (
            <input
              type="number"
              value={max}
              onChange={(e) => onMaxChange(Math.max(0, Number(e.target.value)))}
              className="w-10 bg-transparent text-center outline-none text-text-faint"
              min={0}
            />
          ) : (
            <span className="text-text-faint">{max}</span>
          )}
          <button
            onClick={() => onChange(Math.min(max, value + 1))}
            aria-label={`${t("common.increase")} ${label}`}
            className="w-5 h-5 rounded bg-bg-base text-xs text-text-faint hover:text-text-base"
          >
            +
          </button>
        </div>
      </div>
      <div className="h-2 rounded-full bg-bg-base">
        <div
          className={`h-full rounded-full transition-all ${colorFn(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Counter({
  label,
  value,
  min,
  max,
  colorFn,
  onChange,
  warning,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  colorFn: (v: number) => string;
  onChange: (value: number) => void;
  warning?: string;
}) {
  const { t } = useT();
  return (
    <div className="text-center space-y-1">
      <p className="text-xs text-text-faint">{label}</p>
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`${t("common.decrease")} ${label}`}
          className="w-5 h-5 rounded bg-bg-base text-xs text-text-faint hover:text-text-base"
        >
          -
        </button>
        <span className={`text-lg font-bold font-mono w-8 text-center ${colorFn(value)}`}>{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`${t("common.increase")} ${label}`}
          className="w-5 h-5 rounded bg-bg-base text-xs text-text-faint hover:text-text-base"
        >
          +
        </button>
      </div>
      {warning && value >= max && (
        <p className="text-[10px] text-red-400">{warning}</p>
      )}
    </div>
  );
}

export function OverviewSection({ data, onChange }: OverviewProps) {
  const { t } = useT();
  const showArcana = data.class ? CLASSES[data.class as CharacterClass].abilityType === "arcana" : false;

  return (
    <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-4">
      <h2 className="text-lg font-semibold text-text-base">{t("overview.title")}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatBar
          label={t("overview.hp")}
          value={data.hp}
          max={data.maxHp}
          colorFn={getHpColor}
          onChange={(v) => onChange({ hp: v })}
        />
        {showArcana && (
          <StatBar
            label={t("overview.arcana")}
            value={data.arcana}
            max={data.maxArcana}
            colorFn={() => "bg-purple-500"}
            onChange={(v) => onChange({ arcana: v })}
          />
        )}
        <StatBar
          label={t("overview.willpower")}
          value={data.willpower}
          max={WILLPOWER_MAX}
          colorFn={() => "bg-blue-500"}
          onChange={(v) => onChange({ willpower: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Counter
          label={t("overview.bleed")}
          value={data.bleed}
          min={0}
          max={BLEED_MAX}
          colorFn={getCounterColor}
          onChange={(v) => onChange({ bleed: v })}
          warning={t("overview.maxBleed")}
        />
        <Counter
          label={t("overview.weakened")}
          value={data.weakened}
          min={0}
          max={WEAKENED_MAX}
          colorFn={getCounterColor}
          onChange={(v) => onChange({ weakened: v })}
          warning={t("overview.maxWeakened")}
        />
        <Counter
          label={t("overview.gold")}
          value={data.gold}
          min={0}
          max={9999}
          colorFn={() => "text-yellow-300"}
          onChange={(v) => onChange({ gold: v })}
        />
        <Counter
          label={t("overview.food")}
          value={data.food}
          min={0}
          max={99}
          colorFn={() => "text-amber-300"}
          onChange={(v) => onChange({ food: v })}
        />
      </div>

      <div className="rounded border border-border/50 bg-bg-base p-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">{t("overview.worthiness")}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onChange({ worthiness: Math.max(WORTHINESS_MIN, data.worthiness - 1) })}
              aria-label={`${t("common.decrease")} ${t("overview.worthiness")}`}
              className="w-5 h-5 rounded bg-bg-surface text-xs text-text-faint hover:text-text-base"
            >
              -
            </button>
            <span className={`text-lg font-bold font-mono w-8 text-center ${getWorthinessColor(data.worthiness)}`}>
              {data.worthiness > 0 ? `+${data.worthiness}` : data.worthiness}
            </span>
            <button
              onClick={() => onChange({ worthiness: Math.min(WORTHINESS_MAX, data.worthiness + 1) })}
              aria-label={`${t("common.increase")} ${t("overview.worthiness")}`}
              className="w-5 h-5 rounded bg-bg-surface text-xs text-text-faint hover:text-text-base"
            >
              +
            </button>
          </div>
        </div>
        <p className={`text-xs ${getWorthinessColor(data.worthiness)}`}>
          {t(getWorthinessDescKey(data.worthiness))}
        </p>
      </div>

      {/* --- Background --- */}
      <div className="space-y-1">
        <label className="text-sm text-text-muted">{t("overview.background")}</label>
        <textarea
          value={data.background}
          onChange={(e) => onChange({ background: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-base resize-y focus:border-accent-gold/50 focus:outline-none"
          placeholder={t("overview.backgroundPlaceholder")}
        />
      </div>
    </section>
  );
}
