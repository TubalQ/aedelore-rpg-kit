"use client";

import { useState, useCallback } from "react";
import type { CharacterData } from "@/lib/schemas/character";
import {
  ATTRIBUTE_NAMES,
  getSkillsForAttribute,
  getModifier,
  getFreePointsTotal,
  getMaxPointsPerField,
  getXpPerPoint,
} from "@/lib/domain/attributes";
import type { Attribute } from "@/lib/domain/attributes";
import { computeBonusSources } from "@/lib/domain/bonus-calc";
import { useSpendXp } from "@/hooks/useCharacters";
import { useT, tAttr, tSkill } from "@/lib/i18n";

/** "+1" / "−2" - källuppdelningen ska kunna visa negativa bonusar också. */
function fmtSigned(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}

interface AttributesProps {
  characterId: number;
  data: CharacterData;
  locked: boolean;
  /** Attribute points purchasable with available XP (floor(availableXp / 10)). */
  xpPointsAvailable: number;
  onChange: (partial: Partial<CharacterData>) => void;
}

function DiceRollInline({ modifier }: { modifier: number }) {
  const [result, setResult] = useState<{ roll: number; total: number } | null>(null);

  const roll = useCallback(() => {
    const r = Math.floor(Math.random() * 20) + 1;
    setResult({ roll: r, total: r + modifier });
    setTimeout(() => setResult(null), 3000);
  }, [modifier]);

  return (
    <button
      onClick={roll}
      className="w-6 h-6 pointer-coarse:w-9 pointer-coarse:h-9 rounded bg-bg-surface text-[10px] text-text-faint hover:text-accent-gold hover:bg-accent-gold/10 relative"
      title={`D20 + ${modifier}`}
    >
      D20
      {result && (
        <span className={`absolute -top-5 -right-1 rounded px-1 text-[10px] font-bold ${
          result.roll === 20 ? "text-green-400" : result.roll === 1 ? "text-red-400" : "text-accent-gold"
        }`}>
          {result.total}
        </span>
      )}
    </button>
  );
}

type Deltas = { attributes: Record<string, number>; skills: Record<string, number> };

export function AttributesSection({ characterId, data, locked, xpPointsAvailable, onChange }: AttributesProps) {
  const { t, locale } = useT();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Live rules scalars from the active system (DB-backed via SystemProvider).
  const FREE_POINTS_TOTAL = getFreePointsTotal();
  const MAX_POINTS_PER_FIELD = getMaxPointsPerField();
  const XP_PER_POINT = getXpPerPoint();

  // XP spend mode: raise attributes/skills past the creation cap, paid with XP.
  const [spendMode, setSpendMode] = useState(false);
  const [deltas, setDeltas] = useState<Deltas>({ attributes: {}, skills: {} });
  const spendXp = useSpendXp(characterId);

  const attrValues = data.attributes as Record<string, number>;
  const skillValues = data.skills as Record<string, number>;
  const pointsUsed = Object.values(attrValues).reduce((s, v) => s + (v || 0), 0)
    + Object.values(skillValues).reduce((s, v) => s + (v || 0), 0);
  const pointsLeft = FREE_POINTS_TOTAL - pointsUsed;

  const pointsAdded =
    Object.values(deltas.attributes).reduce((s, v) => s + v, 0) +
    Object.values(deltas.skills).reduce((s, v) => s + v, 0);
  const canStartSpend = locked && xpPointsAvailable > 0 && !spendMode;

  function startSpend() {
    setDeltas({ attributes: {}, skills: {} });
    setSpendMode(true);
  }
  function cancelSpend() {
    setSpendMode(false);
    setDeltas({ attributes: {}, skills: {} });
  }
  function confirmSpend() {
    if (pointsAdded < 1) return;
    spendXp.mutate(
      { attributes: deltas.attributes, skills: deltas.skills },
      { onSuccess: () => cancelSpend() },
    );
  }

  // ----- creation-mode distribution (unchanged) -----
  function setAttr(attr: Attribute, value: number) {
    const current = attrValues[attr] ?? 0;
    const clamped = Math.max(0, Math.min(value, MAX_POINTS_PER_FIELD));
    const delta = clamped - current;
    if (delta > 0 && pointsLeft < delta) return;
    onChange({ attributes: { ...data.attributes, [attr]: clamped } });
  }
  function setSkill(skill: string, value: number) {
    const current = skillValues[skill] ?? 0;
    const clamped = Math.max(0, Math.min(value, MAX_POINTS_PER_FIELD));
    const delta = clamped - current;
    if (delta > 0 && pointsLeft < delta) return;
    onChange({ skills: { ...data.skills, [skill]: clamped } });
  }

  // ----- spend-mode delta adjustments -----
  function bumpAttrDelta(attr: string, dir: 1 | -1) {
    setDeltas((prev) => {
      const cur = prev.attributes[attr] ?? 0;
      if (dir === 1 && pointsAdded >= xpPointsAvailable) return prev;
      const next = Math.max(0, cur + dir);
      return { ...prev, attributes: { ...prev.attributes, [attr]: next } };
    });
  }
  function bumpSkillDelta(skill: string, dir: 1 | -1) {
    setDeltas((prev) => {
      const cur = prev.skills[skill] ?? 0;
      if (dir === 1 && pointsAdded >= xpPointsAvailable) return prev;
      const next = Math.max(0, cur + dir);
      return { ...prev, skills: { ...prev.skills, [skill]: next } };
    });
  }

  return (
    <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold text-text-base">{t("attributes.title")}</h2>
        <div className="flex items-center gap-2">
          {!locked && !spendMode && (
            <span className={`text-sm font-mono ${pointsLeft === 0 ? "text-text-faint" : "text-accent-gold"}`}>
              {pointsLeft}/{FREE_POINTS_TOTAL}
            </span>
          )}
          {spendMode ? (
            <>
              <span className="text-sm font-mono text-accent-gold">
                {t("attributes.spendProgress", { used: pointsAdded, total: xpPointsAvailable })}
              </span>
              <button
                onClick={confirmSpend}
                disabled={pointsAdded < 1 || spendXp.isPending}
                className="rounded bg-accent-gold/20 px-3 py-1 text-xs font-medium text-accent-gold hover:bg-accent-gold/30 disabled:opacity-50"
              >
                {t("common.confirm")}
              </button>
              <button
                onClick={cancelSpend}
                disabled={spendXp.isPending}
                className="rounded bg-bg-base px-3 py-1 text-xs text-text-muted hover:text-text-base disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
            </>
          ) : canStartSpend ? (
            <button
              onClick={startSpend}
              className="rounded bg-accent-gold/20 px-3 py-1 text-xs font-medium text-accent-gold hover:bg-accent-gold/30"
            >
              {t("attributes.spendXp", { count: xpPointsAvailable })}
            </button>
          ) : (
            locked && <span className="text-xs px-2 py-0.5 rounded-full bg-accent-gold/10 text-accent-gold">{t("common.locked")}</span>
          )}
        </div>
      </div>

      {spendMode && (
        <p className="text-xs text-accent-gold/80">
          {t("attributes.spendHint", { cost: XP_PER_POINT })}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ATTRIBUTE_NAMES.map((attr) => {
          const baseVal = (data.attributes as Record<string, number>)[attr] ?? 0;
          const distributedVal = baseVal + (spendMode ? deltas.attributes[attr] ?? 0 : 0);
          const sources = computeBonusSources(attr, distributedVal, data);
          const modifier = getModifier(sources.total);
          const skills = getSkillsForAttribute(attr);
          const isExpanded = expanded === attr;

          const minusDisabled = spendMode
            ? (deltas.attributes[attr] ?? 0) <= 0
            : locked || distributedVal <= 0;
          const plusDisabled = spendMode
            ? pointsAdded >= xpPointsAvailable
            : locked || distributedVal >= MAX_POINTS_PER_FIELD || pointsLeft <= 0;

          return (
            <div key={attr} className="rounded border border-border/50 bg-bg-base p-3 space-y-2">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setExpanded(isExpanded ? null : attr)}
                  className="text-sm font-semibold text-accent-gold hover:text-accent-gold/80 text-left"
                >
                  {tAttr(attr, locale)}
                </button>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-faint">
                    mod +{modifier}
                  </span>
                  <DiceRollInline modifier={modifier} />
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => (spendMode ? bumpAttrDelta(attr, -1) : setAttr(attr, distributedVal - 1))}
                      disabled={minusDisabled}
                      aria-label={`${t("common.decrease")} ${tAttr(attr, locale)}`}
                      className="w-5 h-5 pointer-coarse:w-10 pointer-coarse:h-10 pointer-coarse:text-base rounded bg-bg-surface text-text-muted text-xs disabled:opacity-30"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-mono text-sm text-text-base">{sources.total}</span>
                    <button
                      onClick={() => (spendMode ? bumpAttrDelta(attr, 1) : setAttr(attr, distributedVal + 1))}
                      disabled={plusDisabled}
                      aria-label={`${t("common.increase")} ${tAttr(attr, locale)}`}
                      className="w-5 h-5 pointer-coarse:w-10 pointer-coarse:h-10 pointer-coarse:text-base rounded bg-bg-surface text-text-muted text-xs disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {isExpanded && (sources.race !== 0 || sources.class !== 0 || sources.religion !== 0 || sources.equipment !== 0) && (
                <div className="text-[10px] text-text-faint flex gap-2 flex-wrap">
                  {sources.race !== 0 && <span>{t("raceClass.race")} {fmtSigned(sources.race)}</span>}
                  {sources.class !== 0 && <span>{t("raceClass.class")} {fmtSigned(sources.class)}</span>}
                  {sources.religion !== 0 && <span>{t("raceClass.religion")} {fmtSigned(sources.religion)}</span>}
                  {/* Per föremål ("Svärd +1") i stället för klumpsumma - och även negativa syns */}
                  {sources.equipmentItems.map((it, j) => (
                    <span key={j} className={it.value > 0 ? "text-green-400/70" : "text-red-400/70"}>
                      {it.kind === "weapon" ? "⚔" : "🛡"} {it.name} {fmtSigned(it.value)}
                    </span>
                  ))}
                  <span>{t("attributes.distributed")} +{sources.distributed}</span>
                </div>
              )}

              {skills.length > 0 && (
                <div className="space-y-1 pl-2 border-l border-border/30">
                  {skills.map((skill) => {
                    const skillBase = (data.skills as Record<string, number>)[skill] ?? 0;
                    const skillDistributed = skillBase + (spendMode ? deltas.skills[skill] ?? 0 : 0);
                    const skillSources = computeBonusSources(skill, skillDistributed, data);
                    const skillMod = getModifier(skillSources.total);

                    const sMinusDisabled = spendMode
                      ? (deltas.skills[skill] ?? 0) <= 0
                      : locked || skillDistributed <= 0;
                    const sPlusDisabled = spendMode
                      ? pointsAdded >= xpPointsAvailable
                      : locked || skillDistributed >= MAX_POINTS_PER_FIELD || pointsLeft <= 0;

                    return (
                      <div key={skill} className="flex items-center justify-between text-xs">
                        <span className="text-text-faint">
                          {tSkill(skill, locale)}
                          {/* Utrustningsbonus per föremål - syntes inte alls på skill-rader förr */}
                          {skillSources.equipmentItems.map((it, j) => (
                            <span key={j} className={`ml-1.5 text-[10px] ${it.value > 0 ? "text-green-400/70" : "text-red-400/70"}`}>
                              {it.kind === "weapon" ? "⚔" : "🛡"} {fmtSigned(it.value)}
                            </span>
                          ))}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-text-faint">+{skillMod}</span>
                          <DiceRollInline modifier={skillMod} />
                          <button
                            onClick={() => (spendMode ? bumpSkillDelta(skill, -1) : setSkill(skill, skillDistributed - 1))}
                            disabled={sMinusDisabled}
                            aria-label={`${t("common.decrease")} ${tSkill(skill, locale)}`}
                            className="w-4 h-4 pointer-coarse:w-9 pointer-coarse:h-9 pointer-coarse:text-sm rounded bg-bg-surface text-text-muted text-[10px] disabled:opacity-30"
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-mono text-text-base">{skillSources.total}</span>
                          <button
                            onClick={() => (spendMode ? bumpSkillDelta(skill, 1) : setSkill(skill, skillDistributed + 1))}
                            disabled={sPlusDisabled}
                            aria-label={`${t("common.increase")} ${tSkill(skill, locale)}`}
                            className="w-4 h-4 pointer-coarse:w-9 pointer-coarse:h-9 pointer-coarse:text-sm rounded bg-bg-surface text-text-muted text-[10px] disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {spendXp.isError && (
        <p className="text-xs text-red-400">
          {(spendXp.error as Error)?.message ?? t("progression.errorOccurred")}
        </p>
      )}
    </section>
  );
}
