"use client";

import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { StashKind } from "@/lib/schemas/stash";
import { useCreateStashEntry } from "@/hooks/useStash";
import { DmGiveEquipmentForm } from "@/components/campaign/dm-give-equipment-form";
import { StashQuestForm } from "./stash-quest-form";

interface StashCreateProps {
  campaignId: number;
  kind: StashKind;
  onCreated: (id: number) => void;
  onClose: () => void;
}

/** New stash entry: a story item or a piece of equipment. */
export function StashCreate({ campaignId, kind, onCreated, onClose }: StashCreateProps) {
  const { t } = useT();
  const create = useCreateStashEntry(campaignId);
  const done = ({ id }: { id: number }) => onCreated(id);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-4">
        <h2 className="font-display text-xl font-bold text-text-base">
          {kind === "quest" ? t("stash.newItem") : t("stash.newEquipment")}
        </h2>
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-text-base">
          <X size={18} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
        {kind === "quest" ? (
          <StashQuestForm
            submitLabel={t("stash.addToStash")}
            isPending={create.isPending}
            onSubmit={(data) => create.mutate({ kind: "quest", data }, { onSuccess: done })}
            onCancel={onClose}
          />
        ) : (
          <DmGiveEquipmentForm
            startOpen
            submitLabel={t("stash.addToStash")}
            isPending={create.isPending}
            onGive={(data) => create.mutate({ kind: "equipment", data }, { onSuccess: done })}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
}
