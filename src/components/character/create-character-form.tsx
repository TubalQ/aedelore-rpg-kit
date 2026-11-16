"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCreateCharacterWithSetup } from "@/hooks/useCharacters";
import { useT, tRace, tClass, tReligion, tBonus } from "@/lib/i18n";
import { Avatar, AvatarEditor, getInitialAvatarSeed } from "./avatar";
import { RACE_NAMES, RACES, type Race } from "@/lib/domain/races";
import { CLASS_NAMES, CLASSES, type CharacterClass } from "@/lib/domain/classes";
import { RELIGION_NAMES, RELIGIONS, type Religion } from "@/lib/domain/religions";
import { computeStartingStats } from "@/lib/domain/starting-data";
import { cn } from "@/lib/utils/cn";
import { isReservedCharacterName } from "@/lib/schemas/visibility";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

type Step = "name" | "race-class" | "done";
const STEPS: Step[] = ["name", "race-class", "done"];

export function CreateCharacterForm() {
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [avatarSeed, setAvatarSeed] = useState(() => getInitialAvatarSeed(""));
  const [avatarImage, setAvatarImage] = useState("");
  const [race, setRace] = useState("");
  const [cls, setCls] = useState("");
  const [religion, setReligion] = useState("");
  const [characterId, setCharacterId] = useState<number | null>(null);
  const [validationError, setValidationError] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();
  // Only in-app campaign pages are accepted as a return target.
  const returnTo = searchParams.get("returnTo")?.startsWith("/campaigns") ? searchParams.get("returnTo") : null;
  const create = useCreateCharacterWithSetup();
  const creatingRef = useRef(false);
  const { t, locale } = useT();

  const stepIndex = STEPS.indexOf(step);

  function goNext() {
    if (step === "name") {
      if (!name.trim()) {
        setValidationError(t("character.enterName"));
        return;
      }
      if (isReservedCharacterName(name)) {
        setValidationError(t("character.reservedName"));
        return;
      }
      setValidationError("");
      // An untouched avatar follows the name (as before), a picked one is kept.
      if (avatarSeed === getInitialAvatarSeed("")) setAvatarSeed(getInitialAvatarSeed(name.trim()));
      setStep("race-class");
      return;
    }

    if (step === "race-class") {
      // Race and class are required (H1): the starting stats, gear and much of
      // the sheet build on them. Religion is optional.
      if (!race || !cls) {
        setValidationError(t("character.chooseRaceAndClass"));
        return;
      }
      setValidationError("");
      const raceClass = {
        race: race as Race,
        class: cls as CharacterClass,
        ...(religion ? { religion: religion as Religion } : {}),
      };
      const data: Record<string, unknown> = { avatarSeed, avatarImage };

      // A double click used to create two characters: isPending only disables
      // the button after the next render, so the second click got through.
      if (creatingRef.current) return;
      creatingRef.current = true;
      create.mutate(
        { name: name.trim(), raceClass, data },
        {
          onSuccess: (char) => {
            setCharacterId(char.id);
            setStep("done");
          },
          onSettled: () => {
            creatingRef.current = false;
          },
        },
      );
    }
  }

  function goBack() {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  }

  const raceData = race ? RACES[race as Race] : null;
  const classData = cls ? CLASSES[cls as CharacterClass] : null;
  const religionData = religion ? RELIGIONS[religion as Religion] : null;

  const previewStats = computeStartingStats(
    (race || null) as Race | null,
    (cls || null) as CharacterClass | null,
    religion || null,
  );

  return (
    <div className="space-y-6">
      <StepIndicator
        current={stepIndex}
        labels={[t("character.stepLabelName"), t("character.stepLabelRaceClass"), t("character.stepLabelDone")]}
      />

      {step === "name" && (
        <div className="space-y-6">
          <p className="text-text-muted text-sm">{t("character.nameAndAvatar")}</p>

          <div className="flex items-start gap-4">
            <AvatarEditor
              seed={avatarSeed}
              imageUrl={avatarImage}
              onSeedChange={setAvatarSeed}
              onImageChange={setAvatarImage}
              size={72}
            />
          </div>

          <div>
            <label htmlFor="char-name" className="block text-sm font-medium text-text-muted mb-2">
              {t("character.characterName")}
            </label>
            <input
              id="char-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setValidationError("");
              }}
              placeholder={t("character.namePlaceholder")}
              className="w-full rounded-lg border border-border bg-bg-surface px-4 py-3 text-text-base placeholder:text-text-faint focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple"
              autoFocus
              maxLength={100}
            />
          </div>

          {validationError && <p className="text-sm text-accent-red">{validationError}</p>}
        </div>
      )}

      {step === "race-class" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Avatar seed={avatarSeed} imageUrl={avatarImage} size={48} />
            <div>
              <h3 className="text-lg font-semibold text-text-base [overflow-wrap:anywhere]">{name}</h3>
              <p className="text-xs text-text-muted">{t("character.chooseRaceClassReligion")}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="wizard-race" className="block text-sm text-text-muted mb-1">{t("raceClass.race")}</label>
              <select
                id="wizard-race"
                value={race}
                onChange={(e) => { setRace(e.target.value); setValidationError(""); }}
                className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-base"
              >
                <option value="">{t("raceClass.selectRace")}</option>
                {RACE_NAMES.map((r) => (
                  <option key={r} value={r}>{tRace(r, locale)}</option>
                ))}
              </select>
              {raceData && (
                <div className="mt-2 text-xs text-text-faint space-y-0.5">
                  <p>HP: {raceData.startingEquipment.hp} | {t("overview.worthiness")}: {raceData.startingEquipment.worthiness}</p>
                  <p className="text-[10px]">{raceData.bonuses.filter((b) => b.startsWith("+")).map((b) => tBonus(b, locale)).join(", ")}</p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="wizard-cls" className="block text-sm text-text-muted mb-1">{t("raceClass.class")}</label>
              <select
                id="wizard-cls"
                value={cls}
                onChange={(e) => { setCls(e.target.value); setValidationError(""); }}
                className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-base"
              >
                <option value="">{t("raceClass.selectClass")}</option>
                {CLASS_NAMES.map((c) => (
                  <option key={c} value={c}>{tClass(c, locale)}</option>
                ))}
              </select>
              {classData && (
                <div className="mt-2 text-xs text-text-faint space-y-0.5">
                  <p>HP+{classData.startingEquipment.hpBonus} | {t("overview.gold")}: {classData.startingEquipment.gold} | {classData.abilityType === "arcana" ? "Arcana" : t("spells.abilities")}</p>
                  <p className="text-[10px]">{classData.bonuses.filter((b) => b.startsWith("+")).map((b) => tBonus(b, locale)).join(", ")}</p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="wizard-religion" className="block text-sm text-text-muted mb-1">{t("raceClass.religion")}</label>
              <select
                id="wizard-religion"
                value={religion}
                onChange={(e) => setReligion(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-base"
              >
                <option value="">{t("character.selectReligion")}</option>
                {RELIGION_NAMES.map((r) => (
                  <option key={r} value={r}>{tReligion(r, locale)}</option>
                ))}
              </select>
              {religionData && (
                <div className="mt-2 text-xs text-text-faint space-y-0.5">
                  <p className="italic">{religionData.deity}</p>
                  <p className="text-[10px]">{religionData.bonuses.filter((b) => b.startsWith("+")).map((b) => tBonus(b, locale)).join(", ")}</p>
                </div>
              )}
            </div>
          </div>

          {(race || cls) && (
            <div className="rounded-lg border border-border bg-bg-elevated p-3">
              <p className="text-xs text-text-muted mb-2 font-medium">{t("character.startStats")}</p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="text-accent-red">HP: {previewStats.maxHp ?? 0}</span>
                {(previewStats.maxArcana ?? 0) > 0 && (
                  <span className="text-accent-purple">{t("spells.arcanaRange", { n: previewStats.arcana ?? 0, max: previewStats.maxArcana ?? 0 })}</span>
                )}
                <span className="text-accent-gold">{t("overview.gold")}: {previewStats.gold ?? 0}</span>
                <span className="text-text-muted">{t("overview.worthiness")}: {previewStats.worthiness ?? 0}</span>
              </div>
            </div>
          )}

          {validationError && <p className="text-sm text-accent-red">{validationError}</p>}

          <p className="text-xs text-text-faint">
            {t("character.canChangeLater")}
          </p>

        </div>
      )}

      {step === "done" && (
        <div className="text-center space-y-6 py-6">
          <Avatar seed={avatarSeed} imageUrl={avatarImage} size={96} className="mx-auto" />
          <div>
            <h3 className="text-xl font-semibold text-accent-gold">{name}</h3>
            <p className="text-sm text-text-muted mt-1">
              {[tRace(race, locale), tClass(cls, locale)].join(" · ")}
            </p>
            {religionData && (
              <p className="text-xs text-text-faint mt-0.5">{tReligion(religion, locale)}</p>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 text-text-muted text-sm">
            <Sparkles size={14} className="text-accent-gold" />
            <span>{t("character.created")}</span>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        {stepIndex > 0 && step !== "done" && (
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 rounded-lg border border-border px-4 py-2.5 text-sm text-text-muted hover:bg-bg-surface transition-colors"
          >
            <ChevronLeft size={14} />
            {t("common.back")}
          </button>
        )}

        {step !== "done" ? (
          <button
            type="button"
            onClick={goNext}
            disabled={create.isPending}
            className="flex items-center gap-1 rounded-lg bg-accent-purple px-6 py-2.5 text-sm font-semibold text-on-accent-purple hover:bg-accent-purple/80 transition-colors disabled:opacity-50 ml-auto"
          >
            {create.isPending ? t("character.creating") : step === "race-class" ? t("character.stepCreate") : t("common.next")}
            {!create.isPending && <ChevronRight size={14} />}
          </button>
        ) : (
          <div className="mx-auto flex flex-wrap justify-center gap-3">
            {returnTo && (
              <button
                type="button"
                onClick={() => router.push(returnTo)}
                className="rounded-lg bg-accent-gold/20 px-6 py-2.5 text-sm font-semibold text-accent-gold hover:bg-accent-gold/30 transition-colors"
              >
                {t("character.backToCampaign")}
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push(`/characters/${characterId}`)}
              className={cn(
                "rounded-lg px-6 py-2.5 text-sm font-semibold transition-colors",
                returnTo ? "border border-border text-text-muted hover:text-text-base" : "bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30",
              )}
            >
              {t("character.openSheet")}
            </button>
          </div>
        )}

        {step === "name" && (
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-border px-4 py-2.5 text-sm text-text-muted hover:bg-bg-surface transition-colors"
          >
            {t("common.cancel")}
          </button>
        )}
      </div>
    </div>
  );
}

function StepIndicator({ current, labels }: { current: number; labels: string[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {labels.map((label, i) => (
        <li key={label} className="flex items-center gap-2" aria-current={i === current ? "step" : undefined}>
          <div
            className={cn(
              "w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
              i < current
                ? "bg-accent-gold/20 text-accent-gold"
                : i === current
                  ? "bg-accent-purple text-on-accent-purple"
                  : "bg-bg-elevated text-text-muted"
            )}
          >
            {i + 1}
          </div>
          <span className={cn("text-xs", i === current ? "text-text-base" : "text-text-faint")}>{label}</span>
          {i < labels.length - 1 && (
            <div
              className={cn(
                "w-6 h-0.5 rounded",
                i < current ? "bg-accent-gold/40" : "bg-border"
              )}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
