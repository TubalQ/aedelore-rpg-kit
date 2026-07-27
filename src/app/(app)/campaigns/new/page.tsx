import { CreateCampaignForm } from "@/components/campaign/create-campaign-form";

export default function NewCampaignPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-text-base">Ny kampanj</h1>
      <CreateCampaignForm />
    </div>
  );
}
