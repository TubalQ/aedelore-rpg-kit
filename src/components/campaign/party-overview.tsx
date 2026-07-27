"use client";

import { useCampaignCharacters } from "@/hooks/useCampaigns";
import type { CampaignCharacter } from "@/lib/db/queries/campaigns";
import { useT } from "@/lib/i18n";
import {
  ATTRIBUTE_NAMES,
  getModifier,
  getSkillsForAttribute,
} from "@/lib/domain/attributes";
import type { Attribute } from "@/lib/domain/attributes";
import { computeBonusSources } from "@/lib/domain/bonus-calc";

interface PartyOverviewProps {
  campaignId: number;
}

export function PartyOverview({ campaignId }: PartyOverviewProps) {
  const { data: characters, isLoading, error } = useCampaignCharacters(campaignId);
  const { t } = useT();

  if (isLoading) return <p className="text-sm text-text-muted">{t("campaign.loadingParty")}</p>;
  if (error) return <p className="text-sm text-red-400">{t("campaign.loadPartyError", { error: error.message })}</p>;
  if (!characters || characters.length === 0) {
    return <p className="text-sm text-text-faint">{t("campaign.noCharactersInCampaign")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2 pr-3 text-text-muted font-semibold">{t("campaign.character")}</th>
            <th className="py-2 px-2 text-text-muted font-semibold">HP</th>
            {ATTRIBUTE_NAMES.map((attr) => (
              <th key={attr} className="py-2 px-1 text-text-faint font-medium text-center" title={attr}>
                {attr === "Force of Will" ? "FoW" : attr === "Third Eye" ? "3rd" : attr.slice(0, 3)}
              </th>
            ))}
            <th className="py-2 px-2 text-text-muted font-semibold text-right">XP</th>
            <th className="py-2 pl-2 text-text-muted font-semibold">{t("attributes.title")}</th>
          </tr>
        </thead>
        <tbody>
          {characters.map((char) => (
            <PartyRow key={char.id} char={char} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PartyRow({ char }: { char: CampaignCharacter }) {
  const { t } = useT();
  const { data } = char;
  const hp = data.hp;
  const maxHp = data.maxHp;
  const hpPercent = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;
  const hpColor = hpPercent > 50 ? "bg-green-500" : hpPercent > 25 ? "bg-yellow-500" : "bg-red-500";
  const subtitle = [data.race, data.class].filter(Boolean).join(" / ");

  const topSkills = getTopSkills(char, 3);

  return (
    <tr className="border-b border-border/30 hover:bg-bg-surface/50">
      <td className="py-2 pr-3">
        <div className="font-semibold text-text-base">{char.name}</div>
        <div className="text-[10px] text-text-faint">{subtitle || t("campaign.notSelected")}</div>
      </td>
      <td className="py-2 px-2">
        <div className="flex items-center gap-1">
          <div className="w-12 h-1.5 bg-bg-base rounded-full overflow-hidden">
            <div className={`h-full ${hpColor} rounded-full`} style={{ width: `${hpPercent}%` }} />
          </div>
          <span className="text-[10px] font-mono text-text-base">{hp}/{maxHp}</span>
        </div>
      </td>
      {ATTRIBUTE_NAMES.map((attrName) => {
        const distributed = (data.attributes as Record<string, number>)[attrName] ?? 0;
        const bonus = computeBonusSources(attrName, distributed, data);
        const mod = getModifier(bonus.total);
        return (
          <td key={attrName} className="py-2 px-1 text-center">
            <span className="font-mono text-text-base">{bonus.total}</span>
            <span className="text-[9px] text-text-faint ml-0.5">+{mod}</span>
          </td>
        );
      })}
      <td className="py-2 px-2 text-right">
        <span className="font-mono text-accent-gold">{char.xp}</span>
        {char.xpSpent > 0 && (
          <span className="text-[10px] text-text-faint ml-0.5">/{char.xpSpent}s</span>
        )}
      </td>
      <td className="py-2 pl-2">
        <div className="flex flex-wrap gap-1">
          {topSkills.map(({ name, total }) => (
            <span key={name} className="rounded bg-bg-base px-1 py-0.5 text-[10px] text-text-muted">
              {name} {total}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

function getTopSkills(char: CampaignCharacter, count: number): { name: string; total: number }[] {
  const results: { name: string; total: number }[] = [];
  for (const attrName of ATTRIBUTE_NAMES) {
    for (const skill of getSkillsForAttribute(attrName)) {
      const distributed = (char.data.skills as Record<string, number>)[skill] ?? 0;
      const bonus = computeBonusSources(skill, distributed, char.data);
      if (bonus.total > 0) {
        results.push({ name: skill, total: bonus.total });
      }
    }
  }
  results.sort((a, b) => b.total - a.total);
  return results.slice(0, count);
}
