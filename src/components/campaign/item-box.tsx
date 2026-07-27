"use client";

import { useState } from "react";
import { X, Package, Sword } from "lucide-react";
import { useCampaignBox, useCampaignBoxAction, useCampaignCharacters } from "@/hooks/useCampaigns";
import type { CampaignBoxItem } from "@/lib/schemas/campaign";
import { DmGiveEquipmentForm } from "./dm-give-equipment-form";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { useT } from "@/lib/i18n";

// Per-kampanj förråd: DM skapar föremål i förväg (quest/equipment) som ligger kvar som
// mallar och delas ut till spelare vid behov (utdelning = kopia via dmGiveItem/Equipment).
export function ItemBox({ campaignId }: { campaignId: number }) {
  const { t } = useT();
  const { data: box, isLoading } = useCampaignBox(campaignId);
  const { data: characters } = useCampaignCharacters(campaignId);
  const action = useCampaignBoxAction(campaignId);

  const [mode, setMode] = useState<"quest" | "equipment">("quest");
  const [qName, setQName] = useState("");
  const [qDesc, setQDesc] = useState("");

  function addQuest() {
    if (!qName.trim()) return;
    action.mutate({
      action: "add",
      item: { kind: "quest", quest: { name: qName.trim(), description: qDesc.trim() } },
    });
    setQName("");
    setQDesc("");
  }

  const tabBtn = (active: boolean) =>
    `rounded px-3 py-1 text-xs transition-colors ${
      active ? "bg-accent-gold/20 text-accent-gold" : "text-text-muted hover:text-text-base"
    }`;

  return (
    <div className="space-y-5">
      {/* Skapa */}
      <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
        <h3 className="text-sm font-medium text-text-muted">{t("box.create")}</h3>
        <div className="flex gap-2">
          <button onClick={() => setMode("quest")} className={tabBtn(mode === "quest")}>
            {t("box.questItem")}
          </button>
          <button onClick={() => setMode("equipment")} className={tabBtn(mode === "equipment")}>
            {t("box.equipment")}
          </button>
        </div>

        {mode === "quest" ? (
          <div className="space-y-2">
            <input
              type="text"
              value={qName}
              onChange={(e) => setQName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addQuest()}
              placeholder={t("common.namePlaceholder")}
              className="w-full rounded border border-border bg-bg-base px-2 py-1 text-sm text-text-base focus:outline-none"
            />
            <AutoTextarea
              value={qDesc}
              onChange={(e) => setQDesc(e.target.value)}
              rows={3}
              placeholder={t("common.description")}
              className="w-full rounded border border-border bg-bg-base px-2 py-1 text-sm text-text-base focus:outline-none"
            />
            <button
              onClick={addQuest}
              disabled={!qName.trim() || action.isPending}
              className="w-full sm:w-auto rounded bg-accent-gold/20 px-3 py-1 text-xs text-accent-gold hover:bg-accent-gold/30 disabled:opacity-50"
            >
              + {t("box.addToBox")}
            </button>
          </div>
        ) : (
          <DmGiveEquipmentForm
            onGive={(equipment) => action.mutate({ action: "add", item: { kind: "equipment", equipment } })}
            isPending={action.isPending}
          />
        )}
      </section>

      {/* Lista */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-text-muted">
          {t("box.title")} ({box?.length ?? 0})
        </h3>
        {isLoading && <p className="text-xs text-text-faint">{t("common.loading")}</p>}
        {box && box.length === 0 && <p className="text-xs text-text-faint">{t("box.empty")}</p>}
        {action.error && <p className="text-xs text-red-400">{action.error.message}</p>}
        <div className="space-y-1.5">
          {(box ?? []).map((item) => (
            <BoxRow
              key={item.id}
              item={item}
              characters={(characters ?? []).map((c) => ({ id: c.id, name: c.name }))}
              disabled={action.isPending}
              onHandout={(characterId) => action.mutate({ action: "handout", id: item.id, characterId })}
              onRemove={() => action.mutate({ action: "remove", id: item.id })}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function BoxRow({
  item,
  characters,
  disabled,
  onHandout,
  onRemove,
}: {
  item: CampaignBoxItem;
  characters: { id: number; name: string }[];
  disabled: boolean;
  onHandout: (characterId: number) => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const d = item.data as Record<string, unknown>;
  const name = (d.name as string) ?? "?";
  const bonuses = Array.isArray(d.bonuses) ? (d.bonuses as { stat: string; value: number }[]) : [];

  const summary =
    item.kind === "quest"
      ? (d.description as string) ?? ""
      : [
          d.type as string,
          d.damage ? `${d.damage}` : null,
          d.ac ? `AC +${d.ac}` : null,
          bonuses.map((b) => `+${b.value} ${b.stat}`).join(", ") || null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="flex items-start gap-2 rounded border border-border/50 bg-bg-base px-3 py-2">
      {item.kind === "quest" ? (
        <Package size={14} className="mt-0.5 shrink-0 text-amber-400" />
      ) : (
        <Sword size={14} className="mt-0.5 shrink-0 text-accent-gold" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-base">{name}</p>
        {summary && <p className="truncate text-xs text-text-faint">{summary}</p>}
      </div>
      <select
        value=""
        disabled={disabled || characters.length === 0}
        onChange={(e) => {
          const id = Number(e.target.value);
          if (id) onHandout(id);
          e.target.value = "";
        }}
        className="shrink-0 rounded border border-emerald-800/40 bg-emerald-950/20 px-2 py-1 text-xs text-emerald-300 focus:outline-none disabled:opacity-50"
      >
        <option value="">{t("box.giveTo")}</option>
        {characters.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button
        onClick={onRemove}
        disabled={disabled}
        aria-label={t("common.remove")}
        className="shrink-0 text-red-400 hover:text-red-300 disabled:opacity-50"
      >
        <X size={14} />
      </button>
    </div>
  );
}
