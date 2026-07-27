"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import {
  useGenerateShareCode,
  useRevokeShareCode,
  useCampaignPlayers,
  useRemovePlayer,
} from "@/hooks/useCampaigns";
import { useT } from "@/lib/i18n";
import type { CampaignRow } from "@/lib/schemas/campaign";

interface CampaignOverviewTabProps {
  campaign: CampaignRow;
  onStartEditing: () => void;
}

export function CampaignOverviewTab({ campaign, onStartEditing }: CampaignOverviewTabProps) {
  const { t } = useT();
  const { data: players } = useCampaignPlayers(campaign.id);
  const shareMutation = useGenerateShareCode(campaign.id);
  const revokeMutation = useRevokeShareCode(campaign.id);
  const removePlayerMutation = useRemovePlayer(campaign.id);
  const [copied, setCopied] = useState(false);

  const handleCopyShareCode = useCallback(async () => {
    if (!campaign.shareCode) return;
    await navigator.clipboard.writeText(campaign.shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [campaign.shareCode]);

  async function handleRevokeShare() {
    if (!confirm(t("campaign.revokeShareCodeConfirm"))) return;
    await revokeMutation.mutateAsync();
  }

  async function handleRemovePlayer(playerId: string) {
    if (!confirm(t("campaign.removePlayerConfirm"))) return;
    await removePlayerMutation.mutateAsync(playerId);
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
              className="mt-2 text-sm text-accent-gold hover:text-accent-gold/80"
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
            <div className="flex items-center gap-4">
              <code className="rounded bg-bg-base px-3 py-1.5 text-lg font-mono text-accent-gold tracking-widest">
                {campaign.shareCode}
              </code>
              <button
                onClick={handleCopyShareCode}
                className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-text-muted hover:bg-bg-elevated transition-colors"
              >
                {copied ? (
                  <>
                    <Check size={12} className="text-green-400" />
                    <span className="text-green-400">{t("common.copied")}</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>{t("wikiAdmin.copy")}</span>
                  </>
                )}
              </button>
              <button
                onClick={handleRevokeShare}
                disabled={revokeMutation.isPending}
                className="text-sm text-red-400 hover:text-red-300"
              >
                {t("campaign.revoke")}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-text-faint">{t("campaign.invitePlayers")}</p>
            <button
              onClick={() => shareMutation.mutateAsync()}
              disabled={shareMutation.isPending}
              className="rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white hover:bg-accent-purple/80 disabled:opacity-50"
            >
              {shareMutation.isPending ? t("campaign.generatingShareCode") : t("campaign.generateShareCode")}
            </button>
          </div>
        )}
      </section>

      {/* Players */}
      <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
        <h2 className="text-lg font-semibold text-text-base">
          {t("campaign.player")} {players && players.length > 0 && `(${players.length})`}
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
                      {player.character.name}
                      {player.character.race && ` (${player.character.race}`}
                      {player.character.class && ` ${player.character.class}`}
                      {player.character.race && ")"}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRemovePlayer(player.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  {t("common.remove")}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-faint">{t("campaign.noPlayers")}</p>
        )}
      </section>
    </div>
  );
}
