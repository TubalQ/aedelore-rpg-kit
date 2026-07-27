"use client";

import Link from "next/link";
import { useT, tRace, tClass } from "@/lib/i18n";
import { Avatar } from "./avatar";

interface CharacterCardProps {
  id: number;
  name: string;
  race: string | null;
  characterClass: string | null;
  avatarSeed: string;
  avatarImage?: string;
  xp: number;
  updatedAt: string;
  campaignName: string | null;
  onDelete: (id: number) => void;
}

export function CharacterCard({ id, name, race, characterClass, avatarSeed, avatarImage, xp, updatedAt, campaignName, onDelete }: CharacterCardProps) {
  const { t, locale } = useT();
  const subtitle = [race ? tRace(race, locale) : null, characterClass ? tClass(characterClass, locale) : null].filter(Boolean).join(" · ") || t("character.new");
  const updated = new Date(updatedAt).toLocaleDateString(locale === "en" ? "en-GB" : "sv-SE");

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface p-4 transition-colors hover:border-accent-purple hover:bg-bg-surface/80">
      <Link href={`/characters/${id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <Avatar seed={avatarSeed || name} imageUrl={avatarImage} size={40} className="shrink-0" />
          <div className="flex-1 min-w-0 flex items-center justify-between">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-text-base">{name}</h3>
              <p className="text-sm text-text-muted">{subtitle}</p>
              {/* Kampanjmärke - syntes tidigare först i join-flödets dropdown */}
              {campaignName ? (
                <span className="mt-1 inline-block max-w-full truncate rounded bg-accent-purple/20 px-1.5 py-0.5 text-[10px] text-accent-purple">
                  {campaignName}
                </span>
              ) : (
                <span className="mt-1 inline-block rounded bg-bg-base px-1.5 py-0.5 text-[10px] text-text-faint">
                  {t("character.noCampaign")}
                </span>
              )}
            </div>
            <div className="text-right text-xs text-text-faint">
              <p>{xp} XP</p>
              <p>{updated}</p>
            </div>
          </div>
        </div>
      </Link>
      <button
        onClick={() => {
          if (window.confirm(t("character.deleteConfirm", { name }))) {
            onDelete(id);
          }
        }}
        className="shrink-0 rounded p-1.5 text-text-faint hover:text-red-400 hover:bg-red-950/20 transition-colors"
        title={t("character.deleteTitle")}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
      </button>
    </div>
  );
}
