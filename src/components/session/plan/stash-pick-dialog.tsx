"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, Search, Sword, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { SessionData } from "@/lib/schemas/session";
import type { StashEntry } from "@/lib/schemas/stash";
import { stashName } from "@/lib/stash/status";
import { useStash } from "@/hooks/useStash";
import { RarityTag } from "@/components/stash/stash-badges";

interface StashPickDialogProps {
  campaignId: number;
  data: SessionData;
  /** The scene the pick goes into, or null for the session without a scene. */
  sceneName: string | null;
  onPick: (entry: StashEntry) => void;
  onClose: () => void;
}

/**
 * Pick a stash entry to put in this session. The placement is added to the
 * editor's own copy and saved with it (not through the place API), so the
 * open editor never overwrites it with its older item list.
 */
export function StashPickDialog({ campaignId, data, sceneName, onPick, onClose }: StashPickDialogProps) {
  const { t } = useT();
  const { data: entries, isLoading } = useStash(campaignId);
  const [query, setQuery] = useState("");
  const inSession = useMemo(
    () => new Set([...data.items, ...data.equipment].map((x) => x.stashId).filter((id): id is number => id !== null)),
    [data.items, data.equipment],
  );
  const shown = (entries ?? []).filter((e) => stashName(e).toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t("plan.pickTitle")} onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col gap-3 rounded-t-2xl border border-border bg-bg-surface p-5 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-text-base">{t("plan.pickTitle")}</h2>
            <p className="text-xs text-text-faint">{sceneName ? t("plan.pickIntoScene", { name: sceneName }) : t("plan.pickIntoSession")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-text-base">
            <X size={18} />
          </button>
        </div>
        <label className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" aria-hidden="true" />
          <input type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("stash.search")} aria-label={t("stash.search")}
            className="min-h-11 w-full rounded-lg border border-border bg-bg-base pl-9 pr-3 text-sm text-text-base focus:border-accent-gold focus:outline-none" />
        </label>
        <ul className="-mx-2 flex flex-col overflow-y-auto">
          {isLoading && <li className="px-2 py-4 text-sm text-text-faint">{t("common.loading")}</li>}
          {!isLoading && shown.length === 0 && <li className="px-2 py-4 text-sm text-text-faint">{entries?.length ? t("stash.noMatch") : t("stash.empty")}</li>}
          {shown.map((e) => {
            const already = inSession.has(e.id);
            return (
              <li key={e.id}>
                <button type="button" disabled={already} onClick={() => onPick(e)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-bg-elevated disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent">
                  {e.kind === "quest" ? <Package size={16} className="shrink-0 text-accent-gold" aria-hidden="true" /> : <Sword size={16} className="shrink-0 text-accent-green" aria-hidden="true" />}
                  <span className="min-w-0 flex-1 truncate text-sm text-text-base">{stashName(e)}</span>
                  {e.kind === "equipment" && <RarityTag rarity={String(e.data.rarity ?? "")} />}
                  <span className="shrink-0 text-xs text-text-faint">{already ? t("plan.pickAlready") : t("plan.pickAdd")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
