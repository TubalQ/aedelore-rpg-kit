"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAutosave } from "@/hooks/useAutosave";
import { SaveStatusPill } from "@/components/ui/save-status";
import { useRouter } from "next/navigation";
import { ScrollText } from "lucide-react";
import { RefreshFailed } from "@/components/ui/refresh-failed";
import { useSession, useUpdateSession, useLockSession, useUnlockSession } from "@/hooks/useSessions";
import { useCampaignCharacters, useCampaigns } from "@/hooks/useCampaigns";
import { useCampaignLive } from "@/hooks/useCampaignLive";
import { useGiveInPlay, type UpdateGiveList } from "@/hooks/useGiveInPlay";
import type { SessionData } from "@/lib/schemas/session";
import { SessionPanel, type SessionTab } from "./plan/session-panel";
import { PlanView } from "./plan/plan-view";
import { adoptStashIds } from "@/lib/session/stash-sync";
import { rememberedFor, renameStep, type ClearedName } from "@/lib/session/rename";
import { reconcileSessionData, reconcileSessionMeta, sessionPatchKeys, type SessionMeta } from "@/lib/session/reconcile";
import { PlayView } from "./play/play-view";
import { useT } from "@/lib/i18n";
import { initialEditorMode, type EditorMode } from "@/lib/session/editor-mode";


type SessionPatch = Record<string, unknown>;

// `data` is merged per key: two quick data patches within the debounce must
// not overwrite each other's keys (the first change would never be saved).
function mergeSessionPatch(older: SessionPatch, newer: SessionPatch): SessionPatch {
  const merged: SessionPatch = { ...older, ...newer };
  if (older.data && newer.data) merged.data = { ...(older.data as object), ...(newer.data as object) };
  return merged;
}

const metaOf = (s: { title: string | null; date: string | null; location: string | null; gameLocation: string | null }): SessionMeta => ({
  title: s.title ?? "",
  date: s.date ?? "",
  location: s.location ?? "",
  gameLocation: s.gameLocation ?? "",
});

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
  // M6: the header names the campaign, from the list the app already holds.
  const { data: myCampaigns } = useCampaigns();
  const campaignName = myCampaigns?.find((c) => c.id === campaignId)?.name;
  useCampaignLive(campaignId);

  const [mode, setMode] = useState<EditorMode>("prep");
  // Play mode reaches the session panel (hook, notes, info) as a drawer.
  const [sessionTab, setSessionTab] = useState<SessionTab | null>(null);
  const [localData, setLocalData] = useState<SessionData | null>(null);
  const [localMeta, setLocalMeta] = useState<SessionMeta>({ title: "", date: "", location: "", gameLocation: "" });

  // Local copies start from the first loaded session (set during render, the
  // React pattern for state initialised from props that arrive later).
  if (session && !localData) {
    setLocalData(session.data);
    setLocalMeta(metaOf(session));
    setMode(initialEditorMode(session.data, session.status === "locked"));
  }

  const autosave = useAutosave<SessionPatch>({
    // New items/equipment learn the stash entry the server linked them to, so
    // a rename before the next save does not create a second stash entry.
    save: useCallback(
      (patch: SessionPatch) =>
        updateMutation.mutateAsync(patch).then((row) => {
          setLocalData((prev) => (prev ? adoptStashIds(prev, row.data) : prev));
          return row;
        }),
      [updateMutation],
    ),
    merge: mergeSessionPatch,
    keysOf: sessionPatchKeys,
    lostMessage: t("autosave.lostSession"),
  });
  const { schedule: scheduleSave, flush: flushSave, dirtyKeys } = autosave;

  // Server data (the poll, a save response, a window refocus) replaces the
  // local copy for every key without unsaved or in-flight edits. Otherwise a
  // list changed elsewhere (npcs or the event log written by the MCP, stash
  // content edited on the stash page) would be written back in its old form
  // by the next save of that list here.
  const [syncedFrom, setSyncedFrom] = useState<typeof session>(undefined);
  if (session && localData && session !== syncedFrom) {
    setSyncedFrom(session);
    const dirty = dirtyKeys();
    const data = reconcileSessionData(localData, session.data, dirty);
    if (data !== localData) setLocalData(data);
    const meta = reconcileSessionMeta(localMeta, metaOf(session), dirty);
    if (meta !== localMeta) setLocalMeta(meta);
  }

  // Save before in-app navigation; "Back" within the debounce used to drop the
  // last change. A failed save keeps the user here with the retry pill.
  const flushThenNavigate = useCallback(async (href: string) => {
    if (await flushSave()) router.push(href);
  }, [flushSave, router]);

  const updateData = useCallback(
    (patch: Partial<SessionData>, immediate = false) => {
      setLocalData((prev) => (prev ? { ...prev, ...patch } : prev));
      scheduleSave({ data: patch }, immediate);
    },
    [scheduleSave],
  );

  const flushAfterRender = useRef(false);
  // Giving in play changes one list after the server answered: apply it to
  // the latest local copy (the list may have changed meanwhile) and save it.
  const updateGiveList = useCallback<UpdateGiveList>(
    (key, change) => {
      setLocalData((prev) => {
        if (!prev) return prev;
        const next = change(prev[key]);
        if (next === prev[key]) return prev;
        scheduleSave({ data: { [key]: next } });
        flushAfterRender.current = true;
        return { ...prev, [key]: next };
      });
    },
    [scheduleSave],
  );
  // A hand-over is one deliberate act, not typing: save it right after the
  // render that scheduled it, so the players see it at once instead of after
  // the 1.5 s debounce (#82).
  useEffect(() => {
    if (!flushAfterRender.current) return;
    flushAfterRender.current = false;
    void flushSave();
  }, [localData, flushSave]);
  const giving = useGiveInPlay(campaignId, session?.sessionNumber, updateGiveList);

  function updateMeta(field: string, value: string) {
    setLocalMeta((prev) => ({ ...prev, [field]: value }));
    scheduleSave({ [field]: value });
  }

  // Content linking: rename cascades. The name changes on every keystroke, so
  // the step (lib/session/rename.ts) skips empty names and carries a cleared
  // name over to the new one (S3). Decided from the rendered data, outside the
  // state updater, so the remembered name is never touched twice.
  const clearedPlace = useRef<ClearedName | null>(null);
  const renamePlaceAndCascade = useCallback(
    (index: number, newName: string) => {
      const current = localData?.places;
      if (!current?.[index]) return;
      const step = renameStep(current[index].name, newName, rememberedFor(clearedPlace.current, index, current.length));
      clearedPlace.current = step.remember === null ? null : { index, length: current.length, name: step.remember };
      const oldName = step.from;
      setLocalData((prev) => {
        if (!prev) return prev;
        const places = prev.places.map((p, i) => (i === index ? { ...p, name: newName } : p));
        if (oldName === null) {
          scheduleSave({ data: { places } });
          return { ...prev, places };
        }
        // Only the lists that point at the place change, and only those are
        // sent (S7): a full patch of every list wrote back old copies of
        // lists the MCP had changed meanwhile.
        const from = oldName;
        // S9: the same place name can stand on several days (one entry per
        // day). Then only references on this place's day and time move; the
        // other day's place keeps its own. A reference without day/time stays
        // with the name that is still in use.
        const renamed = prev.places[index];
        const sharedName = prev.places.some((p, i) => i !== index && p.name === from);
        const sameSlot = (x: unknown): boolean => {
          if (!sharedName) return true;
          const r = x as { day?: unknown; time?: unknown };
          if (r.day == null && r.time == null) return false;
          return String(r.day ?? "") === String(renamed.day ?? "") && String(r.time ?? "") === String(renamed.time ?? "");
        };
        const moved = <T,>(arr: T[], match: (x: T) => boolean, fix: (x: T) => T): T[] | null => {
          const hit = (x: T) => match(x) && sameSlot(x);
          return arr.some(hit) ? arr.map((x) => (hit(x) ? fix(x) : x)) : null;
        };
        const atPlace = <T extends { plannedLocation: string }>(arr: T[]) =>
          moved(arr, (x) => x.plannedLocation === from, (x) => ({ ...x, plannedLocation: newName }));
        // Only links to this *place*: linkedTo is shared by npc/encounter
        // links too, so a name collision must not corrupt them.
        const linkedToPlace = <T extends { linkedType: string | null; linkedTo: string }>(arr: T[]) =>
          moved(arr, (x) => x.linkedType === "place" && x.linkedTo === from, (x) => ({ ...x, linkedTo: newName }));
        const changed: Partial<SessionData> = { places };
        const encounters = moved(prev.encounters, (e) => e.location === from, (e) => ({ ...e, location: newName }));
        if (encounters) changed.encounters = encounters;
        const npcs = atPlace(prev.npcs);
        if (npcs) changed.npcs = npcs;
        const items = atPlace(prev.items);
        if (items) changed.items = items;
        const equipment = atPlace(prev.equipment);
        if (equipment) changed.equipment = equipment;
        const readAloud = linkedToPlace(prev.readAloud);
        if (readAloud) changed.readAloud = readAloud;
        const eventLog = linkedToPlace(prev.eventLog);
        if (eventLog) changed.eventLog = eventLog;
        const turningPoints = linkedToPlace(prev.turningPoints);
        if (turningPoints) changed.turningPoints = turningPoints;
        scheduleSave({ data: changed });
        return { ...prev, ...changed };
      });
    },
    [scheduleSave, localData],
  );

  async function handleLock() {
    // Locking changes what players see and stops editing: confirm, and never
    // lock (and leave) with changes that did not reach the server.
    if (!window.confirm(t("session.lockConfirm"))) return;
    if (!(await flushSave())) return;
    lockMutation.mutate(undefined, { onSuccess: () => router.push(`/campaigns/${campaignId}`) });
  }

  function handleUnlock() {
    unlockMutation.mutate();
  }

  if (isLoading) return <p className="text-text-muted">{t("session.loading")}</p>;
  // A failed refresh keeps the editor and its unsaved edits (F3).
  if (error && !session) return <p className="text-accent-red">{t("session.loadError", { error: error.message })}</p>;
  if (!session) return <p className="text-accent-red">{t("session.notFound")}</p>;
  if (!localData) return <p className="text-text-muted">{t("session.loading")}</p>;

  const isLocked = session.status === "locked";

  return (
    <div className="space-y-4">
      <RefreshFailed error={error} />
      <SaveStatusPill status={autosave.status} onRetry={() => void flushSave()} />
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => flushThenNavigate(`/campaigns/${campaignId}`)}
            className="max-w-[45vw] truncate text-text-muted hover:text-text-base text-sm sm:max-w-xs pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:inline-flex pointer-coarse:items-center pointer-coarse:justify-center"
          >
            {campaignName ? `← ${campaignName}` : t("common.back")}
          </button>
          <span className="text-text-faint" aria-hidden="true">/</span>
          <h1 className="text-xl font-bold text-text-base">
            {t("session.sessionN", { n: session.sessionNumber })}
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-fit rounded-lg border border-border p-0.5" role="group">
            {(["prep", "play"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`min-h-10 rounded-md px-4 text-sm font-medium transition-colors ${
                  mode === m ? "bg-accent-gold text-bg-base" : "text-text-muted hover:text-text-base"
                }`}
              >
                {m === "prep" ? t("session.planning") : t("session.playing")}
              </button>
            ))}
          </div>
          {mode === "play" && (
            <button
              type="button"
              onClick={() => setSessionTab("prep")}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-text-muted hover:text-text-base"
            >
              <ScrollText size={16} aria-hidden="true" />
              {t("plan.sessionButton")}
            </button>
          )}
        </div>
      )}

      {mode === "play" && sessionTab && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onClick={() => setSessionTab(null)}>
          <div className="flex h-full w-full flex-col border-l border-border bg-bg-surface sm:w-[32rem]" onClick={(e) => e.stopPropagation()}>
            <SessionPanel
              sessionNumber={session.sessionNumber}
              data={localData}
              meta={localMeta}
              disabled={isLocked}
              tab={sessionTab}
              onTab={setSessionTab}
              onDataChange={updateData}
              onMetaChange={updateMeta}
              onClose={() => setSessionTab(null)}
            />
          </div>
        </div>
      )}

      {mode === "prep" ? (
        <PlanView
          campaignId={campaignId}
          sessionNumber={session.sessionNumber}
          data={localData}
          meta={localMeta}
          disabled={isLocked}
          onDataChange={updateData}
          onMetaChange={updateMeta}
          onRenamePlaceCascade={renamePlaceAndCascade}
        />
      ) : (
        <PlayView
          campaignId={campaignId}
          data={localData}
          characters={campaignCharacters ?? []}
          disabled={isLocked}
          onDataChange={updateData}
          onRenamePlaceCascade={renamePlaceAndCascade}
          onGive={giving.give}
          onTakeBack={giving.takeBack}
        />
      )}
    </div>
  );
}
