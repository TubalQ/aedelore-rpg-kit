"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/api/error-message";
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
  const [nameError, setNameError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    // M4: say what is missing instead of a silently disabled button.
    if (!trimmed) {
      setNameError(t("campaign.enterName"));
      return;
    }
    createMutation.mutate(
      { name: trimmed, description: description.trim() },
      { onSuccess: (result) => router.push(`/campaigns/${result.id}`) },
    );
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
          onChange={(e) => {
            setName(e.target.value);
            setNameError("");
          }}
          maxLength={100}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "campaign-name-error" : undefined}
          className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-text-base placeholder:text-text-faint focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
          placeholder={t("campaign.nameExample")}
        />
        {nameError && <p id="campaign-name-error" className="mt-1 text-sm text-accent-red">{nameError}</p>}
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
        <p className="text-sm text-accent-red">{errorMessage(createMutation.error)}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-bg-surface transition-colors"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="flex-1 rounded-lg bg-accent-gold px-4 py-2 text-sm font-semibold text-bg-base transition-colors hover:bg-accent-gold/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createMutation.isPending ? t("campaign.creating") : t("campaign.create")}
        </button>
      </div>
    </form>
  );
}
