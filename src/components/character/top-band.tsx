"use client";

import { useState } from "react";
import type { CharacterData } from "@/lib/schemas/character";
import { CLASSES } from "@/lib/domain/classes";
import type { CharacterClass } from "@/lib/domain/classes";
import { computeTotalAc } from "@/lib/domain/armor";
import { AvatarEditor } from "./avatar";
import { ProgressionSection } from "./sections/progression";
import { WORTHINESS_MAX, WORTHINESS_MIN } from "@/lib/domain/starting-data";
import { useT, tRace, tClass } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";
import { ChevronRight } from "lucide-react";

const WILLPOWER_MAX = 3;
const BLEED_MAX = 6;
const WEAKENED_MAX = 6;

function hpFill(pct: number): string {
  if (pct >= 60) return "var(--cs-hp)";
  if (pct >= 30) return "#d8b36a";
  return "var(--cs-danger)";
}
function counterColor(v: number): string {
  if (v <= 2) return "var(--cs-ok)";
  if (v <= 4) return "#d8b36a";
  return "var(--cs-danger)";
}
function worthinessColor(v: number): string {
  if (v >= 7) return "var(--cs-ok)";
  if (v >= 3) return "#d8b36a";
  if (v >= 0) return "var(--color-text-muted)";
  if (v >= -5) return "#d18b5a";
  return "var(--cs-danger)";
}
function worthinessDescKey(v: number): TranslationKey {
  if (v === 10) return "overview.worthiness.10";
  if (v >= 9) return "overview.worthiness.9";
  if (v >= 7) return "overview.worthiness.7";
  if (v >= 5) return "overview.worthiness.5";
  if (v >= 3) return "overview.worthiness.3";
  if (v >= 1) return "overview.worthiness.1";
  if (v === 0) return "overview.worthiness.0";
  if (v >= -2) return "overview.worthiness.-2";
  if (v >= -5) return "overview.worthiness.-5";
  if (v >= -8) return "overview.worthiness.-8";
  return "overview.worthiness.-10";
}

/** Segmented pip bar: caps at 10 cells so it stays legible on a phone. */
function Pips({ cur, max, fill }: { cur: number; max: number; fill: string }) {
  const cap = Math.min(Math.max(max, 1), 10);
  const filled = Math.round((cur / Math.max(max, 1)) * cap);
  return (
    <div className="cs-pips">
      {Array.from({ length: cap }, (_, i) => (
        <div
          key={i}
          className="cs-pip"
          style={i < filled ? { background: fill, borderColor: fill } : undefined}
        />
      ))}
    </div>
  );
}

function Vital({
  label,
  cur,
  max,
  fill,
  onChange,
}: {
  label: string;
  cur: number;
  max: number;
  fill: string;
  onChange: (v: number) => void;
}) {
  const { t } = useT();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] uppercase tracking-[0.16em] text-text-muted" style={{ fontFamily: "var(--font-heading)" }}>{label}</span>
        <div className="flex items-center gap-2">
          <button className="cs-step" aria-label={`${t("common.decrease")} ${label}`} onClick={() => onChange(Math.max(0, cur - 1))}>−</button>
          <span className="cs-num text-[20px] text-text-base min-w-[52px] text-center">{cur}<span className="text-[11px] text-text-faint">/{max}</span></span>
          <button className="cs-step" aria-label={`${t("common.increase")} ${label}`} onClick={() => onChange(Math.min(max, cur + 1))}>+</button>
        </div>
      </div>
      <Pips cur={cur} max={max} fill={fill} />
    </div>
  );
}

function Counter({
  label,
  value,
  max,
  color,
  warn,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  warn?: string;
  onChange: (v: number) => void;
}) {
  const { t } = useT();
  return (
    <div className="px-2.5 py-2 border-r border-b border-[color:var(--cs-line-soft)] flex flex-col gap-1 [&:nth-child(2n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0">
      <span className="text-[9px] uppercase tracking-[0.2em] text-text-faint" style={{ fontFamily: "var(--font-heading)" }}>{label}</span>
      <div className="flex items-center gap-2">
        <span className="cs-num text-[21px] min-w-[22px]" style={{ color }}>{value}</span>
        <span className="ml-auto flex gap-1.5">
          <button className="cs-mini-step border border-border text-text-muted text-sm leading-none hover:border-[color:var(--cs-gold-rule)] hover:text-[color:var(--cs-gold-bright)]" aria-label={`${t("common.decrease")} ${label}`} onClick={() => onChange(Math.max(0, value - 1))}>−</button>
          <button className="cs-mini-step border border-border text-text-muted text-sm leading-none hover:border-[color:var(--cs-gold-rule)] hover:text-[color:var(--cs-gold-bright)]" aria-label={`${t("common.increase")} ${label}`} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
        </span>
      </div>
      {warn && value >= max && <span className="text-[9px] text-[color:var(--cs-danger)]">{warn}</span>}
    </div>
  );
}

interface TopBandProps {
  characterId: number;
  name: string;
  data: CharacterData;
  xp: number;
  xpSpent: number;
  raceClassLocked: boolean;
  attributesLocked: boolean;
  abilitiesLocked: boolean;
  inCampaign: boolean;
  locksDmHeld: boolean;
  onChange: (partial: Partial<CharacterData>) => void;
  onImmediate: (partial: Partial<CharacterData>) => void;
}

export function TopBand({
  characterId,
  name,
  data,
  xp,
  xpSpent,
  raceClassLocked,
  attributesLocked,
  abilitiesLocked,
  inCampaign,
  locksDmHeld,
  onChange,
  onImmediate,
}: TopBandProps) {
  const { t, locale } = useT();
  // Open the progression drawer by default when there's something to act on
  // (unspent XP, or steps still to lock), so XP handling isn't hidden exactly
  // when it matters. Fully-locked characters with no spare XP start collapsed.
  const [ladderOpen, setLadderOpen] = useState(
    () => xp - xpSpent > 0 || [raceClassLocked, attributesLocked, abilitiesLocked].filter(Boolean).length < 3,
  );

  const showArcana = data.class ? CLASSES[data.class as CharacterClass]?.abilityType === "arcana" : false;
  const totalAc = computeTotalAc(data.equippedArmor);
  const xpAvailable = xp - xpSpent;
  const lockedSteps = [raceClassLocked, attributesLocked, abilitiesLocked].filter(Boolean).length;
  const hasRaceAndClass = !!data.race && !!data.class;

  return (
    <div className="grid gap-[18px] py-[18px]">
      {/* portrait */}
      <div className="border border-border bg-bg-elevated p-[5px]">
        <AvatarEditor
          seed={data.avatarSeed || name}
          imageUrl={data.avatarImage || undefined}
          onSeedChange={(seed) => onImmediate({ avatarSeed: seed })}
          onImageChange={(url) => onImmediate({ avatarImage: url })}
          size={112}
        />
      </div>

      {/* vitals + counters */}
      <div className="flex flex-col gap-[18px]">
        <div className="flex flex-col gap-3.5">
          <Vital label={t("overview.hp")} cur={data.hp} max={data.maxHp} fill={hpFill(data.maxHp > 0 ? (data.hp / data.maxHp) * 100 : 0)} onChange={(v) => onImmediate({ hp: v })} />
          {showArcana && (
            <Vital label={t("overview.arcana")} cur={data.arcana} max={data.maxArcana} fill="var(--cs-arcana)" onChange={(v) => onImmediate({ arcana: v })} />
          )}
          <Vital label={t("overview.willpower")} cur={data.willpower} max={WILLPOWER_MAX} fill="var(--cs-will)" onChange={(v) => onImmediate({ willpower: v })} />
        </div>
        <div className="grid grid-cols-2 border-t border-b border-[color:var(--cs-line-soft)]">
          <Counter label={t("overview.bleed")} value={data.bleed} max={BLEED_MAX} color={counterColor(data.bleed)} warn={t("overview.maxBleed")} onChange={(v) => onImmediate({ bleed: v })} />
          <Counter label={t("overview.weakened")} value={data.weakened} max={WEAKENED_MAX} color={counterColor(data.weakened)} warn={t("overview.maxWeakened")} onChange={(v) => onImmediate({ weakened: v })} />
          <Counter label={t("overview.gold")} value={data.gold} max={9999} color="var(--color-accent-gold)" onChange={(v) => onImmediate({ gold: v })} />
          <Counter label={t("overview.food")} value={data.food} max={99} color="#d8b06a" onChange={(v) => onImmediate({ food: v })} />
        </div>
      </div>

      {/* stat box: AC / worthiness / XP + progression drawer */}
      <div className="cs-statbox">
        <div className="row"><span className="k">{t("equipment.totalAc")}</span><span className="v">{totalAc}</span></div>
        <div className="row">
          <span className="k">{t("overview.worthiness")}</span>
          <span className="flex items-center gap-2">
            <button className="cs-mini-step border border-border text-text-faint text-xs hover:text-[color:var(--cs-gold-bright)] hover:border-[color:var(--cs-gold-rule)]" aria-label={`${t("common.decrease")} ${t("overview.worthiness")}`} disabled={data.worthiness <= WORTHINESS_MIN} onClick={() => onChange({ worthiness: Math.min(WORTHINESS_MAX, Math.max(WORTHINESS_MIN, data.worthiness - 1)) })}>−</button>
            <span className="cs-num text-[22px]" style={{ color: worthinessColor(data.worthiness) }}>{data.worthiness > 0 ? `+${data.worthiness}` : data.worthiness}</span>
            <button className="cs-mini-step border border-border text-text-faint text-xs hover:text-[color:var(--cs-gold-bright)] hover:border-[color:var(--cs-gold-rule)]" aria-label={`${t("common.increase")} ${t("overview.worthiness")}`} disabled={data.worthiness >= WORTHINESS_MAX} onClick={() => onChange({ worthiness: Math.max(WORTHINESS_MIN, Math.min(WORTHINESS_MAX, data.worthiness + 1)) })}>+</button>
          </span>
        </div>
        <div className="px-3.5 pb-2.5 pt-0 text-[11px] italic leading-snug" style={{ color: worthinessColor(data.worthiness), borderBottom: "1px solid var(--cs-line-soft)" }}>{t(worthinessDescKey(data.worthiness))}</div>
        <div className="row"><span className="k">{t("progression.available")} XP</span><span className="v gold">{xpAvailable}</span></div>
        <div className="px-3.5 pb-2.5 text-[10px] text-[color:var(--cs-fainter)] cs-num">
          {t("progression.xp")} {xp} · {t("progression.spent")} {xpSpent} · {lockedSteps}/3 {t("common.locked").toLowerCase()}
        </div>
        <div className="border-t border-[color:var(--cs-line-soft)]">
          <button
            className="w-full text-left px-3.5 py-2.5 flex justify-between items-center text-[10px] uppercase tracking-[0.2em] text-accent-gold-dim hover:text-[color:var(--cs-gold-bright)]"
            style={{ fontFamily: "var(--font-heading)" }}
            aria-expanded={ladderOpen}
            onClick={() => setLadderOpen((o) => !o)}
          >
            <span>{t("progression.title")}{xpAvailable > 0 && <span className="text-accent-gold"> · {xpAvailable} XP</span>}</span>
            <ChevronRight size={14} className="transition-transform" style={{ transform: ladderOpen ? "rotate(90deg)" : "none" }} />
          </button>
          {ladderOpen && (
            <div className="px-2 pb-3">
              <ProgressionSection
                characterId={characterId}
                raceClassLocked={raceClassLocked}
                attributesLocked={attributesLocked}
                abilitiesLocked={abilitiesLocked}
                xp={xp}
                xpSpent={xpSpent}
                hasRaceAndClass={hasRaceAndClass}
                inCampaign={inCampaign}
                locksDmHeld={locksDmHeld}
              />
            </div>
          )}
        </div>
      </div>

      {/* race / class eyebrow under the band echoes the identity line */}
      {hasRaceAndClass && (
        <div className="text-center text-[10px] uppercase tracking-[0.3em] text-text-faint" style={{ fontFamily: "var(--font-heading)" }}>
          {tRace(data.race as string, locale)} · {tClass(data.class as string, locale)}
        </div>
      )}
    </div>
  );
}
