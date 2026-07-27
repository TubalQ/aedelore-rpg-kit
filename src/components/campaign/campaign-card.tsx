"use client";

import { useRouter } from "next/navigation";
import { ScrollText, Users, Share2, Plus, ArrowRight } from "lucide-react";
import type { CampaignWithCounts } from "@/lib/schemas/campaign";
import { useT } from "@/lib/i18n";

interface CampaignCardProps {
  campaign: CampaignWithCounts;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const { t } = useT();
  const router = useRouter();
  const updated = new Date(campaign.updatedAt).toLocaleDateString("sv-SE");
  const isDm = campaign.role === "dm";

  function handleCardClick() {
    router.push(`/campaigns/${campaign.id}`);
  }

  return (
    <div
      onClick={handleCardClick}
      className="group cursor-pointer rounded-lg border border-border bg-bg-surface p-4 transition-colors hover:border-accent-gold hover:bg-bg-surface/80"
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-text-base">{campaign.name}</h3>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              isDm
                ? "bg-accent-gold/20 text-accent-gold"
                : "bg-accent-purple/20 text-accent-purple"
            }`}>
              {isDm ? t("campaign.dm") : t("campaign.player")}
            </span>
            {isDm && campaign.shareCode && (
              <span className="flex shrink-0 items-center gap-1 rounded bg-green-900/30 px-1.5 py-0.5 text-[10px] text-green-400">
                <Share2 size={9} />
                {t("campaign.shareActive")}
              </span>
            )}
          </div>
          {campaign.description && (
            <p className="mt-1 text-sm text-text-muted line-clamp-1">{campaign.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-text-faint">
            <span className="flex items-center gap-1">
              <ScrollText size={12} />
              {campaign.sessionCount} {t("campaign.sessions")}
            </span>
            <span className="flex items-center gap-1">
              <Users size={12} />
              {campaign.playerCount} {t("campaign.players")}
            </span>
            <span>{updated}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {isDm ? (
            <>
              {campaign.lastActiveSessionId && (
                <button
                  onClick={() => router.push(`/sessions/${campaign.lastActiveSessionId}`)}
                  className="flex items-center gap-1 rounded-lg border border-accent-gold/30 px-3 py-1.5 text-sm font-medium text-accent-gold transition-colors hover:bg-accent-gold/10"
                >
                  {t("campaign.continue")}
                  <ArrowRight size={14} />
                </button>
              )}
              <button
                onClick={() => router.push(`/campaigns/${campaign.id}?tab=sessions&new=1`)}
                className="flex items-center gap-1 rounded-lg bg-accent-gold px-3 py-1.5 text-sm font-semibold text-bg-base transition-colors hover:bg-accent-gold/80"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">{t("campaign.newSessionShort")}</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push(`/campaigns/${campaign.id}`)}
              className="flex items-center gap-1 rounded-lg border border-accent-purple/30 px-3 py-1.5 text-sm font-medium text-accent-purple transition-colors hover:bg-accent-purple/10"
            >
              {t("campaign.viewCampaign")}
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
