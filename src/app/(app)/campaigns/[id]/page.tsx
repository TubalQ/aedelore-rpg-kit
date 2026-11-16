"use client";

import { use, useState } from "react";
import { useCampaign, useCampaigns } from "@/hooks/useCampaigns";
import { useCampaignLive } from "@/hooks/useCampaignLive";
import { useT } from "@/lib/i18n";
import { CampaignDetail } from "@/components/campaign/campaign-detail";
import { PlayerCampaignView } from "@/components/campaign/player-campaign-view";
import { ApiError } from "@/lib/api/client";
import { Eye, ArrowLeft } from "lucide-react";

type Params = { params: Promise<{ id: string }> };

export default function CampaignPage({ params }: Params) {
  const { id } = use(params);
  const campaignId = Number(id);
  // The user's campaign list says whether they are the DM or a player here. A
  // player's page went to the DM endpoint first and got a 404 in the console on
  // every load; now it asks the DM endpoint only when the list says DM. A
  // campaign missing from the list (just left, or not yours) goes to the player
  // view, which says it is not found; asking the DM endpoint gave a 404 after Leave.
  const { data: myCampaigns, isLoading: listLoading } = useCampaigns();
  const role = myCampaigns?.find((c) => c.id === campaignId)?.role;
  // Live updates while the page is open (#82), for the DM and the players.
  useCampaignLive(role ? campaignId : 0);
  const { data: dmCampaign, isLoading: dmLoading, error } = useCampaign(role === "dm" ? campaignId : 0);
  const isLoading = listLoading || dmLoading;
  const [previewAsPlayer, setPreviewAsPlayer] = useState(false);
  const { t } = useT();

  if (isLoading) return <p className="text-text-muted">{t("campaign.loading")}</p>;

  if (role === "player") return <PlayerCampaignView campaignId={campaignId} />;

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
    return <p className="text-accent-red">{t("campaign.loadError", { error: error.message })}</p>;
  }

  return <PlayerCampaignView campaignId={campaignId} />;
}
