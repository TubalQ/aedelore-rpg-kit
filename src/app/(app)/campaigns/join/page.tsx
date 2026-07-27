import { JoinCampaignForm } from "@/components/campaign/join-campaign-form";

export default function JoinCampaignPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-text-base">Gå med i kampanj</h1>
      <p className="text-text-muted">Ange delningskoden du fått av din DM.</p>
      <JoinCampaignForm />
    </div>
  );
}
