"use client";

import { useState } from "react";
import type { CharacterData } from "@/lib/schemas/character";
import { useT, type TranslationKey } from "@/lib/i18n";
import { isBodyPart } from "@/lib/domain/armor";
import { DM_COPY_SUFFIX } from "@/lib/stash/holdings";

interface DmEquipmentProps {
  data: CharacterData;
  onChange: (partial: Partial<CharacterData>) => void;
}

const RARITY_STYLES: Record<string, string> = {
  common: "border-border/50 text-text-base",
  enchanted: "border-accent-blue/35 text-accent-blue",
  rare: "border-accent-purple/35 text-accent-purple",
  legendary: "border-accent-gold/50 text-accent-gold",
};

function getRarityStyle(rarity: string | undefined): string {
  return RARITY_STYLES[rarity ?? "common"] ?? RARITY_STYLES.common;
}

export function DmEquipmentSection({ data, onChange }: DmEquipmentProps) {
  const { t } = useT();
  const [expanded, setExpanded] = useState<number | null>(null);

  if (data.dmEquipment.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-bg-surface p-4">
        <h2 className="text-lg font-semibold text-text-base">{t("dmEquipment.title")}</h2>
        <p className="text-xs text-text-faint mt-2">{t("dmEquipment.noneFromDm")}</p>
      </section>
    );
  }

  // Ett DM-föremål ska bara kunna utrustas EN gång - utan spärren kunde
  // upprepade tryck stapla kopior (och deras stat-bonusar) upp till vapentaket.
  function isDmItemEquipped(eq: CharacterData["dmEquipment"][number]): boolean {
    const dmName = `${eq.name}${DM_COPY_SUFFIX}`;
    const same = (c: { name: string; stashId?: number }) => (eq.stashId != null && c.stashId === eq.stashId) || c.name === dmName;
    if (eq.type === "weapon") return data.equippedWeapons.some(same);
    if (eq.type === "armor") return data.equippedArmor.some(same);
    if (eq.type === "shield") return !!data.equippedShield && same(data.equippedShield);
    return false;
  }

  function equipDmWeapon(index: number) {
    const eq = data.dmEquipment[index];
    if (eq.type !== "weapon" || data.equippedWeapons.length >= 3) return;
    if (isDmItemEquipped(eq)) return;
    onChange({
      equippedWeapons: [
        ...data.equippedWeapons,
        {
          name: `${eq.name}${DM_COPY_SUFFIX}`,
          damage: eq.damage ?? "1d6",
          bonus: eq.atkBonus ?? "+0",
          range: eq.range ?? "1",
          break: parseInt(eq.breakVal ?? "0"),
          advantage: eq.advantage,
          disadvantage: eq.disadvantage,
          bonuses: eq.bonuses,
          specialEffect: eq.specialEffect,
          stashId: eq.stashId,
        },
      ],
    });
  }

  function equipDmArmor(index: number) {
    const eq = data.dmEquipment[index];
    if (eq.type !== "armor" || !eq.bodypart) return;
    const slot = eq.bodypart as string;
    const existing = data.equippedArmor.filter((a) => a.bodypart !== slot);
    onChange({
      equippedArmor: [
        ...existing,
        {
          name: `${eq.name}${DM_COPY_SUFFIX}`,
          bodypart: slot,
          ac: eq.ac ?? 0,
          hp: eq.hp ?? eq.maxHp ?? 10,
          maxHp: eq.maxHp ?? eq.hp ?? 10,
          disadvantage: eq.disadvantage ?? null,
          advantage: eq.advantage,
          bonuses: eq.bonuses,
          specialEffect: eq.specialEffect,
          stashId: eq.stashId,
        },
      ],
    });
  }

  function equipDmShield(index: number) {
    const eq = data.dmEquipment[index];
    if (eq.type !== "shield") return;
    onChange({
      equippedShield: {
        name: `${eq.name}${DM_COPY_SUFFIX}`,
        ac: eq.ac ?? 10,
        hp: eq.hp ?? eq.maxHp ?? 10,
        maxHp: eq.maxHp ?? eq.hp ?? 10,
        damage: eq.damage ?? "1d6",
        disadvantage: eq.disadvantage ?? null,
        advantage: eq.advantage,
        bonuses: eq.bonuses,
        specialEffect: eq.specialEffect,
        stashId: eq.stashId,
      },
    });
  }

  return (
    <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
      <h2 className="text-lg font-semibold text-text-base">
        {t("dmEquipment.title")} ({data.dmEquipment.length})
      </h2>

      <div className="space-y-1">
        {data.dmEquipment.map((eq, i) => {
          const isOpen = expanded === i;
          const style = getRarityStyle(eq.rarity);
          return (
            <div key={i} className={`rounded border ${style.split(" ")[0]} bg-bg-base`}>
              <button
                onClick={() => setExpanded(isOpen ? null : i)}
                className="w-full flex items-center justify-between px-3 py-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${style.split(" ").slice(1).join(" ")}`}>
                    {eq.name}
                  </span>
                  <span className="text-[10px] text-text-faint uppercase">{eq.type}</span>
                  {eq.rarity && eq.rarity !== "common" && (
                    <span className={`text-[10px] uppercase ${style.split(" ").slice(1).join(" ")}`}>
                      {eq.rarity}
                    </span>
                  )}
                </div>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2 text-xs">
                  {eq.description && (
                    <p className="text-text-muted">{eq.description}</p>
                  )}
                  {eq.specialEffect && (
                    <p className="text-accent-purple">{eq.specialEffect}</p>
                  )}
                  <div className="flex gap-3 text-text-faint flex-wrap">
                    {eq.damage && <span>DMG: {eq.damage}</span>}
                    {eq.atkBonus && <span>ATK: {eq.atkBonus}</span>}
                    {eq.range && <span>{t("dmEquipment.range")}: {eq.range}</span>}
                    {eq.ac !== undefined && <span>AC: +{eq.ac}</span>}
                    {eq.hp !== undefined && eq.maxHp !== undefined && (
                      <span className={eq.hp <= 0 ? "text-accent-red" : ""}>
                        HP: {eq.hp}/{eq.maxHp}
                      </span>
                    )}
                    {eq.hp !== undefined && eq.maxHp === undefined && <span>HP: {eq.hp}</span>}
                    {eq.advantage && <span className="text-accent-green">Adv: {eq.advantage}</span>}
                    {eq.disadvantage && <span className="text-accent-red">Dis: {eq.disadvantage}</span>}
                  </div>
                  {eq.bonuses && eq.bonuses.length > 0 && (
                    <div className="flex gap-2">
                      {eq.bonuses.map((b, j) => (
                        <span key={j} className="text-accent-green">+{b.value} {b.stat}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    {isDmItemEquipped(eq) ? (
                      <span className="rounded bg-bg-surface px-2 py-0.5 text-accent-green/70">
                        {t("dmEquipment.equipped")}
                      </span>
                    ) : (
                      <>
                        {eq.type === "weapon" && (
                          <button
                            onClick={() => equipDmWeapon(i)}
                            disabled={data.equippedWeapons.length >= 3}
                            className="rounded bg-accent-green/10 px-2 py-0.5 text-accent-green hover:bg-accent-green/20 disabled:opacity-30"
                          >
                            {t("dmEquipment.equip")}
                          </button>
                        )}
                        {eq.type === "armor" && eq.bodypart && (
                          <button
                            onClick={() => equipDmArmor(i)}
                            className="rounded bg-accent-green/10 px-2 py-0.5 text-accent-green hover:bg-accent-green/20"
                          >
                            {t("dmEquipment.equip")} ({isBodyPart(eq.bodypart) ? t(`equipment.body.${eq.bodypart}` as TranslationKey) : eq.bodypart})
                          </button>
                        )}
                        {eq.type === "shield" && (
                          <button
                            onClick={() => equipDmShield(i)}
                            className="rounded bg-accent-green/10 px-2 py-0.5 text-accent-green hover:bg-accent-green/20"
                          >
                            {t("dmEquipment.equip")}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
