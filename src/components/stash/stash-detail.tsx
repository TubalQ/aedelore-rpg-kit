"use client";

import { useState } from "react";
import { Gift, MapPin, Pencil, Trash2, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { StashEntry } from "@/lib/schemas/stash";
import type { DmEquipment } from "@/lib/schemas/character";
import { DmEquipmentSchema } from "@/lib/schemas/character";
import { stashName } from "@/lib/stash/status";
import { EQUIPMENT_TYPE_LABEL_KEYS, EQUIPMENT_TYPES, type EquipmentType } from "@/lib/domain/equipment-labels";
import { useDeleteStashEntry, useUpdateStashEntry } from "@/hooks/useStash";
import { useDmCharacterControl } from "@/hooks/useCampaigns";
import { DmGiveEquipmentForm } from "@/components/campaign/dm-give-equipment-form";
import { RarityTag } from "./stash-badges";
import { StashQuestForm } from "./stash-quest-form";
import { StashWhere } from "./stash-where";

interface StashDetailProps {
  campaignId: number;
  entry: StashEntry;
  onPlaceOrGive: (mode: "place" | "give") => void;
  onClose: () => void;
}

function Stat({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-bg-base px-3 py-2">
      <span className="text-[11px] uppercase tracking-wider text-text-faint">{label}</span>
      <span className="text-base font-semibold text-text-base">{String(value)}</span>
    </div>
  );
}

export function StashDetail({ campaignId, entry, onPlaceOrGive, onClose }: StashDetailProps) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const update = useUpdateStashEntry(campaignId);
  const remove = useDeleteStashEntry(campaignId);
  const control = useDmCharacterControl(campaignId);
  const name = stashName(entry);
  const inUse = entry.placements.length > 0 || entry.holders.length > 0;
  const equipment = entry.kind === "equipment" ? DmEquipmentSchema.safeParse(entry.data) : null;
  const eq: DmEquipment | null = equipment?.success ? equipment.data : null;
  const type = eq?.type as EquipmentType | undefined;

  function save(data: Record<string, unknown>) {
    update.mutate({ id: entry.id, data }, { onSuccess: () => setEditing(false) });
  }

  function takeBack(characterId: number, characterName: string) {
    if (!window.confirm(t("stash.takeBackConfirm", { name, who: characterName }))) return;
    control.mutate(
      entry.kind === "quest"
        ? { action: "removeItem", characterId, itemName: name, stashId: entry.id }
        : { action: "removeEquipment", characterId, equipmentName: name, stashId: entry.id },
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-2 border-b border-border px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            {entry.kind === "quest"
              ? t("stash.kindItem")
              : `${t("stash.kindEquipment")}${type && (EQUIPMENT_TYPES as readonly string[]).includes(type) ? ` · ${t(EQUIPMENT_TYPE_LABEL_KEYS[type])}` : ""}`}
          </span>
          <div className="flex items-center gap-1">
            {!editing && (
              <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-text-muted hover:text-text-base">
                <Pencil size={14} aria-hidden="true" />
                {t("stash.edit")}
              </button>
            )}
            <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-text-base lg:hidden">
              <X size={18} />
            </button>
          </div>
        </div>
        {!editing && (
          <>
            <h2 className="font-display text-2xl font-bold leading-tight text-text-base">{name}</h2>
            {eq && (
              <div className="flex flex-wrap gap-2">
                <RarityTag rarity={eq.rarity} />
                {eq.baseWeapon && <span className="rounded-full bg-bg-elevated px-2.5 py-0.5 text-xs text-text-muted">{eq.baseWeapon}</span>}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-4">
        {editing ? (
          entry.kind === "quest" ? (
            <StashQuestForm
              initial={{ name, description: String(entry.data.description ?? "") }}
              submitLabel={t("stash.save")}
              isPending={update.isPending}
              onSubmit={save}
              onCancel={() => setEditing(false)}
            />
          ) : (
            eq && (
              <DmGiveEquipmentForm
                initial={eq}
                startOpen
                submitLabel={t("stash.save")}
                isPending={update.isPending}
                onGive={(data) => save(data)}
                onCancel={() => setEditing(false)}
              />
            )
          )
        ) : (
          <>
            {eq && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label={t("sessionCard.equipment.damage")} value={eq.damage} />
                <Stat label={t("sessionCard.equipment.atk")} value={eq.atkBonus} />
                <Stat label={t("sessionCard.equipment.range")} value={eq.range} />
                <Stat label={t("sessionCard.equipment.break")} value={eq.breakVal} />
                <Stat label="AC" value={eq.ac} />
                <Stat label="HP" value={eq.maxHp ?? eq.hp} />
              </div>
            )}
            {eq?.bonuses && eq.bonuses.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {eq.bonuses.map((b, i) => (
                  <span key={i} className="rounded-full bg-accent-green/15 px-2.5 py-0.5 text-xs font-medium text-accent-green">
                    {b.value > 0 ? `+${b.value}` : b.value} {b.stat}
                  </span>
                ))}
              </div>
            )}
            {eq?.specialEffect && <p className="text-sm leading-relaxed text-text-muted">{eq.specialEffect}</p>}
            {(entry.data.description as string | undefined) && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-text-muted">{String(entry.data.description)}</p>
            )}

            <StashWhere entry={entry} onTakeBack={takeBack} pending={control.isPending} />

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onPlaceOrGive("place")} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-bg-elevated px-4 text-sm text-text-base hover:border-border-hover">
                <MapPin size={16} aria-hidden="true" />
                {t("stash.place")}
              </button>
              <button type="button" onClick={() => onPlaceOrGive("give")} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent-gold px-4 text-sm font-semibold text-bg-base hover:bg-accent-gold/85">
                <Gift size={16} aria-hidden="true" />
                {t("stash.give")}
              </button>
            </div>

            <div className="mt-auto border-t border-border pt-4">
              <button
                type="button"
                disabled={inUse || remove.isPending}
                onClick={() => {
                  if (window.confirm(t("stash.deleteConfirm", { name }))) remove.mutate(entry.id, { onSuccess: onClose });
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-accent-red hover:bg-accent-red/10 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Trash2 size={15} aria-hidden="true" />
                {t("stash.delete")}
              </button>
              {inUse && <p className="mt-1 px-3 text-xs text-text-faint">{t("stash.inUseHint")}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
