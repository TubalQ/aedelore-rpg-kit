"use client";

import { useLockStep } from "@/hooks/useCharacters";
import { Check, Lock } from "lucide-react";
import { useT } from "@/lib/i18n";
import { getXpPerPoint } from "@/lib/domain/attributes";

interface ProgressionProps {
  characterId: number;
  raceClassLocked: boolean;
  attributesLocked: boolean;
  abilitiesLocked: boolean;
  xp: number;
  xpSpent: number;
  hasRaceAndClass: boolean;
  /** Lås är en kampanjfunktion: utanför kampanj kan spelaren låsa upp själv. */
  inCampaign: boolean;
}

export function ProgressionSection({
  characterId,
  raceClassLocked,
  attributesLocked,
  abilitiesLocked,
  xp,
  xpSpent,
  hasRaceAndClass,
  inCampaign,
}: ProgressionProps) {
  const { t } = useT();
  const lockStep = useLockStep(characterId);

  const XP_PER_POINT = getXpPerPoint();
  const xpAvailable = xp - xpSpent;
  const attributePoints = Math.floor(xpAvailable / XP_PER_POINT);

  function handleLock(step: "raceClass" | "attributes" | "abilities", locked: boolean) {
    // I kampanj är låsning definitiv (DM låser upp); utanför kampanj kan
    // spelaren ångra sig själv - då behövs ingen avskräckande bekräftelse.
    if (locked && inCampaign && !window.confirm(t("character.lockConfirm"))) return;
    lockStep.mutate({ step, locked });
  }

  const steps = [
    {
      key: "raceClass" as const,
      label: t("progression.raceClass"),
      locked: raceClassLocked,
      canLock: hasRaceAndClass,
      desc: raceClassLocked
        ? t("progression.raceClassLocked")
        : t("progression.raceClassUnlocked"),
    },
    {
      key: "attributes" as const,
      label: t("progression.attributes"),
      locked: attributesLocked,
      canLock: raceClassLocked,
      desc: attributesLocked
        ? t("progression.attrLocked")
        : raceClassLocked
          ? t("progression.attrUnlockedReady")
          : t("progression.attrUnlockedWait"),
    },
    {
      key: "abilities" as const,
      label: t("progression.abilities"),
      locked: abilitiesLocked,
      canLock: attributesLocked,
      desc: abilitiesLocked
        ? t("progression.abilitiesLocked")
        : attributesLocked
          ? t("progression.abilitiesUnlockedReady")
          : t("progression.abilitiesUnlockedWait"),
    },
  ];

  const nextStepIndex = steps.findIndex((s) => !s.locked);
  const lockedCount = steps.filter((s) => s.locked).length;

  return (
    <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-base">{t("progression.title")}</h2>
        <span className="text-xs text-text-faint">
          {t("progression.stepsDone", { done: lockedCount, total: steps.length })}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((step, i) => (
          <div
            key={step.key}
            className={`rounded border p-3 space-y-2 ${
              step.locked
                ? "border-green-900/50 bg-green-950/10"
                : i === nextStepIndex
                  ? "border-accent-gold/50 bg-bg-base"
                  : "border-border/50 bg-bg-base opacity-70"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-base flex items-center gap-1.5">
                {step.locked ? (
                  <Check size={14} className="text-green-400" />
                ) : i === nextStepIndex ? (
                  <span className="w-3.5 h-3.5 rounded-full border border-accent-gold text-accent-gold text-[9px] flex items-center justify-center">{i + 1}</span>
                ) : (
                  <Lock size={12} className="text-text-faint" />
                )}
                {step.label}
              </span>
              {step.locked ? (
                <span className="text-xs text-green-400">{t("common.locked")}</span>
              ) : i === nextStepIndex ? (
                <span className="text-xs text-accent-gold">{t("progression.nextStep")}</span>
              ) : (
                <span className="text-xs text-text-faint">{t("common.unlocked")}</span>
              )}
            </div>
            <p className="text-xs text-text-faint">{step.desc}</p>
            {!step.locked && step.canLock && (
              <button
                onClick={() => handleLock(step.key, true)}
                disabled={lockStep.isPending}
                className="w-full rounded bg-accent-gold/20 px-3 py-1 text-xs font-medium text-accent-gold hover:bg-accent-gold/30 disabled:opacity-50"
              >
                {t("progression.lock")} {step.label}
              </button>
            )}
            {/* Utanför kampanj kan spelaren låsa upp själv - låsning är en
                kampanjfunktion, en ensam spelare ska inte kunna fastna. */}
            {step.locked && !inCampaign && (
              <button
                onClick={() => handleLock(step.key, false)}
                disabled={lockStep.isPending}
                className="w-full rounded border border-border px-3 py-1 text-xs font-medium text-text-muted hover:text-text-base hover:border-accent-gold/40 disabled:opacity-50"
              >
                {t("progression.unlock")} {step.label}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="rounded border border-border/50 bg-bg-base p-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">{t("progression.xp")}</span>
          <span className="font-mono text-text-base">{xp}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">{t("progression.spent")}</span>
          <span className="font-mono text-text-faint">{xpSpent}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">{t("progression.available")}</span>
          <span className="font-mono text-accent-gold">{xpAvailable}</span>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-border/30">
          {attributesLocked ? (
            attributePoints > 0 ? (
              <span className="text-xs text-accent-gold">
                {t("progression.pointsToSpend", { count: attributePoints })}
              </span>
            ) : (
              <span className="text-xs text-text-faint">
                {t("progression.buyHintNeedXp", { cost: XP_PER_POINT, available: xpAvailable })}
              </span>
            )
          ) : (
            <span className="text-xs text-text-faint">
              {t("progression.buyHintLockFirst", { cost: XP_PER_POINT })}
            </span>
          )}
        </div>
      </div>

      {lockStep.isError && (
        <p className="text-xs text-red-400">
          {(lockStep.error as Error)?.message ?? t("progression.errorOccurred")}
        </p>
      )}
    </section>
  );
}
