"use client";

import type { CharacterData } from "@/lib/schemas/character";
import { RACE_NAMES, RACES } from "@/lib/domain/races";
import { CLASS_NAMES, CLASSES } from "@/lib/domain/classes";
import { RELIGION_NAMES, RELIGIONS } from "@/lib/domain/religions";
import { computeStartingStats, computeStartingEquipment } from "@/lib/domain/starting-data";
import type { Race } from "@/lib/domain/races";
import type { CharacterClass } from "@/lib/domain/classes";
import { useT, tRace, tClass, tReligion } from "@/lib/i18n";

interface RaceClassProps {
  data: CharacterData;
  locked: boolean;
  onChange: (partial: Partial<CharacterData>) => void;
}

export function RaceClassSection({ data, locked, onChange }: RaceClassProps) {
  const { t, locale } = useT();
  const raceData = data.race ? RACES[data.race as Race] : null;
  const classData = data.class ? CLASSES[data.class as CharacterClass] : null;

  function handleRaceChange(value: string) {
    const race = (value || null) as CharacterData["race"];
    // Changing an already-chosen race resets HP/gold/worthiness/arcana to
    // starting values - confirm so it isn't a silent footgun. First pick (from
    // empty) needs no warning.
    if (data.race && data.race !== race && !confirm(t("raceClass.resetWarning"))) return;
    const cls = data.class as CharacterClass | null;
    onChange({ race, ...computeStartingStats(race as Race | null, cls) });
  }

  function handleClassChange(value: string) {
    const cls = (value || null) as CharacterData["class"];
    if (data.class && data.class !== cls && !confirm(t("raceClass.resetWarning"))) return;
    const race = data.race as Race | null;
    onChange({
      class: cls,
      ...computeStartingStats(race, cls as CharacterClass | null),
      ...computeStartingEquipment(cls as CharacterClass | null),
      spells: [],
    });
  }

  return (
    <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-base">{t("raceClass.title")}</h2>
        {locked && <span className="text-xs px-2 py-0.5 rounded-full bg-accent-gold/10 text-accent-gold">{t("common.locked")}</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm text-text-muted mb-1">{t("raceClass.race")}</label>
          <select
            value={data.race ?? ""}
            onChange={(e) => handleRaceChange(e.target.value)}
            disabled={locked}
            className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-base disabled:opacity-50"
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
            value={data.class ?? ""}
            onChange={(e) => handleClassChange(e.target.value)}
            disabled={locked}
            className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-base disabled:opacity-50"
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
            value={data.religion ?? ""}
            onChange={(e) => onChange({ religion: (e.target.value || null) as CharacterData["religion"] })}
            disabled={locked}
            className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-base disabled:opacity-50"
          >
            <option value="">{t("raceClass.selectReligion")}</option>
            {RELIGION_NAMES.map((r) => (
              <option key={r} value={r}>{tReligion(r, locale)}</option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
