"use client";

import { useT } from "@/lib/i18n";
import type { StashEntry } from "@/lib/schemas/stash";
import { stashName } from "@/lib/stash/status";
import { EQUIPMENT_TYPE_LABEL_KEYS, EQUIPMENT_TYPES, type EquipmentType } from "@/lib/domain/equipment-labels";
import { RarityTag, StashStatusLine } from "./stash-badges";
import { cn } from "@/lib/utils/cn";

interface StashListProps {
  entries: StashEntry[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function StashList({ entries, selectedId, onSelect }: StashListProps) {
  const { t } = useT();

  const kindLabel = (e: StashEntry): string => {
    if (e.kind === "quest") return t("stash.kindItem");
    const type = e.data.type as EquipmentType;
    return (EQUIPMENT_TYPES as readonly string[]).includes(type)
      ? `${t("stash.kindEquipment")} · ${t(EQUIPMENT_TYPE_LABEL_KEYS[type])}`
      : t("stash.kindEquipment");
  };

  return (
    <div>
      <div className="hidden sm:grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] gap-4 px-4 pb-2 text-xs uppercase tracking-wider text-text-faint">
        <span>{t("stash.colName")}</span>
        <span>{t("stash.colRarity")}</span>
        <span>{t("stash.colWhere")}</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {entries.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onSelect(e.id)}
              aria-current={selectedId === e.id ? "true" : undefined}
              className={cn(
                "grid w-full grid-cols-1 gap-1 rounded-lg px-4 py-3 text-left transition-colors sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] sm:items-center sm:gap-4",
                selectedId === e.id ? "bg-bg-elevated" : "hover:bg-bg-surface",
              )}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[15px] font-medium text-text-base">{stashName(e)}</span>
                <span className="text-xs text-text-faint">{kindLabel(e)}</span>
              </span>
              <span className="hidden sm:block">{e.kind === "equipment" ? <RarityTag rarity={e.data.rarity} /> : null}</span>
              <StashStatusLine entry={e} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
