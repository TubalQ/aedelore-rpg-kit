"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import type { CampaignCharacter } from "@/lib/db/queries/campaigns";
import {
  ATTRIBUTE_NAMES,
  getModifier,
  getSkillsForAttribute,
} from "@/lib/domain/attributes";
import { computeBonusSources } from "@/lib/domain/bonus-calc";

interface DmBuildViewProps {
  char: CampaignCharacter;
  onAction: (action: Record<string, unknown>) => void;
  isPending: boolean;
}

export function DmBuildView({ char, onAction, isPending }: DmBuildViewProps) {
  const { data } = char;
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  // While editing: how much the DM raised (+) or lowered (-) each stat. Saved
  // as deltas (adjustStats): only the stats the DM changed are touched, values
  // bought with XP above the creation cap stay, and an XP purchase made while
  // the DM edits is kept (C1).
  const [attrDeltas, setAttrDeltas] = useState<Record<string, number>>({});
  const [skillDeltas, setSkillDeltas] = useState<Record<string, number>>({});

  const attrBase = (name: string): number => (data.attributes as Record<string, number>)[name] ?? 0;
  const skillBase = (name: string): number => (data.skills as Record<string, number>)[name] ?? 0;

  function startEditing() {
    setAttrDeltas({});
    setSkillDeltas({});
    setEditing(true);
  }

  function saveStats() {
    const changed = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).filter(([, d]) => d !== 0));
    const attributes = changed(attrDeltas);
    const skills = changed(skillDeltas);
    if (Object.keys(attributes).length > 0 || Object.keys(skills).length > 0) {
      onAction({ action: "adjustStats", characterId: char.id, attributes, skills });
    }
    setEditing(false);
  }

  /** One step for a stat: never below 0 (the shown value is the stored one plus the delta). */
  const step = (deltas: Record<string, number>, name: string, base: number, dir: 1 | -1): Record<string, number> => {
    const delta = deltas[name] ?? 0;
    if (dir === -1 && base + delta <= 0) return deltas;
    return { ...deltas, [name]: delta + dir };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-text-muted">{t("dmBuild.title")}</h4>
        {editing ? (
          <div className="flex gap-2">
            <button
              onClick={saveStats}
              disabled={isPending}
              className="rounded bg-accent-gold/20 px-2 py-0.5 text-xs text-accent-gold hover:bg-accent-gold/30 disabled:opacity-50"
            >
              {t("dmBuild.save")}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded bg-bg-base px-2 py-0.5 text-xs text-text-faint hover:text-text-base"
            >
              {t("dmBuild.cancel")}
            </button>
          </div>
        ) : (
          <button
            onClick={startEditing}
            className="rounded bg-bg-base px-2 py-0.5 text-xs text-text-faint hover:text-text-base"
          >
            {t("dmBuild.edit")}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {ATTRIBUTE_NAMES.map((attrName) => {
          const distributed = attrBase(attrName) + (editing ? attrDeltas[attrName] ?? 0 : 0);
          const bonus = computeBonusSources(attrName, distributed, data);
          const mod = getModifier(bonus.total);
          const skills = getSkillsForAttribute(attrName);

          return (
            <div key={attrName} className="rounded border border-border bg-bg-base p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-base">{attrName}</span>
                <div className="flex items-center gap-1.5">
                  {editing ? (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => setAttrDeltas((prev) => step(prev, attrName, attrBase(attrName), -1))}
                        disabled={distributed <= 0}
                        aria-label={`${t("common.decrease")} ${attrName}`}
                        className="w-7 h-7 pointer-coarse:w-10 pointer-coarse:h-10 pointer-coarse:text-sm rounded bg-bg-surface text-[10px] text-text-faint hover:text-text-base flex items-center justify-center disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="text-xs font-mono text-accent-gold w-4 text-center">{distributed}</span>
                      <button
                        onClick={() => setAttrDeltas((prev) => step(prev, attrName, attrBase(attrName), 1))}
                        aria-label={`${t("common.increase")} ${attrName}`}
                        className="w-7 h-7 pointer-coarse:w-10 pointer-coarse:h-10 pointer-coarse:text-sm rounded bg-bg-surface text-[10px] text-text-faint hover:text-text-base flex items-center justify-center disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-accent-gold">{bonus.total}</span>
                  )}
                  <span className="text-[10px] text-text-faint">(+{mod})</span>
                </div>
              </div>
              {!editing && (bonus.race !== 0 || bonus.class !== 0 || bonus.religion !== 0 || bonus.equipmentItems.length > 0) && (
                <BonusBadges bonus={bonus} />
              )}
              {skills.length > 0 && (
                <div className="space-y-0.5 mt-1">
                  {skills.map((skill) => {
                    const skillDist = skillBase(skill) + (editing ? skillDeltas[skill] ?? 0 : 0);
                    const skillBonus = computeBonusSources(skill, skillDist, data);
                    return (
                      <div key={skill} className="flex items-center justify-between">
                        <span className="text-[10px] text-text-muted">
                          {skill}
                          {/* Utrustningsbonus per föremål på skill-nivå */}
                          {skillBonus.equipmentItems.map((it, j) => (
                            <span key={j} className={`ml-1 text-[9px] ${it.value > 0 ? "text-accent-green" : "text-accent-red"}`}>
                              {it.kind === "weapon" ? "⚔" : "🛡"} {it.value > 0 ? "+" : ""}{it.value}
                            </span>
                          ))}
                        </span>
                        {editing ? (
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => setSkillDeltas((prev) => step(prev, skill, skillBase(skill), -1))}
                              disabled={skillDist <= 0}
                              aria-label={`${t("common.decrease")} ${skill}`}
                              className="w-6 h-6 pointer-coarse:w-9 pointer-coarse:h-9 pointer-coarse:text-xs rounded bg-bg-surface text-[9px] text-text-faint hover:text-text-base flex items-center justify-center disabled:opacity-30"
                            >
                              −
                            </button>
                            <span className="text-[10px] font-mono text-text-base w-3 text-center">{skillDist}</span>
                            <button
                              onClick={() => setSkillDeltas((prev) => step(prev, skill, skillBase(skill), 1))}
                              aria-label={`${t("common.increase")} ${skill}`}
                              className="w-6 h-6 pointer-coarse:w-9 pointer-coarse:h-9 pointer-coarse:text-xs rounded bg-bg-surface text-[9px] text-text-faint hover:text-text-base flex items-center justify-center disabled:opacity-30"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span className={`text-[10px] font-mono ${skillBonus.total > 0 ? "text-text-base" : "text-text-faint"}`}>
                            {skillBonus.total}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Equipment summary */}
      {data.dmEquipment.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-text-faint font-semibold">{t("dmBuild.dmEquipment")}</span>
          <div className="flex flex-wrap gap-1">
            {data.dmEquipment.map((eq, i) => {
              const hasHp = eq.maxHp !== undefined && eq.maxHp > 0;
              const eqHp = eq.hp ?? 0;
              const eqMaxHp = eq.maxHp ?? 0;
              return (
                <div key={i} className="flex items-center gap-1 rounded bg-bg-base border border-border/50 px-1.5 py-0.5">
                  <span className="text-[10px] text-text-muted">{eq.name}</span>
                  {hasHp && (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => onAction({ action: "updateEquipmentHp", characterId: char.id, equipmentIndex: i, stashId: eq.stashId, name: eq.name, hp: Math.max(0, eqHp - 1) })}
                        disabled={isPending || eqHp <= 0}
                        aria-label={`${t("common.decrease")} HP ${eq.name}`}
                        className="w-5 h-5 pointer-coarse:w-9 pointer-coarse:h-9 pointer-coarse:text-xs rounded bg-bg-surface text-[9px] text-accent-red hover:bg-accent-red/10 flex items-center justify-center disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className={`text-[10px] font-mono ${eqHp <= 0 ? "text-accent-red" : "text-text-base"}`}>
                        {eqHp}/{eqMaxHp}
                      </span>
                      <button
                        onClick={() => onAction({ action: "updateEquipmentHp", characterId: char.id, equipmentIndex: i, stashId: eq.stashId, name: eq.name, hp: Math.min(eqMaxHp, eqHp + 1) })}
                        disabled={isPending || eqHp >= eqMaxHp}
                        aria-label={`${t("common.increase")} HP ${eq.name}`}
                        className="w-5 h-5 pointer-coarse:w-9 pointer-coarse:h-9 pointer-coarse:text-xs rounded bg-bg-surface text-[9px] text-accent-green hover:bg-accent-green/10 flex items-center justify-center disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.equippedWeapons.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-text-faint font-semibold">{t("dmBuild.equippedWeapons")}</span>
          <div className="flex flex-wrap gap-1">
            {data.equippedWeapons.map((w, i) => (
              <span key={i} className="rounded bg-bg-base border border-border/50 px-1.5 py-0.5 text-[10px] text-text-muted">
                {w.name} ({w.damage}, {/^[+-]/.test(String(w.bonus)) ? w.bonus : `+${w.bonus}`})
              </span>
            ))}
          </div>
        </div>
      )}

      {data.spells.filter((s) => s.selected).length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-text-faint font-semibold">{t("dmBuild.spells")}</span>
          <div className="flex flex-wrap gap-1">
            {data.spells.filter((s) => s.selected).map((s, i) => (
              <span key={i} className="rounded bg-bg-base border border-border/50 px-1.5 py-0.5 text-[10px] text-text-muted">
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BonusBadges({ bonus }: { bonus: { race: number; class: number; religion: number; equipmentItems: { name: string; kind: string; value: number }[] } }) {
  const { t } = useT();
  return (
    <div className="flex gap-1 flex-wrap">
      {bonus.race !== 0 && (
        <span className="text-[9px] text-accent-green">{t("dmBuild.bonusRace")} {bonus.race > 0 ? "+" : ""}{bonus.race}</span>
      )}
      {bonus.class !== 0 && (
        <span className="text-[9px] text-accent-blue">{t("dmBuild.bonusClass")} {bonus.class > 0 ? "+" : ""}{bonus.class}</span>
      )}
      {bonus.religion !== 0 && (
        <span className="text-[9px] text-accent-purple">{t("dmBuild.bonusReligion")} {bonus.religion > 0 ? "+" : ""}{bonus.religion}</span>
      )}
      {/* Utrustade föremål - visades inte alls förr trots att totalen räknade dem */}
      {bonus.equipmentItems.map((it, i) => (
        <span key={i} className={`text-[9px] ${it.value > 0 ? "text-accent-green" : "text-accent-red"}`}>
          {it.kind === "weapon" ? "⚔" : "🛡"} {it.name} {it.value > 0 ? "+" : ""}{it.value}
        </span>
      ))}
    </div>
  );
}
