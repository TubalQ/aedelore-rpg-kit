"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, useUpdateSession, useLockSession, useUnlockSession } from "@/hooks/useSessions";
import { useCampaignCharacters, useDmCharacterControl } from "@/hooks/useCampaigns";
import type { SessionData, SessionEquipment, SessionItem } from "@/lib/schemas/session";
import { SessionMetaSection } from "./sections/meta";
import { SessionNotesSection } from "./sections/notes";
import { PrepView } from "./prep-view";
import { PlayView } from "./play-view";
import { useT } from "@/lib/i18n";

type EditorMode = "prep" | "play";

interface SessionEditorProps {
  sessionId: number;
}

export function SessionEditor({ sessionId }: SessionEditorProps) {
  const { t } = useT();
  const router = useRouter();
  const { data: session, isLoading, error } = useSession(sessionId);
  const campaignId = session?.campaignId ?? 0;
  const updateMutation = useUpdateSession(sessionId, campaignId);
  const lockMutation = useLockSession(sessionId, campaignId);
  const unlockMutation = useUnlockSession(sessionId, campaignId);
  const { data: campaignCharacters } = useCampaignCharacters(campaignId);
  const controlMutation = useDmCharacterControl(campaignId);
  const characterNames = (campaignCharacters ?? []).map((c) => c.name).filter(Boolean);

  const [mode, setMode] = useState<EditorMode>("prep");
  const [localData, setLocalData] = useState<SessionData | null>(null);
  const [localMeta, setLocalMeta] = useState({ title: "", date: "", location: "", gameLocation: "" });
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (session && !localData) {
      setLocalData(session.data);
      setLocalMeta({
        title: session.title ?? "",
        date: session.date ?? "",
        location: session.location ?? "",
        gameLocation: session.gameLocation ?? "",
      });
    }
  }, [session, localData]);

  // Slår ihop en ny patch i pending. `data` måste djup-mergas: två snabba
  // data-patchar inom debouncen skrev annars över varandras nycklar och den
  // första ändringen nådde aldrig servern (localData såg ändå rätt ut).
  const mergePending = useCallback((base: Record<string, unknown> | null, patch: Record<string, unknown>) => {
    const merged: Record<string, unknown> = { ...base, ...patch };
    if (base?.data && patch.data) {
      merged.data = { ...(base.data as object), ...(patch.data as object) };
    }
    return merged;
  }, []);

  const flushSave = useCallback(async () => {
    if (!pendingRef.current) return;
    const payload = { ...pendingRef.current };
    pendingRef.current = null;
    setSaveStatus("saving");
    try {
      await updateMutation.mutateAsync(payload);
      setSaveStatus("saved");
    } catch {
      // Lägg tillbaka det misslyckade payloadet i pending (nyare ändringar
      // vinner) så inget tappas - tidigare kastades det tyst.
      pendingRef.current = mergePending(payload, pendingRef.current ?? {});
      setSaveStatus("error");
    }
  }, [updateMutation, mergePending]);

  const scheduleSave = useCallback(
    (patch: Record<string, unknown>, immediate = false) => {
      pendingRef.current = mergePending(pendingRef.current, patch);
      setSaveStatus("unsaved");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (immediate) {
        flushSave();
      } else {
        saveTimerRef.current = setTimeout(flushSave, 1500);
      }
    },
    [flushSave, mergePending],
  );

  // Varna vid stängd flik/fönster med osparade ändringar.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (pendingRef.current || saveStatus === "unsaved" || saveStatus === "error") {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveStatus]);

  // Flusha pending innan intern navigering - "Tillbaka" inom 1,5 s tappade
  // annars den sista ändringen tyst.
  const flushThenNavigate = useCallback(async (href: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await flushSave();
    router.push(href);
  }, [flushSave, router]);

  const updateData = useCallback(
    (patch: Partial<SessionData>, immediate = false) => {
      setLocalData((prev) => (prev ? { ...prev, ...patch } : prev));
      scheduleSave({ data: patch }, immediate);
    },
    [scheduleSave],
  );

  function updateMeta(field: string, value: string) {
    setLocalMeta((prev) => ({ ...prev, [field]: value }));
    scheduleSave({ [field]: value });
  }

  // Content linking: rename cascades
  const renamePlaceAndCascade = useCallback(
    (index: number, newName: string) => {
      setLocalData((prev) => {
        if (!prev) return prev;
        const oldName = prev.places[index].name;
        const places = prev.places.map((p, i) => (i === index ? { ...p, name: newName } : p));
        const encounters = prev.encounters.map((e) =>
          e.location === oldName ? { ...e, location: newName } : e,
        );
        const npcs = prev.npcs.map((n) =>
          n.plannedLocation === oldName ? { ...n, plannedLocation: newName } : n,
        );
        const items = prev.items.map((it) =>
          it.plannedLocation === oldName ? { ...it, plannedLocation: newName } : it,
        );
        const equipment = prev.equipment.map((eq) =>
          eq.plannedLocation === oldName ? { ...eq, plannedLocation: newName } : eq,
        );
        // Only rewrite links that point to this *place* - linkedTo is shared by
        // npc/encounter links too, so a name collision must not corrupt them.
        const relinkPlace = <T extends { linkedType: string | null; linkedTo: string }>(arr: T[]): T[] =>
          arr.map((x) =>
            x.linkedType === "place" && x.linkedTo === oldName ? { ...x, linkedTo: newName } : x,
          );
        const readAloud = relinkPlace(prev.readAloud);
        const eventLog = relinkPlace(prev.eventLog);
        const turningPoints = relinkPlace(prev.turningPoints);
        const updated = { ...prev, places, encounters, npcs, items, equipment, readAloud, eventLog, turningPoints };
        scheduleSave({ data: updated });
        return updated;
      });
    },
    [scheduleSave],
  );

  function handleGiveEquipment(equipment: SessionEquipment) {
    const char = (campaignCharacters ?? []).find((c) => c.name === equipment.givenTo);
    if (!char) return;
    controlMutation.mutate({
      action: "giveEquipment",
      characterId: char.id,
      equipment: {
        name: equipment.name,
        type: equipment.type,
        baseWeapon: equipment.baseWeapon || undefined,
        atkBonus: equipment.atkBonus || undefined,
        damage: equipment.damage || undefined,
        range: equipment.range || undefined,
        breakVal: equipment.breakVal || undefined,
        advantage: equipment.advantage || undefined,
        baseArmor: equipment.baseArmor || undefined,
        bodypart: equipment.bodypart || undefined,
        hp: equipment.hp || undefined,
        ac: equipment.ac || undefined,
        disadvantage: equipment.disadvantage || undefined,
        description: equipment.description || undefined,
        bonuses: equipment.bonuses.length > 0 ? equipment.bonuses : undefined,
        specialEffect: equipment.specialEffect || undefined,
        rarity: equipment.rarity || undefined,
      },
    });
  }

  function handleGiveItem(item: SessionItem) {
    const char = (campaignCharacters ?? []).find((c) => c.name === item.givenTo);
    if (!char) return;
    controlMutation.mutate({
      action: "giveItem",
      characterId: char.id,
      item: {
        name: item.name,
        description: item.description,
        sessionName: session?.sessionNumber ? `Session ${session.sessionNumber}` : "",
      },
    });
  }

  async function handleLock() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      await flushSave();
    }
    await lockMutation.mutateAsync();
    router.push(`/campaigns/${campaignId}`);
  }

  async function handleUnlock() {
    await unlockMutation.mutateAsync();
  }

  if (isLoading) return <p className="text-text-muted">{t("session.loading")}</p>;
  if (error) return <p className="text-red-400">{t("session.loadError", { error: error.message })}</p>;
  if (!session || !localData) return <p className="text-red-400">{t("session.notFound")}</p>;

  const isLocked = session.status === "locked";

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => flushThenNavigate(`/campaigns/${campaignId}`)}
            className="text-text-muted hover:text-text-base text-sm"
          >
            {t("common.back")}
          </button>
          <span className="text-text-faint">/</span>
          <h1 className="text-xl font-bold text-text-base">
            #{session.sessionNumber}
            {localMeta.title && (
              <span className="ml-2 font-normal text-text-muted">{localMeta.title}</span>
            )}
          </h1>
          {isLocked && (
            <span className="rounded bg-accent-gold/20 px-2 py-0.5 text-xs text-accent-gold">
              {t("common.locked")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${
            saveStatus === "saving" ? "text-text-faint" :
            saveStatus === "saved" ? "text-green-400" :
            saveStatus === "error" ? "text-accent-red" :
            "text-amber-400"
          }`}>
            {saveStatus === "saving" && t("common.saving")}
            {saveStatus === "saved" && t("common.saved")}
            {saveStatus === "unsaved" && t("common.unsaved")}
            {saveStatus === "error" && t("common.saveFailed")}
          </span>
          {saveStatus === "error" && (
            <button
              onClick={() => flushSave()}
              className="rounded border border-accent-red/50 px-2 py-0.5 text-xs text-accent-red hover:bg-accent-red/10"
            >
              {t("common.retry")}
            </button>
          )}
          {isLocked ? (
            <button
              onClick={handleUnlock}
              disabled={unlockMutation.isPending}
              className="rounded-lg border border-accent-gold px-3 py-1.5 text-sm text-accent-gold hover:bg-accent-gold/10 disabled:opacity-50"
            >
              {t("session.unlockSession")}
            </button>
          ) : (
            <button
              onClick={handleLock}
              disabled={lockMutation.isPending}
              className="rounded-lg bg-accent-gold px-3 py-1.5 text-sm font-semibold text-bg-base hover:bg-accent-gold/80 disabled:opacity-50"
            >
              {t("session.lockSession")}
            </button>
          )}
        </div>
      </div>

      {/* Mode toggle */}
      {!isLocked && (
        <div className="flex rounded-lg border border-border overflow-hidden w-fit">
          <button
            onClick={() => setMode("prep")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === "prep"
                ? "bg-accent-purple text-white"
                : "bg-bg-surface text-text-muted hover:text-text-base"
            }`}
          >
            {t("session.planning")}
          </button>
          <button
            onClick={() => setMode("play")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === "play"
                ? "bg-green-700 text-white"
                : "bg-bg-surface text-text-muted hover:text-text-base"
            }`}
          >
            {t("session.playing")}
          </button>
        </div>
      )}

      {/* Session info (always visible) */}
      <SessionMetaSection
        meta={localMeta}
        disabled={isLocked}
        onChange={updateMeta}
      />

      {/* Mode-specific content */}
      {mode === "prep" ? (
        <PrepView
          data={localData}
          disabled={isLocked}
          onDataChange={updateData}
          onRenamePlaceCascade={renamePlaceAndCascade}
        />
      ) : (
        <PlayView
          data={localData}
          disabled={isLocked}
          onDataChange={updateData}
          characterNames={characterNames}
          onGiveEquipmentToCharacter={handleGiveEquipment}
          onGiveItemToCharacter={handleGiveItem}
        />
      )}

      {/* Hook, prolog, session notes (always visible) */}
      <SessionNotesSection
        hook={localData.hook}
        prolog={localData.prolog}
        sessionNotes={localData.sessionNotes}
        disabled={isLocked}
        onHookChange={(hook) => updateData({ hook })}
        onPrologChange={(prolog) => updateData({ prolog })}
        onSessionNotesChange={(sessionNotes) => updateData({ sessionNotes })}
      />
    </div>
  );
}
