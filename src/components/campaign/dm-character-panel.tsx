"use client";

import { useState } from "react";
import { useCampaignCharacters, useDmCharacterControl } from "@/hooks/useCampaigns";
import type { CampaignCharacter } from "@/lib/db/queries/campaigns";
import { DmBuildView } from "./dm-build-view";
import { DmGiveEquipmentForm } from "./dm-give-equipment-form";
import { Lock, LockOpen, X } from "lucide-react";
import { useT, tRace, tClass } from "@/lib/i18n";
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
  if (error && !characters) return <p className="text-sm text-accent-red">{t("campaign.loadCharactersError", { error: error.message })}</p>;
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
          onAction={(action, onSuccess) => controlMutation.mutate(action, { onSuccess })}
          // Only the row the running action belongs to waits; the others stay usable.
          isPending={controlMutation.isPending && controlMutation.variables?.characterId === char.id}
        />
      ))}
    </div>
  );
}

interface CharacterRowProps {
  char: CampaignCharacter;
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: Record<string, unknown>, onSuccess?: () => void) => void;
  isPending: boolean;
}

function CharacterRow({ char, expanded, onToggle, onAction, isPending }: CharacterRowProps) {
  const { locale } = useT();
  const [xpAmount, setXpAmount] = useState("10");
  const [hpAmount, setHpAmount] = useState("1");
  const [itemName, setItemName] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const { t } = useT();

  const hp = char.data.hp;
  const maxHp = char.data.maxHp;
  const hpPercent = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;
  const hpColor = hpPercent > 50 ? "bg-accent-green" : hpPercent > 25 ? "bg-accent-gold" : "bg-accent-red";
  const subtitle =
    [char.data.race && tRace(char.data.race, locale), char.data.class && tClass(char.data.class, locale)].filter(Boolean).join(" / ") ||
    t("campaign.notSelected");
  const hpStep = Math.max(1, Math.floor(Number(hpAmount)) || 1);
  const lockSummary = [
    [t("raceClass.title"), char.raceClassLocked],
    [t("progression.attributes"), char.attributesLocked],
    [t("progression.abilities"), char.abilitiesLocked],
  ] as const;

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

        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 shrink-0 max-w-[55%] sm:max-w-none">
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

          <div className="hidden sm:flex gap-1" aria-label={t("campaign.lockedSteps")}>
            {lockSummary.map(([label, locked]) => (
              <LockIcon key={label} locked={locked} label={label} />
            ))}
          </div>

          <span className="text-accent-gold text-xs">{t("campaign.manage")} {expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3 bg-bg-base/30">
          <div className="flex flex-wrap justify-end gap-2">
            {char.isOwn && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (!window.confirm(t("campaign.detachOwnConfirm", { name: char.name }))) return;
                  onAction({ action: "detachOwn", characterId: char.id });
                }}
                className="inline-flex items-center rounded border border-border px-3 py-1 text-xs text-text-muted hover:text-text-base hover:border-accent-gold/40 disabled:opacity-50 pointer-coarse:min-h-11"
              >
                {t("campaign.detachOwn")}
              </button>
            )}
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
                aria-label={t("campaign.xpAmount")}
                className="w-16 rounded border border-border bg-bg-base px-2 py-2 text-xs text-text-base text-center"
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
                className="rounded bg-accent-red/10 px-2 py-1 text-xs text-accent-red hover:bg-accent-red/15 disabled:opacity-50"
              >
                {t("campaign.resetXp")}
              </button>
            </div>

            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                value={hpAmount}
                onChange={(e) => setHpAmount(e.target.value)}
                aria-label={t("campaign.hpAmount")}
                className="w-14 rounded border border-border bg-bg-base px-2 py-2 text-xs text-text-base text-center"
              />
              <button
                onClick={() => onAction({ action: "updateHp", characterId: char.id, delta: hpStep })}
                disabled={isPending || hp >= maxHp}
                className="rounded bg-accent-green/10 px-3 py-2 text-xs text-accent-green hover:bg-accent-green/15 disabled:opacity-50"
              >
                {t("campaign.heal")} +{hpStep}
              </button>
              <button
                onClick={() => onAction({ action: "updateHp", characterId: char.id, delta: -hpStep })}
                disabled={isPending || hp <= 0}
                className="rounded bg-accent-red/10 px-3 py-2 text-xs text-accent-red hover:bg-accent-red/15 disabled:opacity-50"
              >
                {t("campaign.damage")} −{hpStep}
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
                placeholder={t("common.namePlaceholder")} aria-label={t("common.namePlaceholder")}
                className="w-full rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <input
                type="text"
                value={itemDesc}
                onChange={(e) => setItemDesc(e.target.value)}
                placeholder={t("common.description")} aria-label={t("common.description")}
                className="w-full rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base"
              />
            </div>
            <button
              onClick={() => {
                if (!itemName.trim()) return;
                // Cleared only once it worked, so a failed give keeps what was typed.
                onAction(
                  { action: "giveItem", characterId: char.id, item: { name: itemName.trim(), description: itemDesc.trim() } },
                  () => {
                    setItemName("");
                    setItemDesc("");
                  },
                );
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
                          onAction({ action: "removeItem", characterId: char.id, itemName: it.name, stashId: it.stashId });
                        }
                      }}
                      disabled={isPending}
                      aria-label={`${t("common.remove")} ${it.name}`}
                      className="text-accent-purple/60 hover:text-accent-red"
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
                          onAction({ action: "removeEquipment", characterId: char.id, equipmentName: eq.name, stashId: eq.stashId });
                        }
                      }}
                      disabled={isPending}
                      aria-label={`${t("common.remove")} ${eq.name}`}
                      className="text-accent-gold/60 hover:text-accent-red"
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
  const { t } = useT();
  const state = `${label}: ${locked ? t("common.lockedState") : t("common.unlockedState")}`;
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded ${
        locked ? "bg-accent-green/15 text-accent-green" : "bg-bg-base text-text-faint"
      }`}
      title={state}
      aria-label={state}
      role="img"
    >
      {locked ? <Lock size={11} aria-hidden="true" /> : <LockOpen size={11} aria-hidden="true" />}
    </span>
  );
}

function LockToggle({ label, locked, onToggle, disabled }: { label: string; locked: boolean; onToggle: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={locked}
      className={`rounded px-2 py-1 text-xs transition-colors pointer-coarse:min-h-11 disabled:opacity-50 ${
        locked
          ? "bg-accent-green/10 text-accent-green hover:bg-accent-green/20"
          : "bg-bg-base text-text-faint hover:bg-bg-surface"
      }`}
    >
      {locked ? <Lock size={12} aria-hidden="true" className="inline -mt-0.5" /> : <LockOpen size={12} aria-hidden="true" className="inline -mt-0.5" />} {label}
    </button>
  );
}
