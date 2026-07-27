"use client";

import { useState } from "react";
import type { CharacterData } from "@/lib/schemas/character";
import { getSpellsForClass } from "@/lib/domain/spells";
import type { CharacterClass } from "@/lib/domain/classes";
import { CLASSES } from "@/lib/domain/classes";
import { useT, tClass } from "@/lib/i18n";

interface SpellsProps {
  data: CharacterData;
  locked?: boolean;
  onChange: (partial: Partial<CharacterData>) => void;
}

export function SpellsSection({ data, locked, onChange }: SpellsProps) {
  const { t, locale } = useT();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);

  if (!data.class) {
    return (
      <section className="rounded-lg border border-border bg-bg-surface p-4">
        <h2 className="text-lg font-semibold text-text-base">{t("spells.abilities")}</h2>
        <p className="text-sm text-text-muted mt-2">{t("spells.selectClass")}</p>
      </section>
    );
  }

  const cls = data.class as CharacterClass;
  const classData = CLASSES[cls];
  const isArcana = classData.abilityType === "arcana";
  const label = isArcana ? t("spells.spells") : t("spells.abilities");
  const maxSlots = classData.spellSlots;
  const allSpells = getSpellsForClass(cls);

  const selectedNames = new Set(data.spells.filter((s) => s.selected).map((s) => s.name));
  const selectedCount = selectedNames.size;
  const atMax = selectedCount >= maxSlots;

  function selectSpell(spellName: string) {
    if (locked || atMax) return;
    if (selectedNames.has(spellName)) return;
    const existing = data.spells.find((s) => s.name === spellName);
    if (existing) {
      onChange({
        spells: data.spells.map((s) =>
          s.name === spellName ? { ...s, selected: true } : s,
        ),
      });
    } else {
      onChange({
        spells: [...data.spells, { name: spellName, selected: true }],
      });
    }
  }

  function deselectSpell(spellName: string) {
    if (locked) return;
    onChange({
      spells: data.spells.map((s) =>
        s.name === spellName ? { ...s, selected: false } : s,
      ),
    });
  }

  const selectedSpells = allSpells.filter((s) => selectedNames.has(s.name));

  return (
    <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-base">
          {label} ({selectedCount}/{maxSlots})
        </h2>
        {locked ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent-gold/10 text-accent-gold">{t("common.locked")}</span>
        ) : (
          <button
            onClick={() => setBrowserOpen(!browserOpen)}
            className="rounded bg-accent-gold/20 px-3 py-1 text-xs text-accent-gold hover:bg-accent-gold/30"
          >
            {browserOpen ? t("spells.close") : t("spells.browse")}
          </button>
        )}
      </div>

      {atMax && (
        <p className="text-xs text-accent-gold">{t("spells.allSlotsFilled")}</p>
      )}

      {/* Selected spells */}
      <div className="space-y-1">
        {selectedSpells.length === 0 && (
          <p className="text-xs text-text-faint">{t("spells.noneSelected", { label: label.toLowerCase() })}</p>
        )}
        {selectedSpells.map((spell) => {
          const isOpen = expanded === spell.name;
          return (
            <div key={spell.name} className="rounded border border-border/50 bg-bg-base">
              <div className="flex items-center justify-between px-3 py-2">
                <button
                  onClick={() => setExpanded(isOpen ? null : spell.name)}
                  className="flex-1 text-left text-sm hover:text-accent-gold"
                >
                  <span className="font-medium text-text-base">{spell.name}</span>
                </button>
                <div className="flex items-center gap-2 text-xs text-text-faint">
                  {spell.arcana !== null && <span className="text-purple-400">Arcana: {spell.arcana}</span>}
                  {spell.weakened !== null && <span className="text-orange-400">Weak: +{spell.weakened}</span>}
                  {spell.dc !== null && <span>DC {spell.dc}</span>}
                  {!locked && (
                    <button
                      onClick={() => deselectSpell(spell.name)}
                      className="text-red-400 hover:text-red-300 ml-1"
                    >
                      X
                    </button>
                  )}
                </div>
              </div>
              {isOpen && (
                <div className="px-3 pb-3 text-xs text-text-muted space-y-1">
                  <p>{spell.desc}</p>
                  {spell.check && <p className="text-text-faint">Check: {spell.check}</p>}
                  {spell.damage !== "0" && <p className="text-text-faint">Effect: {spell.damage}</p>}
                  {spell.gain !== null && <p className="text-text-faint">Gain: +{spell.gain}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Spell Browser */}
      {browserOpen && (
        <div className="rounded border border-accent-gold/30 bg-bg-base p-3 space-y-2">
          <h4 className="text-sm font-medium text-accent-gold">
            {tClass(cls, locale)} {label} ({allSpells.length} {t("spells.available")})
          </h4>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {allSpells.map((spell) => {
              const isSelected = selectedNames.has(spell.name);
              const canSelect = !isSelected && !atMax;
              return (
                <div
                  key={spell.name}
                  className={`rounded border p-2 ${
                    isSelected
                      ? "border-accent-gold/40 bg-accent-gold/5"
                      : "border-border/30 bg-bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="text-sm text-text-base">{spell.name}</span>
                      <div className="flex gap-2 text-[10px] text-text-faint mt-0.5">
                        {spell.arcana !== null && <span>Arcana: {spell.arcana}</span>}
                        {spell.weakened !== null && <span>Weak: +{spell.weakened}</span>}
                        {spell.dc !== null && <span>DC {spell.dc}</span>}
                      </div>
                    </div>
                    {isSelected ? (
                      <button
                        onClick={() => deselectSpell(spell.name)}
                        className="rounded px-2 py-1 text-xs shrink-0 bg-red-900/30 text-red-400 hover:bg-red-900/50"
                      >
                        {t("common.remove")}
                      </button>
                    ) : (
                      <button
                        onClick={() => selectSpell(spell.name)}
                        disabled={!canSelect}
                        className="rounded px-2 py-1 text-xs shrink-0 bg-green-900/30 text-green-400 hover:bg-green-900/50 disabled:opacity-30"
                      >
                        {t("common.select")}
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-text-faint mt-1 line-clamp-2">{spell.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
