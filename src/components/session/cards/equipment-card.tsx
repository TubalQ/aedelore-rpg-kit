"use client";

import { useState } from "react";
import type { SessionEquipment } from "@/lib/schemas/session";
import { ContentMeta } from "./content-meta";
import { VisibilityToggle } from "./visibility-toggle";
import { X } from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n";
import { BODY_PARTS, isBodyPart } from "@/lib/domain/armor";
import { GiveToButton, type GiveHandlers } from "../play/give-to";
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
import {
  EQUIPMENT_TYPES,
  EQUIPMENT_TYPE_LABEL_KEYS,
  RARITIES,
  RARITY_LABEL_KEYS,
  type Rarity,
} from "@/lib/domain/equipment-labels";

const RARITY_STYLES: Record<string, string> = {
  common: "border-border/50 text-text-base",
  enchanted: "border-accent-blue/35 text-accent-blue",
  rare: "border-accent-purple/35 text-accent-purple",
  legendary: "border-accent-gold/50 text-accent-gold",
};

interface EquipmentCardProps {
  equipment: SessionEquipment;
  mode: "prep" | "play";
  disabled: boolean;
  onUpdate: (patch: Partial<SessionEquipment>) => void;
  onRemove: () => void;
  placeNames: string[];
  onAssignToPlace: (place: string) => void;
  onChangeDay: (day: number | null) => void;
  onChangeTime: (time: string | null) => void;
  /** Play mode: handing it to characters and taking it back. */
  give?: GiveHandlers;
}

export function EquipmentCard({
  equipment, mode, disabled, onUpdate, onRemove,
  placeNames, onAssignToPlace, onChangeDay, onChangeTime,
  give,
}: EquipmentCardProps) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(mode === "prep");
  const rarityStyle = RARITY_STYLES[equipment.rarity] ?? RARITY_STYLES.common;

  return (
    <div className={`rounded border ${rarityStyle} bg-accent-green/5 p-2 space-y-1`}>
      <div className="flex items-center gap-2">
        <button onClick={() => setExpanded(!expanded)} className="p-2 -m-2 text-xs text-accent-green shrink-0">
          {expanded ? "▼" : "▶"}
        </button>
        <span className="text-xs text-accent-green shrink-0">{t("sessionCard.badge.equipment")}</span>
        <input
          type="text"
          value={equipment.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          disabled={disabled}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-text-base border-b border-transparent focus:border-accent-green focus:outline-none disabled:opacity-50"
          placeholder={t("sessionCard.equipment.namePlaceholder")} aria-label={t("sessionCard.equipment.namePlaceholder")}
        />
        <select
          value={equipment.type}
          onChange={(e) => onUpdate({ type: e.target.value as SessionEquipment["type"] })}
          disabled={disabled}
          className="rounded border border-border bg-bg-base px-1.5 py-0.5 text-[10px] text-text-muted disabled:opacity-50 shrink-0"
        >
          {EQUIPMENT_TYPES.map((val) => (
            <option key={val} value={val}>{t(EQUIPMENT_TYPE_LABEL_KEYS[val])}</option>
          ))}
        </select>
        {mode === "play" && equipment.givenTo.length > 0 && (
          <span className="text-[10px] text-accent-green shrink-0">
            → {equipment.givenTo.join(", ")}
          </span>
        )}
        <VisibilityToggle visibleTo={equipment.visibleTo} disabled={disabled} onChange={(v) => onUpdate({ visibleTo: v })} />
        {!disabled && mode === "prep" && (
          <button onClick={onRemove} aria-label={t("common.remove")} className="p-2 -m-2 text-accent-red hover:text-accent-red shrink-0"><X size={14} /></button>
        )}
      </div>
      {expanded && (
        <div className="ml-5 space-y-1.5">
          <AutoTextarea
            value={equipment.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            disabled={disabled}
            rows={2}
            className="w-full rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base disabled:opacity-50 focus:outline-none"
            placeholder={t("common.description")} aria-label={t("common.description")}
          />
          {mode === "prep" && (
            <AutoTextarea
              value={equipment.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              disabled={disabled}
              rows={1}
              className="w-full rounded border border-accent-gold/20 bg-bg-base px-2 py-1 text-xs text-accent-gold/80 disabled:opacity-50 focus:border-accent-gold focus:outline-none"
              placeholder={t("sessionCard.notesLabel")} aria-label={t("sessionCard.notesLabel")}
            />
          )}

          <div className="flex flex-wrap gap-1.5">
            <select
              value={equipment.rarity}
              onChange={(e) => onUpdate({ rarity: e.target.value as Rarity })}
              disabled={disabled}
              className="rounded border border-border bg-bg-base px-1.5 py-0.5 text-[10px] text-text-muted disabled:opacity-50"
            >
              {RARITIES.map((r) => (
                <option key={r} value={r}>{t(RARITY_LABEL_KEYS[r])}</option>
              ))}
            </select>
          </div>

          {(equipment.type === "weapon" || equipment.type === "misc") && (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <LabeledField label={t("sessionCard.equipment.baseWeapon")}>
                <BaseWeaponSelect
                  value={equipment.baseWeapon}
                  disabled={disabled}
                  onChange={(v) => onUpdate({ baseWeapon: v })}
                  onPick={(w) => onUpdate({
                    baseWeapon: w.name,
                    damage: w.damage,
                    atkBonus: w.bonus,
                    range: w.range,
                    breakVal: String(w.break),
                    ...(equipment.name ? {} : { name: w.name }),
                  })}
                  className="w-full"
                />
              </LabeledField>
              <LabeledField label={t("sessionCard.equipment.atk")}>
                <AtkSelect value={equipment.atkBonus} disabled={disabled} onChange={(v) => onUpdate({ atkBonus: v })} className="w-full" />
              </LabeledField>
              <LabeledField label={t("sessionCard.equipment.damage")}>
                <DiceSelect value={equipment.damage} disabled={disabled} onChange={(v) => onUpdate({ damage: v })} className="w-full" />
              </LabeledField>
              <LabeledInput label={t("sessionCard.equipment.range")} value={equipment.range} onChange={(v) => onUpdate({ range: v })} disabled={disabled} />
              <LabeledInput label={t("sessionCard.equipment.break")} value={equipment.breakVal} onChange={(v) => onUpdate({ breakVal: v })} disabled={disabled} />
            </div>
          )}
          {(equipment.type === "weapon" || equipment.type === "misc") && (
            <AdvantageEditor value={equipment.advantage} disabled={disabled} onChange={(v) => onUpdate({ advantage: v })} />
          )}

          {(equipment.type === "armor" || equipment.type === "shield") && (
            <>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <LabeledField label={t("sessionCard.equipment.baseArmor")}>
                  {equipment.type === "armor" ? (
                    <BaseArmorSelect
                      value={equipment.baseArmor}
                      disabled={disabled}
                      onChange={(v) => onUpdate({ baseArmor: v })}
                      onPick={(a) => onUpdate({
                        baseArmor: a.name,
                        bodypart: a.bodypart,
                        ac: a.ac,
                        hp: a.hp,
                        maxHp: a.hp,
                        disadvantage: a.disadvantage ?? "",
                        ...(equipment.name ? {} : { name: a.name }),
                      })}
                      className="w-full"
                    />
                  ) : (
                    <ShieldSelect
                      value={equipment.baseArmor}
                      disabled={disabled}
                      onChange={(v) => onUpdate({ baseArmor: v })}
                      onPick={(s) => onUpdate({
                        baseArmor: s.name,
                        ac: s.ac,
                        hp: s.hp,
                        maxHp: s.hp,
                        damage: s.damage,
                        disadvantage: s.disadvantage ?? "",
                        ...(equipment.name ? {} : { name: s.name }),
                      })}
                      className="w-full"
                    />
                  )}
                </LabeledField>
                {/* Y16: was a free-text field labelled "Chest". The same body parts as
                    the give form, so equipping it lands on a real slot. */}
                <LabeledField label={t("equipment.bodypart")}>
                  <select
                    value={equipment.bodypart}
                    onChange={(e) => onUpdate({ bodypart: e.target.value })}
                    disabled={disabled}
                    className="w-full rounded border border-border bg-bg-base px-1.5 py-0.5 text-[10px] text-text-base disabled:opacity-50 focus:outline-none"
                  >
                    {!isBodyPart(equipment.bodypart) && <option value={equipment.bodypart}>{equipment.bodypart || "-"}</option>}
                    {BODY_PARTS.map((bp) => (
                      <option key={bp} value={bp}>{t(`equipment.body.${bp}` as TranslationKey)}</option>
                    ))}
                  </select>
                </LabeledField>
                {/* The card is the item as made, so its HP is also the most it can have
                    (maxHp stayed 0, and the holder saw "HP: 5/0"). */}
                <LabeledInput label="HP" value={String(equipment.hp)} onChange={(v) => onUpdate({ hp: Number(v) || 0, maxHp: Number(v) || 0 })} disabled={disabled} />
                <LabeledInput label="AC" value={String(equipment.ac)} onChange={(v) => onUpdate({ ac: Number(v) || 0 })} disabled={disabled} />
              </div>
              <DisadvantageEditor value={equipment.disadvantage} disabled={disabled} onChange={(v) => onUpdate({ disadvantage: v })} />
            </>
          )}

          {/* Specialeffekter är ofta längre beskrivande text - autosize-textarea, inte enradig input */}
          <div>
            <label className="text-[10px] text-text-faint">{t("sessionCard.equipment.specialEffect")}</label>
            <AutoTextarea
              value={equipment.specialEffect}
              onChange={(e) => onUpdate({ specialEffect: e.target.value })}
              disabled={disabled}
              rows={1}
              className="w-full rounded border border-border bg-bg-base px-1.5 py-0.5 text-[10px] text-text-base disabled:opacity-50 focus:outline-none"
            />
          </div>

          {/* Stat-bonusar: rullista (attribut + färdigheter) + ±-stegare */}
          <BonusEditor
            bonuses={equipment.bonuses}
            disabled={disabled}
            onChange={(bonuses) => onUpdate({ bonuses })}
            addButtonClass="text-accent-green hover:text-accent-green"
          />

          {mode === "play" && give && (
            <GiveToButton what={equipment.name} holders={equipment.givenTo} disabled={disabled || !equipment.name} {...give} />
          )}

          {mode === "prep" && (
            <ContentMeta
              day={equipment.day}
              time={equipment.time}
              disabled={disabled}
              placeNames={placeNames}
              currentPlace={equipment.plannedLocation}
              onChangeDay={onChangeDay}
              onChangeTime={onChangeTime}
              onAssignToPlace={onAssignToPlace}
            />
          )}
        </div>
      )}
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="text-[10px] text-text-faint">{label}</label>
      {children}
    </div>
  );
}

function LabeledInput({ label, value, onChange, disabled }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] text-text-faint">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded border border-border bg-bg-base px-1.5 py-0.5 text-[10px] text-text-base disabled:opacity-50 focus:outline-none"
      />
    </div>
  );
}
