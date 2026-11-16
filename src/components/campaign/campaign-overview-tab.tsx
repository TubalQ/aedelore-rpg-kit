"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import {
  useGenerateShareCode,
  useRevokeShareCode,
  useCampaignPlayers,
  useRemovePlayer,
  useExcludedPlayers,
  useLiftExclusion,
} from "@/hooks/useCampaigns";
import { useT, tRace, tClass } from "@/lib/i18n";
import type { CampaignRow } from "@/lib/schemas/campaign";

interface CampaignOverviewTabProps {
  campaign: CampaignRow;
  onStartEditing: () => void;
}

export function CampaignOverviewTab({ campaign, onStartEditing }: CampaignOverviewTabProps) {
  const { t, locale } = useT();
  const { data: players } = useCampaignPlayers(campaign.id);
  const shareMutation = useGenerateShareCode(campaign.id);
  const revokeMutation = useRevokeShareCode(campaign.id);
  const removePlayerMutation = useRemovePlayer(campaign.id);
  const { data: excluded } = useExcludedPlayers(campaign.id);
  const liftMutation = useLiftExclusion(campaign.id);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const copyText = useCallback(async (which: "link" | "code") => {
    if (!campaign.shareCode) return;
    // The invite link pre-fills the code on the join page; the bare code is for
    // reading out at the table.
    const text = which === "link" ? `${window.location.origin}/campaigns/join?code=${campaign.shareCode}` : campaign.shareCode;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard can be blocked (permissions, insecure context): show the text instead.
      window.prompt(t("campaign.copyInvitePrompt"), text);
    }
  }, [campaign.shareCode]);

  function handleRevokeShare() {
    if (!confirm(t("campaign.revokeShareCodeConfirm"))) return;
    revokeMutation.mutate();
  }

  function handleLiftExclusion(playerId: string) {
    if (!confirm(t("campaign.liftExclusionConfirm"))) return;
    liftMutation.mutate(playerId);
  }

  function handleRemovePlayer(playerId: string) {
    if (!confirm(t("campaign.removePlayerConfirm"))) return;
    removePlayerMutation.mutate(playerId);
  }

  return (
    <div className="space-y-6">
      {/* Description */}
      <section className="rounded-lg border border-border bg-bg-surface p-4">
        {campaign.description ? (
          <p className="text-text-muted">{campaign.description}</p>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-text-faint">{t("campaign.noDescription")}</p>
            <button
              onClick={onStartEditing}
              className="mt-2 text-sm text-accent-gold hover:text-accent-gold/80 pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
            >
              {t("campaign.addDescription")}
            </button>
          </div>
        )}
      </section>

      {/* Share Code */}
      <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
        <h2 className="text-lg font-semibold text-text-base">{t("campaign.shareCodeLabel")}</h2>
        {campaign.shareCode ? (
          <>
            <p className="text-xs text-text-muted">{t("campaign.shareInstructions")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <code className="rounded bg-bg-base px-3 py-1.5 text-lg font-mono text-accent-gold tracking-widest">
                {campaign.shareCode}
              </code>
              <button
                onClick={() => void copyText("code")}
                className="flex items-center gap-1 rounded border border-border px-3 py-2 text-xs text-text-muted hover:bg-bg-elevated transition-colors pointer-coarse:min-h-11"
              >
                {copied === "code" ? (
                  <>
                    <Check size={12} className="text-accent-green" />
                    <span className="text-accent-green">{t("common.copied")}</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} aria-hidden="true" />
                    <span>{t("campaign.copyCode")}</span>
                  </>
                )}
              </button>
              <button
                onClick={() => void copyText("link")}
                className="flex items-center gap-1 rounded border border-border px-3 py-2 text-xs text-text-muted hover:bg-bg-elevated transition-colors pointer-coarse:min-h-11"
              >
                {copied === "link" ? (
                  <>
                    <Check size={12} className="text-accent-green" />
                    <span className="text-accent-green">{t("common.copied")}</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} aria-hidden="true" />
                    <span>{t("campaign.copyInviteLink")}</span>
                  </>
                )}
              </button>
              <button
                onClick={handleRevokeShare}
                disabled={revokeMutation.isPending}
                className="text-sm text-accent-red hover:text-accent-red pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
              >
                {t("campaign.revoke")}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-text-faint">{t("campaign.invitePlayers")}</p>
            <button
              onClick={() => shareMutation.mutate()}
              disabled={shareMutation.isPending}
              className="rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-on-accent-purple hover:bg-accent-purple/80 disabled:opacity-50"
            >
              {shareMutation.isPending ? t("campaign.generatingShareCode") : t("campaign.generateShareCode")}
            </button>
          </div>
        )}
      </section>

      {/* Players */}
      <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
        <h2 className="text-lg font-semibold text-text-base">
          {t("campaign.playersCount", { count: players?.length ?? 0 })}
        </h2>
        {players && players.length > 0 ? (
          <div className="space-y-2">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between rounded border border-border/50 px-3 py-2"
              >
                <div>
                  <span className="text-text-base">{player.username ?? t("campaign.unknown")}</span>
                  {player.character && (
                    <span className="ml-2 text-sm text-text-muted">
                      {"· "}
                      {player.character.name}
                      {(player.character.race || player.character.class) &&
                        ` (${[player.character.race && tRace(player.character.race, locale), player.character.class && tClass(player.character.class, locale)].filter(Boolean).join(" ")})`}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemovePlayer(player.id)}
                  className="text-xs text-accent-red hover:text-accent-red pointer-coarse:min-h-11 pointer-coarse:px-3"
                >
                  {t("campaign.removePlayer")}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-faint">{t("campaign.noPlayers")}</p>
        )}
      </section>

      {/* Excluded players (L6): shown only when there are any. */}
      {excluded && excluded.length > 0 && (
        <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-text-base">{t("campaign.excludedTitle")}</h2>
            <p className="text-xs text-text-muted">{t("campaign.excludedHint")}</p>
          </div>
          <div className="space-y-2">
            {excluded.map((player) => (
              <div key={player.id} className="flex items-center justify-between gap-3 rounded border border-border/50 px-3 py-2">
                <span className="min-w-0 break-words text-text-muted">{player.username ?? t("campaign.unknown")}</span>
                <button
                  onClick={() => handleLiftExclusion(player.id)}
                  disabled={liftMutation.isPending}
                  className="shrink-0 text-xs text-accent-gold hover:text-accent-gold/80 disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:px-3"
                >
                  {t("campaign.liftExclusion")}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
