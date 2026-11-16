"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/api/error-message";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useJoinCampaign } from "@/hooks/useCampaigns";
import { useCharacters } from "@/hooks/useCharacters";
import { useT } from "@/lib/i18n";

export function JoinCampaignForm() {
  const { t } = useT();
  const router = useRouter();
  // The form shows the join error inline (e.g. a wrong code), no global toast.
  const joinMutation = useJoinCampaign({ handlesErrors: true });
  const { data: characters } = useCharacters();
  // An invite link (/campaigns/join?code=XXXX) pre-fills the code.
  const searchParams = useSearchParams();
  const [code, setCode] = useState(() => (searchParams.get("code") ?? "").toUpperCase().slice(0, 8));
  const [characterId, setCharacterId] = useState<string>("");

  // Only characters not already tied to a campaign can be brought along.
  const available = (characters ?? [])
    .filter((c) => c.campaignId == null)
    .map((c) => ({ id: c.id, name: c.name }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    joinMutation.mutate(
      { shareCode: trimmed, characterId: characterId ? Number(characterId) : undefined },
      { onSuccess: (result) => router.push(`/campaigns/${result.campaignId}`) },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="share-code" className="block text-sm font-medium text-text-muted mb-1">
          {t("campaign.shareCodeLabel")}
        </label>
        <input
          id="share-code"
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            // H4: the error was for the old code.
            if (joinMutation.error) joinMutation.reset();
          }}
          maxLength={8}
          required
          className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-center text-lg font-mono tracking-widest text-text-base placeholder:text-text-faint focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold uppercase"
          placeholder="ABCD1234"
        />
      </div>

      <div>
        <label htmlFor="join-character" className="block text-sm font-medium text-text-muted mb-1">
          {t("campaign.bringCharacter")}
        </label>
        {available.length > 0 ? (
          <select
            id="join-character"
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-text-base focus:border-accent-gold focus:outline-none"
          >
            <option value="">{t("campaign.noCharacterOption")}</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-text-faint">
            {t("campaign.noCharacterToBring")}{" "}
            <Link href="/characters/new?returnTo=/campaigns/join" className="text-accent-gold hover:underline pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center">
              {t("character.create")}
            </Link>
          </p>
        )}
      </div>

      {joinMutation.error && (
        <p role="alert" className="text-sm text-accent-red">{errorMessage(joinMutation.error)}</p>
      )}

      <button
        type="submit"
        disabled={!code.trim() || joinMutation.isPending}
        className="w-full rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-on-accent-purple transition-colors hover:bg-accent-purple/80 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {joinMutation.isPending ? t("campaign.joining") : t("campaign.join")}
      </button>
    </form>
  );
}
