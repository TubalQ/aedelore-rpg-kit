"use client";

import { useCharacter, useUpdateCharacter } from "@/hooks/useCharacters";
import { CharacterDataSchema } from "@/lib/schemas/character";
import type { CharacterData } from "@/lib/schemas/character";
import { OverviewSection } from "./sections/overview";
import { RaceClassSection } from "./sections/race-class";
import { AttributesSection } from "./sections/attributes";
import { SpellsSection } from "./sections/spells";
import { EquipmentSection } from "./sections/equipment";
import { DiceRoller } from "./sections/dice-roller";
import { ProgressionSection } from "./sections/progression";
import { QuestItemsSection } from "./sections/quest-items";
import { DmEquipmentSection } from "./sections/dm-equipment";
import { RelationshipsSection } from "./sections/relationships";
import { TransformsSection } from "./sections/transforms";
import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarEditor } from "./avatar";
import { OnboardingBanner } from "./onboarding-banner";
import { useT } from "@/lib/i18n";
import Link from "next/link";

interface CharacterSheetProps {
  id: number;
}

export function CharacterSheet({ id }: CharacterSheetProps) {
  const { t } = useT();
  const { data: raw, isLoading, error } = useCharacter(id);
  const update = useUpdateCharacter(id);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Partial<CharacterData>>({});
  const [localData, setLocalData] = useState<CharacterData | null>(null);
  const serverDataRef = useRef<string>("");

  const char = raw as Record<string, unknown> | undefined;

  useEffect(() => {
    if (!char?.data) return;
    const json = JSON.stringify(char.data);
    if (json !== serverDataRef.current) {
      serverDataRef.current = json;
      const parsed = CharacterDataSchema.safeParse(char.data);
      if (parsed.success) {
        setLocalData(parsed.data);
      } else {
        const fallback = CharacterDataSchema.safeParse({ ...(char.data as object) });
        setLocalData(fallback.success ? fallback.data : CharacterDataSchema.parse({}));
      }
    }
  }, [char?.data]);

  const flushSave = useCallback(() => {
    const pending = pendingRef.current;
    if (Object.keys(pending).length === 0) return;
    pendingRef.current = {};
    update.mutate({ data: pending });
  }, [update]);

  const handleChange = useCallback(
    (partial: Partial<CharacterData>) => {
      setLocalData((prev) => (prev ? { ...prev, ...partial } : prev));
      pendingRef.current = { ...pendingRef.current, ...partial };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(flushSave, 1500);
    },
    [flushSave],
  );

  const handleImmediate = useCallback(
    (partial: Partial<CharacterData>) => {
      setLocalData((prev) => (prev ? { ...prev, ...partial } : prev));
      pendingRef.current = { ...pendingRef.current, ...partial };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      flushSave();
    },
    [flushSave],
  );

  if (isLoading) {
    return <p className="text-text-muted">{t("character.loading")}</p>;
  }

  if (error || !char) {
    return <p className="text-red-400">{t("character.loadError")}</p>;
  }

  if (!localData) {
    return <p className="text-text-muted">{t("character.loading")}</p>;
  }

  // DM-läge: kampanjens DM öppnar en spelares blad. Lås kringgås så DM kan redigera
  // låsta sektioner på spelarens vägnar (skrivningen auktoriseras som DM server-side).
  const viewerIsDm = char.viewerIsDm === true;
  const raceClassLocked = viewerIsDm ? false : (char.raceClassLocked as boolean);
  const attributesLocked = viewerIsDm ? false : (char.attributesLocked as boolean);
  const abilitiesLocked = viewerIsDm ? false : (char.abilitiesLocked as boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <AvatarEditor
            seed={localData.avatarSeed || (char.name as string)}
            imageUrl={localData.avatarImage as string | undefined}
            onSeedChange={(seed) => handleImmediate({ avatarSeed: seed })}
            onImageChange={(url) => handleImmediate({ avatarImage: url })}
            size={56}
          />
          <h1 className="text-2xl font-bold text-accent-gold">{char.name as string}</h1>
        </div>
        <div className="text-xs">
          {update.isPending
            ? <span className="text-text-faint">{t("common.saving")}</span>
            : update.isError
            ? <span className="text-accent-red">{t("common.saveFailed")}</span>
            : update.isSuccess
            ? <span className="text-text-faint">{t("common.saved")}</span>
            : null}
        </div>
      </div>

      {viewerIsDm && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-accent-gold/40 bg-accent-gold/10 px-4 py-2 text-sm">
          <span className="text-accent-gold">
            {t("character.dmModeBanner", { name: char.name as string })}
          </span>
          {char.campaignId != null && (
            <Link
              href={`/campaigns/${char.campaignId}`}
              className="shrink-0 text-xs text-text-muted underline hover:text-text-base"
            >
              {t("character.backToCampaign")}
            </Link>
          )}
        </div>
      )}

      {!viewerIsDm && (
        <OnboardingBanner
          characterId={id}
          hasRaceClass={!!localData.race && !!localData.class}
          raceClassLocked={raceClassLocked}
          attributesLocked={attributesLocked}
          abilitiesLocked={abilitiesLocked}
          inCampaign={char.campaignId != null}
        />
      )}

      <OverviewSection data={localData} onChange={handleChange} />

      <DiceRoller />

      <RaceClassSection
        data={localData}
        locked={raceClassLocked}
        onChange={handleImmediate}
      />

      <ProgressionSection
        characterId={id}
        raceClassLocked={raceClassLocked}
        attributesLocked={attributesLocked}
        abilitiesLocked={abilitiesLocked}
        xp={(char.xp as number) ?? 0}
        xpSpent={(char.xpSpent as number) ?? 0}
        hasRaceAndClass={!!localData.race && !!localData.class}
        inCampaign={char.campaignId != null}
      />

      <AttributesSection
        characterId={id}
        data={localData}
        locked={attributesLocked}
        xpPointsAvailable={Math.floor((((char.xp as number) ?? 0) - ((char.xpSpent as number) ?? 0)) / 10)}
        onChange={handleChange}
      />

      <SpellsSection data={localData} locked={abilitiesLocked} onChange={handleImmediate} />

      <EquipmentSection data={localData} onChange={handleImmediate} />

      <DmEquipmentSection data={localData} onChange={handleImmediate} />

      <TransformsSection data={localData} onChange={handleImmediate} />

      <QuestItemsSection data={localData} onChange={handleChange} />

      <RelationshipsSection data={localData} onChange={handleChange} />
    </div>
  );
}
