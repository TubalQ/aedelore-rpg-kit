"use client";

import { useState } from "react";
import { useCampaignCharacters, useDmCharacterControl } from "@/hooks/useCampaigns";
import type { CampaignCharacter } from "@/lib/db/queries/campaigns";
import { DmBuildView } from "./dm-build-view";
import { DmGiveEquipmentForm } from "./dm-give-equipment-form";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import Link from "next/link";

interface DmCharacterPanelProps {
  campaignId: number;
}

export function DmCharacterPanel({ campaignId }: DmCharacterPanelProps) {
  const { data: characters, isLoading, error } = useCampaignCharacters(campaignId);
  const controlMutation = useDmCharacterControl(campaignId);
  // null = inget val ännu → första karaktären auto-expanderas; "none" = aktivt ihopfälld
  const [expandedId, setExpandedId] = useState<number | "none" | null>(null);
  const { t } = useT();

  if (isLoading) return <p className="text-sm text-text-muted">{t("campaign.loadingCharacters")}</p>;
  if (error) return <p className="text-sm text-red-400">{t("campaign.loadCharactersError", { error: error.message })}</p>;
  if (!characters || characters.length === 0) {
    return <p className="text-sm text-text-faint">{t("campaign.noCharactersInCampaign")}</p>;
  }

  const effectiveExpandedId = expandedId === null ? characters[0].id : expandedId === "none" ? null : expandedId;

  return (
    <div className="space-y-3">
      {characters.map((char) => (
        <CharacterRow
          key={char.id}
          char={char}
          expanded={effectiveExpandedId === char.id}
          onToggle={() => setExpandedId(effectiveExpandedId === char.id ? "none" : char.id)}
          onAction={(action) => controlMutation.mutate(action)}
          isPending={controlMutation.isPending}
        />
      ))}
      {controlMutation.error && (
        <p className="text-sm text-red-400">{controlMutation.error.message}</p>
      )}
    </div>
  );
}

interface CharacterRowProps {
  char: CampaignCharacter;
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: Record<string, unknown>) => void;
  isPending: boolean;
}

function CharacterRow({ char, expanded, onToggle, onAction, isPending }: CharacterRowProps) {
  const [xpAmount, setXpAmount] = useState("10");
  const [itemName, setItemName] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const { t } = useT();

  const hp = char.data.hp;
  const maxHp = char.data.maxHp;
  const hpPercent = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;
  const hpColor = hpPercent > 50 ? "bg-green-500" : hpPercent > 25 ? "bg-yellow-500" : "bg-red-500";
  const subtitle = [char.data.race, char.data.class].filter(Boolean).join(" / ") || t("campaign.notSelected");

  return (
    <div className="rounded-lg border border-border bg-bg-surface overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-base/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-base truncate">{char.name}</span>
            <span className="text-xs text-text-faint">({char.playerName ?? t("campaign.unknown")})</span>
          </div>
          <p className="text-xs text-text-muted">{subtitle}</p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-xs text-text-faint">HP</p>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-bg-base rounded-full overflow-hidden">
                <div className={`h-full ${hpColor} rounded-full`} style={{ width: `${hpPercent}%` }} />
              </div>
              <span className="text-xs text-text-base font-mono">{hp}/{maxHp}</span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-text-faint">XP</p>
            <span className="text-xs text-accent-gold font-mono">{char.xp}</span>
          </div>

          <div className="flex gap-1">
            <LockIcon locked={char.raceClassLocked} label="R" />
            <LockIcon locked={char.attributesLocked} label="A" />
            <LockIcon locked={char.abilitiesLocked} label="F" />
          </div>

          <span className="text-accent-gold text-xs">{t("campaign.manage")} {expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3 bg-bg-base/30">
          <div className="flex justify-end">
            <Link
              href={`/characters/${char.id}`}
              className="inline-flex items-center gap-1 rounded border border-accent-gold/40 bg-accent-gold/10 px-3 py-1 text-xs text-accent-gold hover:bg-accent-gold/20"
            >
              {t("campaign.openSheet")} →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={xpAmount}
                onChange={(e) => setXpAmount(e.target.value)}
                className="w-16 rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base text-center"
              />
              <button
                onClick={() => onAction({ action: "giveXp", characterId: char.id, amount: Number(xpAmount) })}
                disabled={isPending || !xpAmount}
                className="rounded bg-accent-gold/20 px-2 py-1 text-xs text-accent-gold hover:bg-accent-gold/30 disabled:opacity-50"
              >
                + XP
              </button>
              <button
                onClick={() => {
                  if (window.confirm(t("campaign.resetXpConfirm", { name: char.name }))) {
                    onAction({ action: "resetXp", characterId: char.id });
                  }
                }}
                disabled={isPending}
                className="rounded bg-red-950/30 px-2 py-1 text-xs text-red-400 hover:bg-red-950/50 disabled:opacity-50"
              >
                {t("campaign.resetXp")}
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => onAction({ action: "updateHp", characterId: char.id, hp: Math.min(hp + 1, maxHp) })}
                disabled={isPending || hp >= maxHp}
                className="rounded bg-green-950/30 px-2 py-1 text-xs text-green-400 hover:bg-green-950/50 disabled:opacity-50"
              >
                +1 HP
              </button>
              <button
                onClick={() => onAction({ action: "updateHp", characterId: char.id, hp: Math.max(hp - 1, 0) })}
                disabled={isPending || hp <= 0}
                className="rounded bg-red-950/30 px-2 py-1 text-xs text-red-400 hover:bg-red-950/50 disabled:opacity-50"
              >
                -1 HP
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] text-text-faint">{t("session.item")}</label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder={t("common.namePlaceholder")}
                className="w-full rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <input
                type="text"
                value={itemDesc}
                onChange={(e) => setItemDesc(e.target.value)}
                placeholder={t("common.description")}
                className="w-full rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base"
              />
            </div>
            <button
              onClick={() => {
                if (!itemName.trim()) return;
                onAction({ action: "giveItem", characterId: char.id, item: { name: itemName.trim(), description: itemDesc.trim() } });
                setItemName("");
                setItemDesc("");
              }}
              disabled={isPending || !itemName.trim()}
              className="rounded bg-accent-purple/20 px-2 py-1 text-xs text-accent-purple hover:bg-accent-purple/30 disabled:opacity-50"
            >
              {t("campaign.giveItem")}
            </button>
          </div>

          {(char.data.questItems.length > 0 || char.data.dmEquipment.length > 0) && (
            <div className="space-y-1">
              <p className="text-[10px] text-text-faint uppercase">{t("campaign.given")}</p>
              <div className="flex flex-wrap gap-1">
                {char.data.questItems.map((it, i) => (
                  <span key={`qi-${i}`} className="inline-flex items-center gap-1 rounded bg-accent-purple/10 border border-accent-purple/30 px-1.5 py-0.5 text-[10px] text-accent-purple">
                    {it.name}
                    <button
                      onClick={() => {
                        if (window.confirm(t("campaign.removeGivenConfirm", { name: it.name }))) {
                          onAction({ action: "removeItem", characterId: char.id, itemName: it.name });
                        }
                      }}
                      disabled={isPending}
                      aria-label={`${t("common.remove")} ${it.name}`}
                      className="text-accent-purple/60 hover:text-red-400"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {char.data.dmEquipment.map((eq, i) => (
                  <span key={`eq-${i}`} className="inline-flex items-center gap-1 rounded bg-accent-gold/10 border border-accent-gold/30 px-1.5 py-0.5 text-[10px] text-accent-gold">
                    {eq.name}
                    <button
                      onClick={() => {
                        if (window.confirm(t("campaign.removeGivenConfirm", { name: eq.name }))) {
                          onAction({ action: "removeEquipment", characterId: char.id, equipmentName: eq.name });
                        }
                      }}
                      disabled={isPending}
                      aria-label={`${t("common.remove")} ${eq.name}`}
                      className="text-accent-gold/60 hover:text-red-400"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <DmGiveEquipmentForm
            onGive={(equipment) => onAction({ action: "giveEquipment", characterId: char.id, equipment })}
            isPending={isPending}
          />

          <div className="flex flex-wrap gap-2">
            <LockToggle
              label={t("raceClass.title")}
              locked={char.raceClassLocked}
              onToggle={() => onAction({ action: "setLocks", characterId: char.id, raceClassLocked: !char.raceClassLocked })}
              disabled={isPending}
            />
            <LockToggle
              label={t("progression.attributes")}
              locked={char.attributesLocked}
              onToggle={() => onAction({ action: "setLocks", characterId: char.id, attributesLocked: !char.attributesLocked })}
              disabled={isPending}
            />
            <LockToggle
              label={t("progression.abilities")}
              locked={char.abilitiesLocked}
              onToggle={() => onAction({ action: "setLocks", characterId: char.id, abilitiesLocked: !char.abilitiesLocked })}
              disabled={isPending}
            />
          </div>

          <DmBuildView char={char} onAction={onAction} isPending={isPending} />
        </div>
      )}
    </div>
  );
}

function LockIcon({ locked, label }: { locked: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
        locked ? "bg-green-900/40 text-green-400" : "bg-bg-base text-text-faint"
      }`}
      title={locked ? `${label} ✓` : `${label} ✗`}
    >
      {label}
    </span>
  );
}

function LockToggle({ label, locked, onToggle, disabled }: { label: string; locked: boolean; onToggle: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`rounded px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
        locked
          ? "bg-green-900/30 text-green-400 hover:bg-green-900/50"
          : "bg-bg-base text-text-faint hover:bg-bg-surface"
      }`}
    >
      {locked ? "🔒" : "🔓"} {label}
    </button>
  );
}
