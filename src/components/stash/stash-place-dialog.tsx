"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { defaultPlacementVisibility, type StashEntry } from "@/lib/schemas/stash";
import { VISIBLE_TO_ALL, VISIBLE_TO_DM } from "@/lib/schemas/session";
import { stashName } from "@/lib/stash/status";
import { useCampaignSessions } from "@/hooks/useSessions";
import { useCampaignCharacters } from "@/hooks/useCampaigns";
import { useGiveStashEntry, usePlaceStashEntry } from "@/hooks/useStash";
import { useToastStore } from "@/stores/toast-store";

export type PlaceMode = "place" | "give";

interface StashPlaceDialogProps {
  campaignId: number;
  entry: StashEntry;
  mode: PlaceMode;
  onModeChange: (mode: PlaceMode) => void;
  onClose: () => void;
}

const field = "min-h-11 rounded-lg border border-border bg-bg-base px-3 text-sm text-text-base focus:border-accent-gold focus:outline-none";

/** Put a stash entry somewhere: in a session scene, or on characters. */
export function StashPlaceDialog({ campaignId, entry, mode, onModeChange, onClose }: StashPlaceDialogProps) {
  const { t } = useT();
  const addToast = useToastStore((s) => s.addToast);
  const name = stashName(entry);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tab = (m: PlaceMode) =>
    `flex-1 min-h-10 rounded-md text-sm transition-colors ${mode === m ? "bg-bg-elevated text-text-base font-medium" : "text-text-muted hover:text-text-base"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("stash.dialogTitle")}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-2xl border border-border bg-bg-surface p-5 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">{t("stash.dialogTitle")}</p>
            <h2 className="font-display text-xl font-bold text-text-base">{name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-text-base">
            <X size={18} />
          </button>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-bg-base p-1" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "place"} className={tab("place")} onClick={() => onModeChange("place")}>
            {t("stash.place")}
          </button>
          <button type="button" role="tab" aria-selected={mode === "give"} className={tab("give")} onClick={() => onModeChange("give")}>
            {t("stash.give")}
          </button>
        </div>
        {mode === "place" ? (
          <PlaceForm campaignId={campaignId} entry={entry} onDone={() => { addToast(t("stash.placedToast", { name }), "success"); onClose(); }} />
        ) : (
          <GiveForm campaignId={campaignId} entry={entry} onDone={(who) => { addToast(t("stash.givenToast", { name, who }), "success"); onClose(); }} />
        )}
      </div>
    </div>
  );
}

function PlaceForm({ campaignId, entry, onDone }: { campaignId: number; entry: StashEntry; onDone: () => void }) {
  const { t } = useT();
  const { data: sessions } = useCampaignSessions(campaignId);
  const place = usePlaceStashEntry(campaignId);
  // Locked sessions refuse new placements, so they are not offered.
  const open = useMemo(() => (sessions ?? []).filter((s) => s.status !== "locked").sort((a, b) => b.sessionNumber - a.sessionNumber), [sessions]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [scene, setScene] = useState(-1);
  const [visibleTo, setVisibleTo] = useState<string>(() => defaultPlacementVisibility(entry.kind));
  const [notes, setNotes] = useState("");
  const session = open.find((s) => s.id === sessionId) ?? open[0];
  const encounters = session?.data.encounters ?? [];

  if (sessions && open.length === 0) return <p className="text-sm text-text-faint">{t("stash.noSessions")}</p>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    const enc = encounters[scene];
    place.mutate(
      {
        id: entry.id,
        placement: {
          sessionId: session.id,
          plannedLocation: enc ? enc.location || enc.name : "",
          day: enc?.day ?? null,
          time: enc?.time ?? null,
          visibleTo,
          notes: notes.trim(),
        },
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-xs text-text-faint">{t("stash.placeHint")}</p>
      <label className="flex min-w-0 flex-col gap-1.5 text-xs text-text-muted">
        {t("stash.session")}
        <select className={`${field} w-full`} value={session?.id ?? ""} onChange={(e) => { setSessionId(Number(e.target.value)); setScene(-1); }}>
          {open.map((s) => (
            <option key={s.id} value={s.id}>
              {s.sessionNumber}. {s.title || t("stash.session")}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-col gap-1.5 text-xs text-text-muted">
        {t("stash.scene")}
        <select className={`${field} w-full`} value={scene} onChange={(e) => setScene(Number(e.target.value))}>
          <option value={-1}>{t("stash.noScene")}</option>
          {encounters.map((enc, i) => (
            <option key={i} value={i}>
              {enc.name || enc.location || `#${i + 1}`}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1.5 text-xs text-text-muted">
        <legend className="mb-1.5">{t("stash.playersSee")}</legend>
        <div className="flex gap-2">
          {[VISIBLE_TO_ALL, VISIBLE_TO_DM].map((v) => (
            <label key={v} className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-lg border text-sm ${visibleTo === v ? "border-accent-gold text-text-base" : "border-border text-text-muted"}`}>
              <input type="radio" name="vis" value={v} checked={visibleTo === v} onChange={() => setVisibleTo(v)} className="sr-only" />
              {v === VISIBLE_TO_ALL ? t("stash.visAll") : t("stash.visDm")}
            </label>
          ))}
        </div>
      </fieldset>
      <input className={field} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} placeholder={t("stash.dmNote")} aria-label={t("stash.dmNote")} />
      <button type="submit" disabled={!session || place.isPending} className="min-h-11 rounded-lg bg-accent-gold px-4 text-sm font-semibold text-bg-base disabled:opacity-50">
        {t("stash.placeAction")}
      </button>
    </form>
  );
}

function GiveForm({ campaignId, entry, onDone }: { campaignId: number; entry: StashEntry; onDone: (who: string) => void }) {
  const { t } = useT();
  const { data: characters } = useCampaignCharacters(campaignId);
  const give = useGiveStashEntry(campaignId);
  const holding = new Set(entry.holders.filter((h) => !h.archived).map((h) => h.characterId));
  const [picked, setPicked] = useState<Set<number>>(new Set());

  if (characters && characters.length === 0) return <p className="text-sm text-text-faint">{t("stash.noCharacters")}</p>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const chosen = (characters ?? []).filter((c) => picked.has(c.id));
    // One request per character; the global error toast reports a failure.
    for (const c of chosen) await give.mutateAsync({ id: entry.id, characterId: c.id });
    onDone(chosen.map((c) => c.name).join(", "));
  }

  return (
    <form onSubmit={(e) => { submit(e).catch(() => undefined); }} className="flex flex-col gap-3">
      <p className="text-xs text-text-faint">{t("stash.giveHint")}</p>
      <ul className="flex flex-col gap-1.5">
        {(characters ?? []).map((c) => {
          const has = holding.has(c.id);
          return (
            <li key={c.id}>
              <label className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm ${has ? "border-border text-text-faint" : "cursor-pointer border-border text-text-base hover:border-border-hover"}`}>
                <input
                  type="checkbox"
                  disabled={has}
                  checked={has || picked.has(c.id)}
                  onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })}
                  className="h-4 w-4 accent-[var(--color-accent-gold)]"
                />
                <span className="flex-1">{c.name}</span>
                {c.playerName && <span className="text-xs text-text-faint">{c.playerName}</span>}
              </label>
            </li>
          );
        })}
      </ul>
      <button type="submit" disabled={picked.size === 0 || give.isPending} className="min-h-11 rounded-lg bg-accent-gold px-4 text-sm font-semibold text-bg-base disabled:opacity-50">
        {t("stash.giveAction")}
      </button>
    </form>
  );
}
