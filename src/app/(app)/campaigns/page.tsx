"use client";

import Link from "next/link";
import { CampaignList } from "@/components/campaign/campaign-list";
import { useT } from "@/lib/i18n";

export default function CampaignsPage() {
  const { t } = useT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-base">{t("dashboard.campaigns.title")}</h1>
        <div className="flex gap-2">
          <Link
            href="/campaigns/join"
            className="rounded-lg border border-accent-purple px-4 py-2 text-sm font-semibold text-accent-purple transition-colors hover:bg-accent-purple/10"
          >
            {t("campaign.join")}
          </Link>
          <Link
            href="/campaigns/new"
            className="rounded-lg bg-accent-gold px-4 py-2 text-sm font-semibold text-bg-base transition-colors hover:bg-accent-gold/80"
          >
            {t("campaign.new")}
          </Link>
        </div>
      </div>
      <CampaignList />
    </div>
  );
}
