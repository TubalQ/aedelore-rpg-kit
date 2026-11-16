"use client";

import { useState, type ReactElement } from "react";
import type { CharacterData } from "@/lib/schemas/character";
import { WEAPONS, getWeapon } from "@/lib/domain/weapons";
import { ARMOR, SHIELDS, BODY_PARTS, getArmorBySlot, aggregateDisadvantages, computeTotalAc } from "@/lib/domain/armor";
import type { BodyPart } from "@/lib/domain/armor";
import { computeWeaponAtk } from "@/lib/domain/bonus-calc";
import { useT, tBodyPart } from "@/lib/i18n";

interface EquipmentProps {
  data: CharacterData;
  onChange: (partial: Partial<CharacterData>) => void;
}

const MAX_WEAPONS = 3;

// Effekt-/bonus-etiketter som små chips (delas av rustning och sköld).
// Armor/shield store disadvantage as string | null (not optional), so allow null.
type EffectSource = {
  advantage?: string | null;
  disadvantage?: string | null;
  bonuses?: { value: number; stat: string }[] | null;
  specialEffect?: string | null;
};

function EffectChips({ item }: { item: EffectSource }): ReactElement | null {
  const chips: ReactElement[] = [];
  if (item.disadvantage)
    chips.push(<span key="dis" className="rounded bg-bg-elevated px-1.5 py-0.5 text-[11px] text-accent-red">{item.disadvantage}</span>);
  if (item.advantage)
    chips.push(<span key="adv" className="rounded bg-bg-elevated px-1.5 py-0.5 text-[11px] text-accent-green">{item.advantage}</span>);
  item.bonuses?.forEach((b, j) =>
    chips.push(<span key={`b${j}`} className="rounded bg-bg-elevated px-1.5 py-0.5 text-[11px] text-accent-green">+{b.value} {b.stat}</span>),
  );
  if (item.specialEffect)
    chips.push(<span key="fx" className="rounded bg-bg-elevated px-1.5 py-0.5 text-[11px] text-accent-purple">{item.specialEffect}</span>);
  return chips.length ? <>{chips}</> : null;
}

// Förstorad, tappbar HP-stege (36x36 knappar). Ersätter de gamla 16px-knapparna.
function HpStepper({
  hp,
  maxHp,
  broken,
  label,
  onDec,
  onInc,
}: {
  hp: number;
  maxHp: number;
  broken?: boolean;
  label: string;
  onDec: () => void;
  onInc: () => void;
}): ReactElement {
  const { t } = useT();
  const btn =
    "grid place-items-center h-9 w-9 shrink-0 rounded-md border border-border bg-bg-surface text-lg leading-none transition-colors active:scale-95";
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onDec}
        aria-label={`${t("common.decrease")} HP ${label}`}
        className={`${btn} text-accent-red hover:border-accent-red/60`}
      >
        −
      </button>
      <span className={`font-mono tabular-nums text-sm w-12 text-center ${broken ? "text-accent-red line-through" : "text-text-base"}`}>
        {hp}/{maxHp}
      </span>
      <button
        type="button"
        onClick={onInc}
        aria-label={`${t("common.increase")} HP ${label}`}
        className={`${btn} text-accent-green hover:border-accent-green/60`}
      >
        +
      </button>
    </div>
  );
}

export function EquipmentSection({ data, onChange }: EquipmentProps) {
  const { t, locale } = useT();
  const [weaponSearch, setWeaponSearch] = useState("");
  const totalAc = computeTotalAc(data.equippedArmor);
  const penalties = aggregateDisadvantages(data.equippedArmor, data.equippedShield);

  function equipWeapon(weaponName: string) {
    const weapon = getWeapon(weaponName);
    if (!weapon || data.equippedWeapons.length >= MAX_WEAPONS) return;
    const atk = computeWeaponAtk(weapon, data);
    onChange({
      equippedWeapons: [
        ...data.equippedWeapons,
        {
          name: weapon.name,
          damage: weapon.damage,
          bonus: `+${atk}`,
          range: weapon.range,
          break: weapon.break,
        },
      ],
    });
    setWeaponSearch("");
  }

  function unequipWeapon(index: number) {
    onChange({
      equippedWeapons: data.equippedWeapons.filter((_, i) => i !== index),
    });
  }

  function equipArmor(slot: BodyPart, armorName: string) {
    if (!armorName) {
      onChange({
        equippedArmor: data.equippedArmor.filter((a) => a.bodypart !== slot),
      });
      return;
    }
    const piece = ARMOR.find((a) => a.name === armorName && a.bodypart === slot);
    if (!piece) return;
    const existing = data.equippedArmor.filter((a) => a.bodypart !== slot);
    onChange({
      equippedArmor: [
        ...existing,
        {
          name: piece.name,
          bodypart: slot,
          ac: piece.ac,
          hp: piece.hp,
          maxHp: piece.hp,
          disadvantage: piece.disadvantage,
        },
      ],
    });
  }

  function updateArmorHp(index: number, hp: number) {
    onChange({
      equippedArmor: data.equippedArmor.map((a, i) =>
        i === index ? { ...a, hp: Math.max(0, Math.min(hp, a.maxHp)) } : a,
      ),
    });
  }

  function equipShield(shieldName: string) {
    if (!shieldName) {
      onChange({ equippedShield: null });
      return;
    }
    const shield = SHIELDS.find((s) => s.name === shieldName);
    if (!shield) return;
    onChange({
      equippedShield: {
        name: shield.name,
        ac: shield.ac,
        hp: shield.hp,
        maxHp: shield.hp,
        damage: shield.damage,
        disadvantage: shield.disadvantage,
      },
    });
  }

  function updateShieldHp(hp: number) {
    if (!data.equippedShield) return;
    onChange({
      equippedShield: {
        ...data.equippedShield,
        hp: Math.max(0, Math.min(hp, data.equippedShield.maxHp)),
      },
    });
  }

  const filteredWeapons = weaponSearch
    ? WEAPONS.filter((w) => w.name.toLowerCase().includes(weaponSearch.toLowerCase()))
    : [];

  return (
    <section className="min-w-0 rounded-lg border border-border bg-bg-surface p-4 space-y-4">
      <h2 className="text-lg font-semibold text-text-base">{t("equipment.title")}</h2>

      {/* --- Weapons --- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-muted">
            {t("equipment.weapons")} ({data.equippedWeapons.length}/{MAX_WEAPONS})
          </h3>
        </div>

        {data.equippedWeapons.map((w, i) => {
          const weaponData = getWeapon(w.name);
          const atk = weaponData ? computeWeaponAtk(weaponData, data) : parseInt(w.bonus) || 0;
          return (
            <div key={i} className="flex items-center gap-3 min-w-0 rounded-lg border border-border/50 bg-bg-base px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-text-base">{w.name}</span>
                <div className="flex gap-x-3 gap-y-1 text-xs text-text-faint mt-1 flex-wrap">
                  <span className="text-accent-green">ATK +{atk}</span>
                  <span>DMG {w.damage}</span>
                  <span>Range {w.range}</span>
                  {w.break > 0 && <span>Break {w.break}</span>}
                  {w.advantage && <span className="text-accent-green">Adv: {w.advantage}</span>}
                  {w.disadvantage && <span className="text-accent-red">Dis: {w.disadvantage}</span>}
                  {w.bonuses?.map((b, j) => (
                    <span key={j} className="text-accent-green">+{b.value} {b.stat}</span>
                  ))}
                </div>
                {w.specialEffect && (
                  <p className="text-xs text-accent-purple mt-1">{w.specialEffect}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => unequipWeapon(i)}
                className="shrink-0 rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-accent-red hover:border-accent-red/60 hover:text-accent-red transition-colors"
              >
                {t("equipment.unequip")}
              </button>
            </div>
          );
        })}

        {data.equippedWeapons.length < MAX_WEAPONS && (
          <div className="relative">
            <input
              type="text"
              value={weaponSearch}
              onChange={(e) => setWeaponSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-base focus:border-accent-gold/50 focus:outline-none"
              placeholder={t("equipment.searchWeapons")} aria-label={t("equipment.searchWeapons")}
            />
            {filteredWeapons.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded border border-border bg-bg-surface shadow-lg">
                {filteredWeapons.map((w) => {
                  const atk = computeWeaponAtk(w, data);
                  return (
                    <button
                      key={w.name}
                      onClick={() => equipWeapon(w.name)}
                      className="w-full text-left px-3 py-1.5 hover:bg-bg-base text-sm"
                    >
                      <span className="text-text-base">{w.name}</span>
                      <span className="text-xs text-text-faint ml-2">
                        ATK +{atk} | {w.damage} | {w.subtype}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- Armor --- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-muted">{t("equipment.armor")}</h3>
          <span className="text-sm font-mono font-bold text-accent-gold">
            {t("equipment.totalAc")}: {totalAc}
          </span>
        </div>

        <div className="grid gap-2 min-w-0">
          {BODY_PARTS.map((slot) => {
            const equipped = data.equippedArmor.find((a) => a.bodypart === slot);
            const armorIndex = data.equippedArmor.findIndex((a) => a.bodypart === slot);
            const options = getArmorBySlot(slot);
            // Ett utrustat DM/special-föremål finns inte i bas-rustningslistan → lägg det
            // som en egen option, annars visar <select> "none" fast det är utrustat.
            const equippedIsCustom = !!equipped && !options.some((a) => a.name === equipped.name);
            const broken = equipped && equipped.hp <= 0;

            return (
              <div key={slot} className={`min-w-0 rounded-lg border px-3 py-2.5 ${
                broken ? "border-accent-red/35 bg-accent-red/5" : "border-border/50 bg-bg-base"
              }`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-16 shrink-0 text-[11px] uppercase tracking-wide text-text-faint">{tBodyPart(slot, locale)}</span>
                  {/* Wrapper styr bredden; select w-full klipper i stället för att
                      tvinga sin content-bredd (native select krymper inte i flex
                      pa mobil). */}
                  <div className="flex-1 min-w-0">
                    <select
                      value={equipped?.name ?? ""}
                      onChange={(e) => equipArmor(slot, e.target.value)}
                      className="w-full rounded-md border border-border bg-bg-surface px-2.5 py-2 text-sm text-text-base focus:border-accent-gold/50 focus:outline-none"
                    >
                      <option value="">{t("equipment.noneOption")}</option>
                      {equippedIsCustom && equipped && (
                        <option value={equipped.name}>
                          {equipped.name} (AC +{equipped.ac}, HP {equipped.maxHp})
                        </option>
                      )}
                      {options.map((a) => (
                        <option key={a.name} value={a.name}>
                          {a.name} (AC +{a.ac}, HP {a.hp}, {a.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {equipped && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="font-mono text-xs text-text-muted">AC +{equipped.ac}</span>
                    <EffectChips item={equipped} />
                    <div className="ml-auto">
                      <HpStepper
                        hp={equipped.hp}
                        maxHp={equipped.maxHp}
                        broken={broken}
                        label={equipped.name}
                        onDec={() => updateArmorHp(armorIndex, equipped.hp - 1)}
                        onInc={() => updateArmorHp(armorIndex, equipped.hp + 1)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* --- Shield --- */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-text-muted">{t("equipment.shield")}</h3>
        <div className={`min-w-0 rounded-lg border px-3 py-2.5 ${
          data.equippedShield && data.equippedShield.hp <= 0 ? "border-accent-red/35 bg-accent-red/5" : "border-border/50 bg-bg-base"
        }`}>
          <select
            value={data.equippedShield?.name ?? ""}
            onChange={(e) => equipShield(e.target.value)}
            className="w-full rounded-md border border-border bg-bg-surface px-2.5 py-2 text-sm text-text-base focus:border-accent-gold/50 focus:outline-none"
          >
            <option value="">{t("equipment.noneOption")}</option>
            {data.equippedShield && !SHIELDS.some((s) => s.name === data.equippedShield!.name) && (
              <option value={data.equippedShield.name}>
                {data.equippedShield.name} (Block AC {data.equippedShield.ac}, HP {data.equippedShield.maxHp})
              </option>
            )}
            {SHIELDS.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} (Block AC {s.ac}, HP {s.hp}, DMG {s.damage})
              </option>
            ))}
          </select>
          {data.equippedShield && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-mono text-xs text-text-muted">Block {data.equippedShield.ac}</span>
              <EffectChips item={data.equippedShield} />
              <div className="ml-auto">
                <HpStepper
                  hp={data.equippedShield.hp}
                  maxHp={data.equippedShield.maxHp}
                  broken={data.equippedShield.hp <= 0}
                  label={data.equippedShield.name}
                  onDec={() => updateShieldHp(data.equippedShield!.hp - 1)}
                  onInc={() => updateShieldHp(data.equippedShield!.hp + 1)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- Armor Penalties --- */}
      {Object.keys(penalties).length > 0 && (
        <div className="rounded border border-accent-red/20 bg-accent-red/5 px-3 py-2">
          <span className="text-xs text-accent-red font-medium">{t("equipment.armorPenalty")} </span>
          <span className="text-xs text-accent-red/80">
            {Object.entries(penalties)
              .map(([skill, val]) => `${val} ${skill}`)
              .join(", ")}
          </span>
        </div>
      )}
    </section>
  );
}
