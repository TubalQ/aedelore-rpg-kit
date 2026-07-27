"use client";

import { useState } from "react";
import type { CharacterData } from "@/lib/schemas/character";
import { WEAPONS, getWeapon } from "@/lib/domain/weapons";
import type { WeaponData } from "@/lib/domain/weapons";
import { ARMOR, SHIELDS, getBaseAc, BODY_PARTS, getArmorBySlot, aggregateDisadvantages } from "@/lib/domain/armor";
import type { BodyPart } from "@/lib/domain/armor";
import { getModifier } from "@/lib/domain/attributes";
import { getAttributeTotal } from "@/lib/domain/bonus-calc";
import { useT, tBodyPart } from "@/lib/i18n";

interface EquipmentProps {
  data: CharacterData;
  onChange: (partial: Partial<CharacterData>) => void;
}

const MAX_WEAPONS = 3;

// ATK = weapon base bonus + attribute modifier, where the attribute uses its
// FULL value (distributed + race/class/religion + equipped-gear bonuses) - not
// just the distributed points. Modifier = ceil(value / 2).
function calculateAtk(weapon: WeaponData, data: CharacterData): number {
  const strMod = getModifier(getAttributeTotal("Strength", data));
  const dexMod = getModifier(getAttributeTotal("Dexterity", data));

  let attrMod: number;
  if (weapon.ability === "Strength/Dexterity") {
    attrMod = Math.max(strMod, dexMod);
  } else if (weapon.ability === "Dexterity") {
    attrMod = dexMod;
  } else {
    attrMod = strMod;
  }

  const weaponBonus = parseInt(weapon.bonus) || 0;
  return weaponBonus + attrMod;
}

function calculateTotalAc(equippedArmor: CharacterData["equippedArmor"]): number {
  let ac = getBaseAc();
  for (const piece of equippedArmor) {
    if (piece.hp > 0) ac += piece.ac;
  }
  return ac;
}

export function EquipmentSection({ data, onChange }: EquipmentProps) {
  const { t, locale } = useT();
  const [weaponSearch, setWeaponSearch] = useState("");
  const totalAc = calculateTotalAc(data.equippedArmor);
  const penalties = aggregateDisadvantages(data.equippedArmor, data.equippedShield);

  function equipWeapon(weaponName: string) {
    const weapon = getWeapon(weaponName);
    if (!weapon || data.equippedWeapons.length >= MAX_WEAPONS) return;
    const atk = calculateAtk(weapon, data);
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
    <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-4">
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
          const atk = weaponData ? calculateAtk(weaponData, data) : parseInt(w.bonus) || 0;
          return (
            <div key={i} className="flex items-center gap-2 rounded border border-border/50 bg-bg-base px-3 py-2">
              <div className="flex-1">
                <span className="text-sm font-medium text-text-base">{w.name}</span>
                <div className="flex gap-3 text-xs text-text-faint mt-0.5 flex-wrap">
                  <span className="text-green-400">ATK +{atk}</span>
                  <span>DMG {w.damage}</span>
                  <span>Range {w.range}</span>
                  {w.break > 0 && <span>Break {w.break}</span>}
                  {w.advantage && <span className="text-green-400">Adv: {w.advantage}</span>}
                  {w.disadvantage && <span className="text-red-400">Dis: {w.disadvantage}</span>}
                  {w.bonuses?.map((b, j) => (
                    <span key={j} className="text-green-400">+{b.value} {b.stat}</span>
                  ))}
                </div>
                {w.specialEffect && (
                  <p className="text-xs text-purple-400 mt-0.5">{w.specialEffect}</p>
                )}
              </div>
              <button
                onClick={() => unequipWeapon(i)}
                className="text-xs text-red-400 hover:text-red-300"
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
              className="w-full rounded border border-border bg-bg-base px-3 py-1.5 text-sm text-text-base focus:border-accent-gold/50 focus:outline-none"
              placeholder={t("equipment.searchWeapons")}
            />
            {filteredWeapons.length > 0 && (
              <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded border border-border bg-bg-surface shadow-lg">
                {filteredWeapons.map((w) => {
                  const atk = calculateAtk(w, data);
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

        <div className="grid gap-2">
          {BODY_PARTS.map((slot) => {
            const equipped = data.equippedArmor.find((a) => a.bodypart === slot);
            const armorIndex = data.equippedArmor.findIndex((a) => a.bodypart === slot);
            const options = getArmorBySlot(slot);
            // Ett utrustat DM/special-föremål finns inte i bas-rustningslistan → lägg det
            // som en egen option, annars visar <select> "none" fast det är utrustat.
            const equippedIsCustom = !!equipped && !options.some((a) => a.name === equipped.name);
            const broken = equipped && equipped.hp <= 0;

            return (
              <div key={slot} className={`flex items-center gap-2 rounded border px-3 py-1.5 ${
                broken ? "border-red-900/50 bg-red-950/10" : "border-border/50 bg-bg-base"
              }`}>
                <span className="text-xs text-text-faint w-20">{tBodyPart(slot, locale)}</span>
                <select
                  value={equipped?.name ?? ""}
                  onChange={(e) => equipArmor(slot, e.target.value)}
                  className="flex-1 rounded border border-border bg-bg-surface px-2 py-0.5 text-xs text-text-base focus:outline-none"
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
                {equipped && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-text-faint">AC +{equipped.ac}</span>
                    <button
                      onClick={() => updateArmorHp(armorIndex, equipped.hp - 1)}
                      aria-label={`${t("common.decrease")} HP ${equipped.name}`}
                      className="w-4 h-4 rounded bg-bg-surface text-[10px] text-red-400"
                    >
                      -
                    </button>
                    <span className={`text-xs font-mono w-8 text-center ${
                      broken ? "text-red-400 line-through" : "text-text-base"
                    }`}>
                      {equipped.hp}/{equipped.maxHp}
                    </span>
                    <button
                      onClick={() => updateArmorHp(armorIndex, equipped.hp + 1)}
                      aria-label={`${t("common.increase")} HP ${equipped.name}`}
                      className="w-4 h-4 rounded bg-bg-surface text-[10px] text-green-400"
                    >
                      +
                    </button>
                    {equipped.disadvantage && (
                      <span className="text-[10px] text-red-400/70">{equipped.disadvantage}</span>
                    )}
                    {equipped.advantage && (
                      <span className="text-[10px] text-green-400/70">{equipped.advantage}</span>
                    )}
                    {equipped.bonuses?.map((b, j) => (
                      <span key={j} className="text-[10px] text-green-400/70">+{b.value} {b.stat}</span>
                    ))}
                    {equipped.specialEffect && (
                      <span className="text-[10px] text-purple-400/70">{equipped.specialEffect}</span>
                    )}
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
        <div className="flex items-center gap-2 rounded border border-border/50 bg-bg-base px-3 py-1.5">
          <select
            value={data.equippedShield?.name ?? ""}
            onChange={(e) => equipShield(e.target.value)}
            className="flex-1 rounded border border-border bg-bg-surface px-2 py-0.5 text-xs text-text-base focus:outline-none"
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
            <div className="flex items-center gap-1">
              <span className="text-xs text-text-faint">Block {data.equippedShield.ac}</span>
              <button
                onClick={() => updateShieldHp(data.equippedShield!.hp - 1)}
                aria-label={`${t("common.decrease")} HP ${data.equippedShield.name}`}
                className="w-4 h-4 rounded bg-bg-surface text-[10px] text-red-400"
              >
                -
              </button>
              <span className={`text-xs font-mono w-8 text-center ${
                data.equippedShield.hp <= 0 ? "text-red-400 line-through" : "text-text-base"
              }`}>
                {data.equippedShield.hp}/{data.equippedShield.maxHp}
              </span>
              <button
                onClick={() => updateShieldHp(data.equippedShield!.hp + 1)}
                aria-label={`${t("common.increase")} HP ${data.equippedShield.name}`}
                className="w-4 h-4 rounded bg-bg-surface text-[10px] text-green-400"
              >
                +
              </button>
              {data.equippedShield.advantage && (
                <span className="text-[10px] text-green-400/70">{data.equippedShield.advantage}</span>
              )}
              {data.equippedShield.bonuses?.map((b, j) => (
                <span key={j} className="text-[10px] text-green-400/70">+{b.value} {b.stat}</span>
              ))}
              {data.equippedShield.specialEffect && (
                <span className="text-[10px] text-purple-400/70">{data.equippedShield.specialEffect}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- Armor Penalties --- */}
      {Object.keys(penalties).length > 0 && (
        <div className="rounded border border-red-900/30 bg-red-950/10 px-3 py-2">
          <span className="text-xs text-red-400 font-medium">{t("equipment.armorPenalty")} </span>
          <span className="text-xs text-red-400/80">
            {Object.entries(penalties)
              .map(([skill, val]) => `${val} ${skill}`)
              .join(", ")}
          </span>
        </div>
      )}
    </section>
  );
}
