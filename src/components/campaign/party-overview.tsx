"use client";

import { useCampaignCharacters } from "@/hooks/useCampaigns";
import type { CampaignCharacter } from "@/lib/db/queries/campaigns";
import { useT, tRace, tClass, tAttr, tSkill } from "@/lib/i18n";
import {
  ATTRIBUTE_NAMES,
  getModifier,
  getSkillsForAttribute,
} from "@/lib/domain/attributes";
import { computeBonusSources } from "@/lib/domain/bonus-calc";

interface PartyOverviewProps {
  campaignId: number;
}

export function PartyOverview({ campaignId }: PartyOverviewProps) {
  const { data: characters, isLoading, error } = useCampaignCharacters(campaignId);
  const { t } = useT();

  if (isLoading) return <p className="text-sm text-text-muted">{t("campaign.loadingParty")}</p>;
  if (error && !characters) return <p className="text-sm text-accent-red">{t("campaign.loadPartyError", { error: error.message })}</p>;
  if (!characters || characters.length === 0) {
    return <p className="text-sm text-text-faint">{t("campaign.noCharactersInCampaign")}</p>;
  }

  return (
    <>
    {/* Phones: one card per character (M5); the wide table hid columns. */}
    <ul className="space-y-2 sm:hidden">
      {characters.map((char) => (
        <PartyCard key={char.id} char={char} />
      ))}
    </ul>
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2 pr-3 text-text-muted font-semibold">{t("campaign.character")}</th>
            <th className="py-2 px-2 text-text-muted font-semibold">HP</th>
            {ATTRIBUTE_NAMES.map((attr) => (
              <th key={attr} className="py-2 px-1 text-text-faint font-medium text-center" title={attr}>
                {attrShort(attr)}
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
    </>
  );
}

const attrShort = (attr: string): string => (attr === "Force of Will" ? "FoW" : attr === "Third Eye" ? "3rd" : attr.slice(0, 3));

function PartyCard({ char }: { char: CampaignCharacter }) {
  const { t, locale } = useT();
  const { data } = char;
  const hpPercent = data.maxHp > 0 ? Math.round((data.hp / data.maxHp) * 100) : 0;
  const hpColor = hpPercent > 50 ? "bg-accent-green" : hpPercent > 25 ? "bg-accent-gold" : "bg-accent-red";
  const subtitle = [data.race && tRace(data.race, locale), data.class && tClass(data.class, locale)].filter(Boolean).join(" / ");
  return (
    <li className="rounded-lg border border-border/60 bg-bg-base/40 p-3 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-text-base [overflow-wrap:anywhere]">{char.name}</div>
          <div className="text-[11px] text-text-faint">{subtitle || t("campaign.notSelected")}</div>
        </div>
        <span className="shrink-0 font-mono text-accent-gold">{char.xp} XP</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-text-faint">HP</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-base">
          <div className={`h-full ${hpColor} rounded-full`} style={{ width: `${hpPercent}%` }} />
        </div>
        <span className="font-mono text-text-base">{data.hp}/{data.maxHp}</span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-1 text-center">
        {ATTRIBUTE_NAMES.map((attrName) => {
          const total = computeBonusSources(attrName, (data.attributes as Record<string, number>)[attrName] ?? 0, data).total;
          return (
            <div key={attrName} className="rounded bg-bg-base px-1 py-1" title={tAttr(attrName, locale)}>
              <dt className="text-[10px] text-text-faint">{attrShort(attrName)}</dt>
              <dd className="font-mono text-text-base">{total}</dd>
            </div>
          );
        })}
      </dl>
    </li>
  );
}

function PartyRow({ char }: { char: CampaignCharacter }) {
  const { t, locale } = useT();
  const { data } = char;
  const hp = data.hp;
  const maxHp = data.maxHp;
  const hpPercent = maxHp > 0 ? Math.round((hp / maxHp) * 100) : 0;
  const hpColor = hpPercent > 50 ? "bg-accent-green" : hpPercent > 25 ? "bg-accent-gold" : "bg-accent-red";
  const subtitle = [data.race && tRace(data.race, locale), data.class && tClass(data.class, locale)].filter(Boolean).join(" / ");

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
              {tSkill(name, locale)} {total}
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
