import { CreateCampaignForm } from "@/components/campaign/create-campaign-form";
import { T } from "@/components/ui/t";

export default function NewCampaignPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-text-base"><T k="campaign.new" /></h1>
      <CreateCampaignForm />
    </div>
  );
}
