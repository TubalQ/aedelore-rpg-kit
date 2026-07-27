"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateCampaign } from "@/hooks/useCampaigns";
import { useT } from "@/lib/i18n";
import { AutoTextarea } from "@/components/ui/auto-textarea";

export function CreateCampaignForm() {
  const { t } = useT();
  const router = useRouter();
  const createMutation = useCreateCampaign();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const result = await createMutation.mutateAsync({
      name: trimmed,
      description: description.trim(),
    });
    router.push(`/campaigns/${result.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="campaign-name" className="block text-sm font-medium text-text-muted mb-1">
          {t("campaign.campaignName")}
        </label>
        <input
          id="campaign-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
          className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-text-base placeholder:text-text-faint focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
          placeholder="T.ex. The Shattered Realms"
        />
      </div>

      <div>
        <label htmlFor="campaign-desc" className="block text-sm font-medium text-text-muted mb-1">
          {t("campaign.descriptionOptional")}
        </label>
        <AutoTextarea
          id="campaign-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={4}
          className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-text-base placeholder:text-text-faint focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
          placeholder={t("campaign.premisePlaceholder")}
        />
      </div>

      {createMutation.error && (
        <p className="text-sm text-red-400">{createMutation.error.message}</p>
      )}

      <button
        type="submit"
        disabled={!name.trim() || createMutation.isPending}
        className="w-full rounded-lg bg-accent-gold px-4 py-2 text-sm font-semibold text-bg-base transition-colors hover:bg-accent-gold/80 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {createMutation.isPending ? t("campaign.creating") : t("campaign.create")}
      </button>
    </form>
  );
}
