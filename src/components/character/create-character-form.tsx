"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateCharacter, useUpdateCharacter } from "@/hooks/useCharacters";
import { useT, tRace, tClass, tReligion } from "@/lib/i18n";
import { Avatar, AvatarEditor, getInitialAvatarSeed } from "./avatar";
import { RACE_NAMES, RACES, type Race } from "@/lib/domain/races";
import { CLASS_NAMES, CLASSES, type CharacterClass } from "@/lib/domain/classes";
import { RELIGION_NAMES, RELIGIONS, type Religion } from "@/lib/domain/religions";
import { computeStartingStats, computeStartingEquipment } from "@/lib/domain/starting-data";
import { cn } from "@/lib/utils/cn";
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
  const create = useCreateCharacter();
  const update = useUpdateCharacter(characterId ?? 0);
  const { t, locale } = useT();

  const stepIndex = STEPS.indexOf(step);

  function goNext() {
    if (step === "name") {
      if (!name.trim()) {
        setValidationError(t("character.enterName"));
        return;
      }
      setValidationError("");

      if (!characterId) {
        create.mutate(
          { name: name.trim(), campaignId: null },
          {
            onSuccess: (char) => {
              const id = (char as Record<string, unknown>).id as number;
              setCharacterId(id);
              setAvatarSeed(getInitialAvatarSeed(name.trim()));
              setStep("race-class");
            },
          },
        );
      } else {
        // Character already created - persist the (possibly edited) name.
        update.mutate({ name: name.trim() });
        setStep("race-class");
      }
      return;
    }

    if (step === "race-class") {
      if (!characterId) return;

      const raceVal = (race || null) as Race | null;
      const clsVal = (cls || null) as CharacterClass | null;
      const relVal = (religion || null) as Religion | null;

      const patch: Record<string, unknown> = {
        avatarSeed,
        avatarImage,
        ...(raceVal ? { race: raceVal } : {}),
        ...(clsVal ? { class: clsVal } : {}),
        ...(relVal ? { religion: relVal } : {}),
        ...computeStartingStats(raceVal, clsVal),
        ...computeStartingEquipment(clsVal),
        spells: [],
      };

      update.mutate({ data: patch }, { onSuccess: () => setStep("done") });
      return;
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
  );

  return (
    <div className="space-y-6">
      <StepIndicator current={stepIndex} total={STEPS.length} />

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

          {validationError && <p className="text-sm text-red-400">{validationError}</p>}
          {create.error && <p className="text-sm text-red-400">{create.error.message}</p>}
        </div>
      )}

      {step === "race-class" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Avatar seed={avatarSeed} imageUrl={avatarImage} size={48} />
            <div>
              <h3 className="text-lg font-semibold text-text-base">{name}</h3>
              <p className="text-xs text-text-muted">{t("character.chooseRaceClassReligion")}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm text-text-muted mb-1">{t("raceClass.race")}</label>
              <select
                value={race}
                onChange={(e) => setRace(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-base"
              >
                <option value="">{t("raceClass.selectRace")}</option>
                {RACE_NAMES.map((r) => (
                  <option key={r} value={r}>{tRace(r, locale)}</option>
                ))}
              </select>
              {raceData && (
                <div className="mt-2 text-xs text-text-faint space-y-0.5">
                  <p>HP: {raceData.startingEquipment.hp} | Worthiness: {raceData.startingEquipment.worthiness}</p>
                  <p className="text-[10px]">{raceData.bonuses.filter((b) => b.startsWith("+")).join(", ")}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-1">{t("raceClass.class")}</label>
              <select
                value={cls}
                onChange={(e) => setCls(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-base"
              >
                <option value="">{t("raceClass.selectClass")}</option>
                {CLASS_NAMES.map((c) => (
                  <option key={c} value={c}>{tClass(c, locale)}</option>
                ))}
              </select>
              {classData && (
                <div className="mt-2 text-xs text-text-faint space-y-0.5">
                  <p>HP+{classData.startingEquipment.hpBonus} | Gold: {classData.startingEquipment.gold} | {classData.abilityType}</p>
                  <p className="text-[10px]">{classData.bonuses.filter((b) => b.startsWith("+")).join(", ")}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-1">{t("raceClass.religion")}</label>
              <select
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
                  <p className="text-[10px]">{religionData.bonuses.filter((b) => b.startsWith("+")).join(", ")}</p>
                </div>
              )}
            </div>
          </div>

          {(race || cls) && (
            <div className="rounded-lg border border-border bg-bg-elevated p-3">
              <p className="text-xs text-text-muted mb-2 font-medium">{t("character.startStats")}</p>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="text-red-400">HP: {previewStats.maxHp ?? 0}</span>
                {(previewStats.maxArcana ?? 0) > 0 && (
                  <span className="text-purple-400">Arcana: {previewStats.arcana}/{previewStats.maxArcana}</span>
                )}
                <span className="text-yellow-400">Gold: {previewStats.gold ?? 0}</span>
                <span className="text-text-muted">Worthiness: {previewStats.worthiness ?? 0}</span>
              </div>
            </div>
          )}

          <p className="text-xs text-text-faint">
            {t("character.canChangeLater")}
          </p>

          {update.error && <p className="text-sm text-red-400">{update.error.message}</p>}
        </div>
      )}

      {step === "done" && (
        <div className="text-center space-y-6 py-6">
          <Avatar seed={avatarSeed} imageUrl={avatarImage} size={96} className="mx-auto" />
          <div>
            <h3 className="text-xl font-semibold text-accent-gold">{name}</h3>
            <p className="text-sm text-text-muted mt-1">
              {[race, cls].filter(Boolean).join(" · ") || t("character.readyToAdventure")}
            </p>
            {religionData && (
              <p className="text-xs text-text-faint mt-0.5">{religionData.deity}</p>
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
            disabled={create.isPending || update.isPending}
            className="flex items-center gap-1 rounded-lg bg-accent-purple px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-purple/80 transition-colors disabled:opacity-50 ml-auto"
          >
            {create.isPending || update.isPending ? t("character.creating") : step === "race-class" ? t("character.stepCreate") : t("common.next")}
            {!create.isPending && !update.isPending && <ChevronRight size={14} />}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => router.push(`/characters/${characterId}`)}
            className="rounded-lg bg-accent-gold/20 px-6 py-2.5 text-sm font-semibold text-accent-gold hover:bg-accent-gold/30 transition-colors mx-auto"
          >
            {t("character.openSheet")}
          </button>
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

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
              i < current
                ? "bg-accent-gold/20 text-accent-gold"
                : i === current
                  ? "bg-accent-purple text-white"
                  : "bg-bg-elevated text-text-faint"
            )}
          >
            {i + 1}
          </div>
          {i < total - 1 && (
            <div
              className={cn(
                "w-8 h-0.5 rounded",
                i < current ? "bg-accent-gold/40" : "bg-border"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
