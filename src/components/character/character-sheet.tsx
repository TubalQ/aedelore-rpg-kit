"use client";

import { useCharacter, useUpdateCharacter } from "@/hooks/useCharacters";
import { useDmCharacterControl } from "@/hooks/useCampaigns";
import { CharacterDataSchema } from "@/lib/schemas/character";
import type { CharacterData } from "@/lib/schemas/character";
import { applyCharacterPatch, baseAfterSave, baseFor, mergeCharacterPatch, withBase, type SaveBase } from "@/lib/domain/character-patch";
import { useToastStore } from "@/stores/toast-store";
import { RaceClassSection } from "./sections/race-class";
import { AttributesSection } from "./sections/attributes";
import { SpellsSection } from "./sections/spells";
import { EquipmentSection } from "./sections/equipment";
import { DiceRoller } from "./sections/dice-roller";
import { QuestItemsSection } from "./sections/quest-items";
import { DmEquipmentSection } from "./sections/dm-equipment";
import { RelationshipsSection } from "./sections/relationships";
import { TransformsSection } from "./sections/transforms";
import { TopBand } from "./top-band";
import { getXpPerPoint } from "@/lib/domain/attributes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCampaignLive } from "@/hooks/useCampaignLive";
import { useAutosave } from "@/hooks/useAutosave";
import { SaveStatusPill } from "@/components/ui/save-status";
import { OnboardingBanner } from "./onboarding-banner";
import { StatusPage } from "@/components/layout/status-page";
import { useT, type TranslationKey } from "@/lib/i18n";
import Link from "next/link";
import { RefreshFailed } from "@/components/ui/refresh-failed";

const characterPatchKeys = (patch: Partial<CharacterData>): string[] => Object.keys(patch);

/** Names for the sheet's lists in the "not saved, changed elsewhere" message. */
const CONFLICT_LABELS: Partial<Record<string, TranslationKey>> = {
  questItems: "questItems.title",
  questItemsArchived: "questItems.title",
  relationships: "relationships.title",
  equippedWeapons: "equipment.title",
  equippedArmor: "equipment.title",
  equippedShield: "equipment.title",
  dmEquipment: "dmEquipment.title",
};

interface CharacterSheetProps {
  id: number;
}

export function CharacterSheet({ id }: CharacterSheetProps) {
  const { t } = useT();
  const { data: raw, isLoading, error } = useCharacter(id);
  // Autosave shows its own status pill with retry, so no global error toast.
  const update = useUpdateCharacter(id, { handlesErrors: true });
  // The campaign's DM on this sheet changes stats through the DM endpoint (C1).
  const dmControl = useDmCharacterControl(raw?.campaignId ?? 0);
  // A character in a campaign follows it live (#82): the DM's HP, XP and gifts
  // show up at once instead of on the next poll.
  useCampaignLive(raw?.campaignId ?? 0);
  const [localData, setLocalData] = useState<CharacterData | null>(null);
  const [tab, setTab] = useState<1 | 2>(1);

  const char = raw;

  // Each save carries the base of the keys it changes (their value when the
  // change began), so the server merges it with what others wrote meanwhile
  // instead of overwriting it (C2). Keys changed while a save runs are noted
  // to know which bases are still needed afterwards.
  const baseRef = useRef<SaveBase>({});
  const touchedRef = useRef<Set<string>>(new Set());
  const addToast = useToastStore((s) => s.addToast);
  const notifyConflict = useCallback(
    (keys: readonly string[]) => {
      const fields = [...new Set(keys.map((k) => (CONFLICT_LABELS[k] ? t(CONFLICT_LABELS[k]) : k)))].join(", ");
      addToast(t("sheet.conflict", { fields }), "error");
    },
    [addToast, t],
  );

  const autosave = useAutosave<Partial<CharacterData>>({
    save: useCallback(
      async (patch: Partial<CharacterData>) => {
        touchedRef.current = new Set();
        const saved = await update.mutateAsync({ data: patch, base: baseFor(baseRef.current, patch) });
        const conflicts = saved.conflicts ?? [];
        baseRef.current = baseAfterSave(baseRef.current, patch, saved.data, touchedRef.current, conflicts);
        if (conflicts.length > 0) notifyConflict(conflicts);
        return saved;
      },
      [update, notifyConflict],
    ),
    merge: mergeCharacterPatch,
    keysOf: characterPatchKeys,
    lostMessage: t("autosave.lostCharacter"),
  });
  const { schedule, dirtyKeys } = autosave;

  // Server data (first load, a save response, the 30 s poll) replaces local
  // data EXCEPT the fields with unsaved or in-flight edits, so a refresh never
  // rewinds what the user is typing. Adjusted during render when the server
  // data changes (React's pattern for state derived from a changing prop).
  const serverData = char?.data;
  const [syncedServerData, setSyncedServerData] = useState<unknown>(undefined);
  if (serverData && serverData !== syncedServerData) {
    setSyncedServerData(serverData);
    const parsed = CharacterDataSchema.safeParse(serverData);
    const server = parsed.success ? parsed.data : CharacterDataSchema.parse({});
    const dirty = dirtyKeys();
    if (!localData || dirty.size === 0) {
      setLocalData(server);
    } else {
      const merged: Record<string, unknown> = { ...server };
      for (const key of dirty) merged[key] = localData[key as keyof CharacterData];
      setLocalData(merged as CharacterData);
    }
  }

  // The base is recorded at once, from the data last rendered: an immediate
  // save (the HP buttons) runs before a state updater would. Only a key's
  // first change is recorded, and that is the value the change started from.
  // (React runs pending effects before it handles the next click.)
  const renderedRef = useRef<CharacterData | null>(null);
  useEffect(() => {
    renderedRef.current = localData;
  }, [localData]);
  const applyLocally = useCallback((partial: Partial<CharacterData>) => {
    if (renderedRef.current) baseRef.current = withBase(baseRef.current, renderedRef.current, partial);
    for (const key of Object.keys(partial)) touchedRef.current.add(key);
    setLocalData((prev) => (prev ? applyCharacterPatch(prev, partial) : prev));
  }, []);

  const handleChange = useCallback(
    (partial: Partial<CharacterData>) => {
      applyLocally(partial);
      schedule(partial);
    },
    [applyLocally, schedule],
  );

  const handleImmediate = useCallback(
    (partial: Partial<CharacterData>) => {
      applyLocally(partial);
      schedule(partial, true);
    },
    [applyLocally, schedule],
  );

  if (isLoading) {
    return <p className="text-text-muted">{t("character.loading")}</p>;
  }

  // Only an error with nothing loaded is an error page: a failed refresh keeps
  // the sheet and its unsaved edits (F3).
  if (!char) {
    return <StatusPage title="error.notFoundTitle" text="character.loadError" />;
  }

  if (!localData) {
    return <p className="text-text-muted">{t("character.loading")}</p>;
  }

  // DM-läge: kampanjens DM öppnar en spelares blad. Lås kringgås så DM kan redigera
  // låsta sektioner på spelarens vägnar (skrivningen auktoriseras som DM server-side).
  const viewerIsDm = char.viewerIsDm === true;
  const raceClassLocked = viewerIsDm ? false : char.raceClassLocked;
  const attributesLocked = viewerIsDm ? false : char.attributesLocked;
  const abilitiesLocked = viewerIsDm ? false : char.abilitiesLocked;
  const xp = char.xp;
  const xpSpent = char.xpSpent;
  const inCampaign = char.campaignId != null;
  const name = char.name;

  return (
    <div className="sheet-classic">
      <div className="mx-auto max-w-[1200px] px-[18px] pt-3 sm:px-8 lg:px-12">
        <RefreshFailed error={error} />
      </div>
      <SaveStatusPill status={autosave.status} onRetry={() => void autosave.flush()} />
      <div className="cs-sheet mx-auto max-w-[1200px] px-[18px] sm:px-8 lg:px-12 py-[22px]">
        {/* identity */}
        <div className="grid gap-1.5 text-center">
          <div className="cs-eyebrow">Aedelore · № {id}</div>
          <h1 className="cs-name">{name}</h1>
        </div>
        <div className="cs-rule opacity-50 mt-3 mb-[3px]"></div>
        <div className="cs-rule opacity-30"></div>

        {viewerIsDm && (
          <div className="mt-3.5 flex items-center justify-between gap-3 border border-accent-gold/40 bg-accent-gold/10 px-3 py-2 text-sm">
            <span className="text-accent-gold">{t("character.dmModeBanner", { name })}</span>
            {char.campaignId != null && (
              <Link href={`/campaigns/${char.campaignId}`} className="shrink-0 text-xs text-text-muted underline hover:text-text-base">
                {t("character.backToCampaign")}
              </Link>
            )}
          </div>
        )}

        {!viewerIsDm && (
          <div className="mt-3.5">
            <OnboardingBanner
              characterId={id}
              hasRaceClass={!!localData.race && !!localData.class}
              raceClassLocked={raceClassLocked}
              attributesLocked={attributesLocked}
              abilitiesLocked={abilitiesLocked}
              inCampaign={inCampaign}
              onGoToRaceClass={() => {
                setTab(2);
                // After Sheet II has rendered.
                requestAnimationFrame(() => document.getElementById("race-class")?.scrollIntoView({ behavior: "smooth", block: "start" }));
              }}
            />
          </div>
        )}

        <TopBand
          characterId={id}
          name={name}
          data={localData}
          xp={xp}
          xpSpent={xpSpent}
          raceClassLocked={raceClassLocked}
          attributesLocked={attributesLocked}
          abilitiesLocked={abilitiesLocked}
          inCampaign={inCampaign}
          locksDmHeld={char.locksDmHeld}
          onChange={handleChange}
          onImmediate={handleImmediate}
        />

        {/* tabs */}
        <div className="cs-tabs" role="tablist">
          <button className="cs-tab" role="tab" aria-selected={tab === 1} onClick={() => setTab(1)}>{t("sheet.tabCombat")}</button>
          <button className="cs-tab" role="tab" aria-selected={tab === 2} onClick={() => setTab(2)}>{t("sheet.tabLore")}</button>
        </div>

        {tab === 1 && (
          <div className="pt-6 flex flex-col gap-7 min-w-0">
            <AttributesSection
              characterId={id}
              data={localData}
              locked={attributesLocked}
              xpPointsAvailable={Math.floor((xp - xpSpent) / getXpPerPoint())}
              onChange={handleChange}
              dmAdjust={
                viewerIsDm && inCampaign
                  ? {
                      onAdjust: (map, name, delta) =>
                        dmControl.mutate({ action: "adjustStats", characterId: id, [map]: { [name]: delta } }),
                      pending: dmControl.isPending,
                    }
                  : undefined
              }
            />
            <DiceRoller />
            <SpellsSection data={localData} locked={abilitiesLocked} onChange={handleImmediate} />
            <EquipmentSection data={localData} onChange={handleImmediate} />
            <TransformsSection data={localData} onChange={handleImmediate} />
          </div>
        )}

        {tab === 2 && (
          <div className="pt-6 flex flex-col gap-7 min-w-0">
            <RaceClassSection data={localData} locked={raceClassLocked} onChange={handleImmediate} />
            <RelationshipsSection data={localData} onChange={handleChange} />
            <section className="cs-section space-y-3">
              <div className="cs-rulehead">
                <div className="hr"></div>
                <div className="lbl">{t("overview.background")}</div>
                <div className="hr"></div>
              </div>
              <textarea
                value={localData.background}
                onChange={(e) => handleChange({ background: e.target.value })}
                rows={5}
                className="w-full border border-[color:var(--cs-line-soft)] bg-bg-elevated px-3.5 py-3 text-sm text-text-base leading-[1.85] resize-y focus:border-accent-gold/50 focus:outline-none"
                style={{ fontFamily: "var(--font-serif)" }}
                placeholder={t("overview.backgroundPlaceholder")} aria-label={t("overview.backgroundPlaceholder")}
              />
            </section>
            <DmEquipmentSection data={localData} onChange={handleImmediate} />
            <QuestItemsSection data={localData} onChange={handleChange} />
          </div>
        )}
      </div>
    </div>
  );
}
