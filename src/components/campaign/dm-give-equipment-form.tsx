"use client";

import { useState } from "react";
import { z } from "zod";
import { DmEquipmentSchema } from "@/lib/schemas/character";
import { BODY_PARTS } from "@/lib/domain/armor";
import { useT, type TranslationKey } from "@/lib/i18n";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { BonusEditor } from "@/components/ui/bonus-editor";
import {
  DiceSelect,
  AtkSelect,
  BaseWeaponSelect,
  BaseArmorSelect,
  ShieldSelect,
  AdvantageEditor,
  DisadvantageEditor,
} from "@/components/ui/equipment-selects";

type DmEquipment = z.infer<typeof DmEquipmentSchema>;
type EquipmentType = DmEquipment["type"];
type Bonus = { stat: string; value: number };

const TYPE_LABEL_KEYS: Record<EquipmentType, TranslationKey> = {
  weapon: "sessionCard.equipment.typeWeapon",
  armor: "sessionCard.equipment.typeArmor",
  shield: "sessionCard.equipment.typeShield",
  misc: "sessionCard.equipment.typeMisc",
};

const RARITY_LABEL_KEYS: Record<string, TranslationKey> = {
  common: "sessionCard.equipment.rarityCommon",
  enchanted: "sessionCard.equipment.rarityEnchanted",
  rare: "sessionCard.equipment.rarityRare",
  legendary: "sessionCard.equipment.rarityLegendary",
};

interface DmGiveEquipmentFormProps {
  onGive: (equipment: DmEquipment) => void;
  isPending: boolean;
}

export function DmGiveEquipmentForm({ onGive, isPending }: DmGiveEquipmentFormProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<EquipmentType>("weapon");
  const [rarity, setRarity] = useState("common");
  const [description, setDescription] = useState("");
  const [baseWeapon, setBaseWeapon] = useState("");
  const [baseArmor, setBaseArmor] = useState("");
  const [damage, setDamage] = useState("");
  const [atkBonus, setAtkBonus] = useState("");
  const [range, setRange] = useState("");
  const [breakVal, setBreakVal] = useState("");
  const [ac, setAc] = useState("");
  const [hp, setHp] = useState("");
  const [bodypart, setBodypart] = useState<string>(BODY_PARTS[0]);
  // Egenskaper - samma modell som EquipmentCard i sessionsprep, så båda
  // skapandevägarna kan ge magiska föremål (bonusar/fördel/specialeffekt).
  const [advantage, setAdvantage] = useState("");
  const [disadvantage, setDisadvantage] = useState("");
  const [specialEffect, setSpecialEffect] = useState("");
  const [bonuses, setBonuses] = useState<Bonus[]>([]);

  function resetForm() {
    setName("");
    setType("weapon");
    setRarity("common");
    setDescription("");
    setBaseWeapon("");
    setBaseArmor("");
    setDamage("");
    setAtkBonus("");
    setRange("");
    setBreakVal("");
    setAc("");
    setHp("");
    setBodypart(BODY_PARTS[0]);
    setAdvantage("");
    setDisadvantage("");
    setSpecialEffect("");
    setBonuses([]);
  }

  function submit() {
    if (!name.trim()) return;
    const isWeaponish = type === "weapon" || type === "misc";
    const isArmorish = type === "armor" || type === "shield";
    const equipment: DmEquipment = {
      name: name.trim(),
      type,
      rarity,
      description: description.trim() || undefined,
      baseWeapon: type === "weapon" ? baseWeapon || undefined : undefined,
      baseArmor: isArmorish ? baseArmor || undefined : undefined,
      damage: type === "weapon" || type === "shield" ? damage.trim() || undefined : undefined,
      atkBonus: type === "weapon" ? atkBonus.trim() || undefined : undefined,
      range: type === "weapon" ? range.trim() || undefined : undefined,
      breakVal: type === "weapon" ? breakVal.trim() || undefined : undefined,
      bodypart: type === "armor" ? bodypart : undefined,
      ac: isArmorish ? (ac ? Number(ac) : undefined) : undefined,
      hp: isArmorish ? (hp ? Number(hp) : undefined) : undefined,
      maxHp: isArmorish ? (hp ? Number(hp) : undefined) : undefined,
      advantage: isWeaponish ? advantage.trim() || undefined : undefined,
      disadvantage: isArmorish ? disadvantage.trim() || undefined : undefined,
      specialEffect: specialEffect.trim() || undefined,
      bonuses: bonuses.filter((b) => b.stat.trim()).length > 0
        ? bonuses.filter((b) => b.stat.trim())
        : undefined,
    };
    onGive(equipment);
    resetForm();
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-accent-gold/20 px-2 py-1 text-xs text-accent-gold hover:bg-accent-gold/30"
      >
        + {t("campaign.giveEquipment")}
      </button>
    );
  }

  const inputCls = "rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base focus:outline-none";
  const labelCls = "block text-[10px] text-text-faint";

  return (
    <div className="rounded border border-accent-gold/30 bg-bg-base/50 p-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("sessionCard.equipment.namePlaceholder")}
          className={`${inputCls} flex-1 min-w-[120px]`}
        />
        <select value={type} onChange={(e) => setType(e.target.value as EquipmentType)} className={inputCls}>
          {(Object.keys(TYPE_LABEL_KEYS) as EquipmentType[]).map((ty) => (
            <option key={ty} value={ty}>{t(TYPE_LABEL_KEYS[ty])}</option>
          ))}
        </select>
        <select value={rarity} onChange={(e) => setRarity(e.target.value)} className={inputCls}>
          {Object.keys(RARITY_LABEL_KEYS).map((r) => (
            <option key={r} value={r}>{t(RARITY_LABEL_KEYS[r])}</option>
          ))}
        </select>
      </div>

      {/* Basföremål ur domändatat - förifyller stats (redigerbara efteråt) */}
      {type === "weapon" && (
        <div className="flex flex-wrap gap-2">
          <div>
            <label className={labelCls}>{t("sessionCard.equipment.baseWeapon")}</label>
            <BaseWeaponSelect
              value={baseWeapon}
              onChange={setBaseWeapon}
              onPick={(w) => {
                setDamage(w.damage);
                setAtkBonus(w.bonus);
                setRange(w.range);
                setBreakVal(String(w.break));
                if (!name.trim()) setName(w.name);
              }}
            />
          </div>
          <div>
            <label className={labelCls}>{t("sessionCard.equipment.damage")}</label>
            <DiceSelect value={damage} onChange={setDamage} className="w-24" />
          </div>
          <div>
            <label className={labelCls}>{t("sessionCard.equipment.atk")}</label>
            <AtkSelect value={atkBonus} onChange={setAtkBonus} className="w-20" />
          </div>
          <div>
            <label className={labelCls}>{t("sessionCard.equipment.range")}</label>
            <input type="text" value={range} onChange={(e) => setRange(e.target.value)} placeholder="1 / 20:40" className={`${inputCls} w-20`} />
          </div>
          <div>
            <label className={labelCls}>{t("sessionCard.equipment.break")}</label>
            <input type="text" value={breakVal} onChange={(e) => setBreakVal(e.target.value)} className={`${inputCls} w-16`} />
          </div>
        </div>
      )}

      {type === "armor" && (
        <div className="flex flex-wrap gap-2">
          <div>
            <label className={labelCls}>{t("sessionCard.equipment.baseArmor")}</label>
            <BaseArmorSelect
              value={baseArmor}
              onChange={setBaseArmor}
              onPick={(a) => {
                setBodypart(a.bodypart);
                setAc(String(a.ac));
                setHp(String(a.hp));
                setDisadvantage(a.disadvantage ?? "");
                if (!name.trim()) setName(a.name);
              }}
            />
          </div>
          <select value={bodypart} onChange={(e) => setBodypart(e.target.value)} className={`${inputCls} self-end`}>
            {BODY_PARTS.map((bp) => (
              <option key={bp} value={bp}>{t(`equipment.body.${bp}` as TranslationKey)}</option>
            ))}
          </select>
        </div>
      )}

      {type === "shield" && (
        <div className="flex flex-wrap gap-2">
          <div>
            <label className={labelCls}>{t("sessionCard.equipment.baseArmor")}</label>
            <ShieldSelect
              value={baseArmor}
              onChange={setBaseArmor}
              onPick={(s) => {
                setAc(String(s.ac));
                setHp(String(s.hp));
                setDamage(s.damage);
                setDisadvantage(s.disadvantage ?? "");
                if (!name.trim()) setName(s.name);
              }}
            />
          </div>
          <div>
            <label className={labelCls}>{t("sessionCard.equipment.damage")}</label>
            <DiceSelect value={damage} onChange={setDamage} className="w-24" />
          </div>
        </div>
      )}

      {(type === "armor" || type === "shield") && (
        <div className="flex flex-wrap gap-2">
          <div>
            <label className={labelCls}>AC</label>
            <input type="number" value={ac} onChange={(e) => setAc(e.target.value)} className={`${inputCls} w-16`} />
          </div>
          <div>
            <label className={labelCls}>HP</label>
            <input type="number" value={hp} onChange={(e) => setHp(e.target.value)} className={`${inputCls} w-16`} />
          </div>
        </div>
      )}

      {/* Fördel (vapen/övrigt) ur rullista; nackdel (rustning/sköld) i det
          strukturerade formatet som AC-panelen parsar */}
      {(type === "weapon" || type === "misc") && (
        <AdvantageEditor value={advantage} onChange={setAdvantage} />
      )}
      {(type === "armor" || type === "shield") && (
        <DisadvantageEditor value={disadvantage} onChange={setDisadvantage} />
      )}

      <AutoTextarea
        rows={1}
        value={specialEffect}
        onChange={(e) => setSpecialEffect(e.target.value)}
        placeholder={t("sessionCard.equipment.specialEffect")}
        className={`${inputCls} w-full`}
      />
      {/* Stat-bonusar: rullista (attribut + färdigheter) + ±-stegare */}
      <BonusEditor
        bonuses={bonuses}
        onChange={setBonuses}
        addButtonClass="text-accent-gold hover:text-accent-gold/80"
      />
      <AutoTextarea
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t("common.description")}
        className={`${inputCls} w-full`}
      />
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={isPending || !name.trim()}
          className="rounded bg-accent-gold/20 px-3 py-1 text-xs text-accent-gold hover:bg-accent-gold/30 disabled:opacity-50"
        >
          {t("campaign.giveEquipment")}
        </button>
        <button
          onClick={() => { resetForm(); setOpen(false); }}
          className="rounded bg-bg-base px-3 py-1 text-xs text-text-faint hover:text-text-muted"
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
