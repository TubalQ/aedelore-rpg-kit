"use client";

import Link from "next/link";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useT } from "@/lib/i18n";
import { CampaignCard } from "./campaign-card";

export function CampaignList() {
  const { t } = useT();
  const { data: campaigns, isLoading, error } = useCampaigns();

  if (isLoading) {
    return <p className="text-text-muted">{t("campaign.loadingList")}</p>;
  }

  if (error) {
    return <p className="text-red-400">{t("campaign.loadListError", { error: error.message })}</p>;
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted mb-4">{t("campaign.noCampaigns")}</p>
        <Link
          href="/campaigns/new"
          className="inline-block rounded-lg bg-accent-gold px-6 py-3 text-sm font-semibold text-bg-base transition-colors hover:bg-accent-gold/80"
        >
          {t("campaign.createFirst")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {campaigns.map((campaign) => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
    </div>
  );
}
