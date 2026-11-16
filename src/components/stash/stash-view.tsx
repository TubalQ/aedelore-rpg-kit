"use client";

import { useMemo, useState } from "react";
import { Package, Search, Sword } from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n";
import type { StashKind } from "@/lib/schemas/stash";
import { STASH_FILTERS, matchesFilter, stashName, type StashFilter } from "@/lib/stash/status";
import { useStash } from "@/hooks/useStash";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { CreateMenu } from "@/components/ui/create-menu";
import { cn } from "@/lib/utils/cn";
import { StashList } from "./stash-list";
import { StashDetail } from "./stash-detail";
import { StashCreate } from "./stash-create";
import { StashPlaceDialog, type PlaceMode } from "./stash-place-dialog";

const FILTER_KEYS: Record<StashFilter, TranslationKey> = {
  all: "stash.filterAll",
  stash: "stash.filterStash",
  placed: "stash.filterPlaced",
  given: "stash.filterGiven",
};

/**
 * The campaign stash (förråd): everything the DM has created, where it is,
 * and the one place to create, edit, place and give items and equipment.
 */
export function StashView({ campaignId }: { campaignId: number }) {
  const { t } = useT();
  const { data: entries, isLoading } = useStash(campaignId);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StashFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState<StashKind | null>(null);
  const [placing, setPlacing] = useState<PlaceMode | null>(null);
  const wide = useMediaQuery("(min-width: 1024px)");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (entries ?? []).filter((e) => matchesFilter(e, filter) && (!q || stashName(e).toLowerCase().includes(q)));
  }, [entries, query, filter]);
  const selected = entries?.find((e) => e.id === selectedId) ?? null;
  const paneOpen = creating !== null || selected !== null;

  function startCreate(kind: StashKind) {
    setSelectedId(null);
    setCreating(kind);
  }

  const pane = creating ? (
    <StashCreate
      campaignId={campaignId}
      kind={creating}
      onCreated={(id) => { setCreating(null); setSelectedId(id); }}
      onClose={() => setCreating(null)}
    />
  ) : selected ? (
    <StashDetail campaignId={campaignId} entry={selected} onPlaceOrGive={setPlacing} onClose={() => setSelectedId(null)} />
  ) : (entries?.length ?? 0) > 0 ? (
    <p className="p-6 text-sm text-text-faint">{t("stash.select")}</p>
  ) : null; // An empty stash already says so in the list; no "pick something" here.

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <CreateMenu
          label={t("stash.create")}
          items={[
            { key: "quest", label: t("stash.newItem"), hint: t("stash.newItemHint"), icon: <Package size={16} />, onSelect: () => startCreate("quest") },
            { key: "equipment", label: t("stash.newEquipment"), hint: t("stash.newEquipmentHint"), icon: <Sword size={16} />, onSelect: () => startCreate("equipment") },
          ]}
        />
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("stash.search")}
            aria-label={t("stash.search")}
            className="min-h-11 w-full rounded-lg border border-border bg-bg-base pl-9 pr-3 text-sm text-text-base focus:border-accent-gold focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("stash.filterAll")}>
          {STASH_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "min-h-9 rounded-full border px-3 text-xs transition-colors",
                filter === f ? "border-accent-gold bg-accent-gold/15 text-accent-gold" : "border-border text-text-muted hover:text-text-base",
              )}
            >
              {t(FILTER_KEYS[f])}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 rounded-xl border border-border bg-bg-surface py-3">
          {isLoading ? (
            <p className="px-4 py-6 text-sm text-text-faint">{t("common.loading")}</p>
          ) : !entries?.length ? (
            <p className="px-4 py-6 text-sm text-text-faint">{t("stash.empty")}</p>
          ) : visible.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-faint">{t("stash.noMatch")}</p>
          ) : (
            <StashList entries={visible} selectedId={selectedId} onSelect={(id) => { setCreating(null); setSelectedId(id); }} />
          )}
        </div>
        {/* Desktop: side pane. Mobile: full-screen overlay while something is open. */}
        {wide ? (
          pane && <aside className="flex max-h-[calc(100dvh-6rem)] min-h-[24rem] flex-col self-start overflow-hidden rounded-xl border border-border bg-bg-surface lg:sticky lg:top-20">{pane}</aside>
        ) : (
          paneOpen && <div className="fixed inset-0 z-40 flex flex-col bg-bg-surface">{pane}</div>
        )}
      </div>

      {selected && placing && (
        <StashPlaceDialog campaignId={campaignId} entry={selected} mode={placing} onModeChange={setPlacing} onClose={() => setPlacing(null)} />
      )}
    </div>
  );
}
