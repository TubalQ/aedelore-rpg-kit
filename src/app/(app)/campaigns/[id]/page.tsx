"use client";

import { use, useState } from "react";
import { useCampaign } from "@/hooks/useCampaigns";
import { useT } from "@/lib/i18n";
import { CampaignDetail } from "@/components/campaign/campaign-detail";
import { PlayerCampaignView } from "@/components/campaign/player-campaign-view";
import { ApiError } from "@/lib/api/client";
import { Eye, ArrowLeft } from "lucide-react";

type Params = { params: Promise<{ id: string }> };

export default function CampaignPage({ params }: Params) {
  const { id } = use(params);
  const campaignId = Number(id);
  const { data: dmCampaign, isLoading, error } = useCampaign(campaignId);
  const [previewAsPlayer, setPreviewAsPlayer] = useState(false);
  const { t } = useT();

  if (isLoading) return <p className="text-text-muted">{t("campaign.loading")}</p>;

  if (dmCampaign) {
    if (previewAsPlayer) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-accent-purple/40 bg-accent-purple/10 px-4 py-2">
            <span className="flex items-center gap-2 text-sm text-accent-purple">
              <Eye size={14} />
              {t("campaign.previewingAsPlayer")}
            </span>
            <button
              onClick={() => setPreviewAsPlayer(false)}
              className="flex items-center gap-1 text-sm text-accent-gold hover:text-accent-gold/80"
            >
              <ArrowLeft size={14} />
              {t("campaign.backToDmView")}
            </button>
          </div>
          <PlayerCampaignView campaignId={campaignId} previewMode />
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => setPreviewAsPlayer(true)}
            className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs text-text-muted hover:text-accent-gold hover:border-accent-gold/40 transition-colors"
          >
            <Eye size={12} />
            {t("campaign.viewAsPlayer")}
          </button>
        </div>
        <CampaignDetail campaignId={campaignId} />
      </div>
    );
  }

  if (error && error instanceof ApiError && error.status === 404) {
    return <PlayerCampaignView campaignId={campaignId} />;
  }

  if (error) {
    return <p className="text-red-400">{t("campaign.loadError", { error: error.message })}</p>;
  }

  return <PlayerCampaignView campaignId={campaignId} />;
}
