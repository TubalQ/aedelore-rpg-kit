"use client";

import { useSyncExternalStore } from "react";
import { X, BookOpen, Check } from "lucide-react";
import { useT } from "@/lib/i18n";

interface OnboardingBannerProps {
  characterId: number;
  hasRaceClass: boolean;
  raceClassLocked: boolean;
  attributesLocked: boolean;
  abilitiesLocked: boolean;
  inCampaign: boolean;
}

function dismissKey(characterId: number): string {
  return `aedelore-onboarding-dismissed-${characterId}`;
}

// Egen event-typ eftersom "storage" bara triggas från andra flikar
const DISMISS_EVENT = "aedelore-onboarding-dismiss";

function subscribeDismiss(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(DISMISS_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(DISMISS_EVENT, callback);
  };
}

export function OnboardingBanner({
  characterId,
  hasRaceClass,
  raceClassLocked,
  attributesLocked,
  abilitiesLocked,
  inCampaign,
}: OnboardingBannerProps) {
  const { t } = useT();
  const dismissed = useSyncExternalStore(
    subscribeDismiss,
    () => localStorage.getItem(dismissKey(characterId)) === "1",
    () => true,
  );

  function dismiss() {
    localStorage.setItem(dismissKey(characterId), "1");
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }

  const STEPS = [
    { title: t("onboarding.step1Title"), desc: t("onboarding.step1Desc"), done: hasRaceClass },
    { title: t("onboarding.step2Title"), desc: t("onboarding.step2Desc"), done: raceClassLocked },
    { title: t("onboarding.step3Title"), desc: t("onboarding.step3Desc"), done: attributesLocked },
    { title: t("onboarding.step4Title"), desc: t("onboarding.step4Desc"), done: abilitiesLocked },
    { title: t("onboarding.step5Title"), desc: t("onboarding.step5Desc"), done: inCampaign },
  ];

  const doneCount = STEPS.filter((s) => s.done).length;
  const allDone = doneCount === STEPS.length;
  const nextIndex = STEPS.findIndex((s) => !s.done);

  if (dismissed || allDone) return null;

  return (
    <div className="rounded-lg border border-accent-gold/30 bg-accent-gold/5 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 text-accent-gold">
          <BookOpen size={16} />
          <h3 className="text-sm font-semibold">{t("onboarding.welcome")}</h3>
          <span className="text-xs text-text-faint font-normal">
            {t("onboarding.progress", { done: doneCount, total: STEPS.length })}
          </span>
        </div>
        <button
          onClick={dismiss}
          aria-label={t("onboarding.dismiss")}
          className="text-text-faint hover:text-text-muted transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <p className="text-xs text-text-muted mb-3">
        {t("onboarding.instructions")}
      </p>
      <ol className="space-y-1.5">
        {STEPS.map((s, i) => (
          <li key={i} className={`flex gap-2 text-xs ${s.done ? "opacity-60" : ""}`}>
            {s.done ? (
              <span className="shrink-0 w-4 h-4 rounded-full bg-green-900/40 text-green-400 flex items-center justify-center">
                <Check size={10} />
              </span>
            ) : (
              <span
                className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  i === nextIndex
                    ? "border border-accent-gold text-accent-gold"
                    : "bg-bg-elevated text-text-faint"
                }`}
              >
                {i + 1}
              </span>
            )}
            <div>
              <span className={`font-medium ${s.done ? "text-text-muted line-through" : "text-text-base"}`}>
                {s.title}
              </span>
              {!s.done && <span className="text-text-muted"> - {s.desc}</span>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
