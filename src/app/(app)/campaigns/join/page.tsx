import { JoinCampaignForm } from "@/components/campaign/join-campaign-form";
import { T } from "@/components/ui/t";

export default function JoinCampaignPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-text-base"><T k="campaign.join" /></h1>
      <p className="text-text-muted"><T k="campaign.joinHint" /></p>
      <JoinCampaignForm />
    </div>
  );
}
