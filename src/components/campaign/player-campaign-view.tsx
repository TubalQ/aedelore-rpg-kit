"use client";

import { useMemo, useState } from "react";
import { usePlayerCampaignView, useLeaveCampaign, useAttachCharacter } from "@/hooks/useCampaigns";
import { useCharacters } from "@/hooks/useCharacters";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { PlayerSessionCard } from "@/components/campaign/player-session-card";
import { Package, Sword } from "lucide-react";

interface PlayerCampaignViewProps {
  campaignId: number;
  previewMode?: boolean;
}

export function PlayerCampaignView({ campaignId, previewMode = false }: PlayerCampaignViewProps) {
  const router = useRouter();
  const { data, isLoading, error } = usePlayerCampaignView(campaignId);
  const leaveMutation = useLeaveCampaign();
  const { data: myCharacters } = useCharacters();
  const attachMutation = useAttachCharacter(campaignId);
  const [attachId, setAttachId] = useState<string>("");
  const { t } = useT();

  const attachable = (myCharacters ?? [])
    .filter((c) => c.campaignId == null)
    .map((c) => ({ id: c.id as number, name: (c.name as string) ?? "" }));

  const { allItems, allEquipment } = useMemo(() => {
    if (!data) return { allItems: [], allEquipment: [] };
    const charName = data.myCharacter?.name ?? "";
    const items = data.sessions.flatMap((s) => {
      const sessionItems = (s.data.items ?? []) as { name: string; description: string; givenTo: string }[];
      return sessionItems
        .filter((it) => it.givenTo === charName)
        .map((it) => ({ ...it, sessionNumber: s.sessionNumber }));
    });
    const equipment = data.sessions.flatMap((s) => {
      const sessionEq = (s.data.equipment ?? []) as { name: string; type: string; rarity: string; givenTo: string }[];
      // "Received" = given to this character. Merely-visible loot still shows in
      // the session cards below, but must not be mislabelled as received here.
      return sessionEq
        .filter((eq) => eq.givenTo === charName)
        .map((eq) => ({ ...eq, sessionNumber: s.sessionNumber }));
    });
    return { allItems: items, allEquipment: equipment };
  }, [data]);

  if (isLoading) return <p className="text-text-muted">{t("campaign.loading")}</p>;
  if (error) return <p className="text-red-400">{t("campaign.loadError", { error: error.message })}</p>;
  if (!data) return <p className="text-red-400">{t("campaign.notFound")}</p>;

  async function handleLeave() {
    if (!confirm(t("campaign.leaveConfirm"))) return;
    await leaveMutation.mutateAsync(campaignId);
    router.push("/campaigns");
  }

  async function handleAttach() {
    if (!attachId) return;
    await attachMutation.mutateAsync(Number(attachId));
    setAttachId("");
  }

  const needsCharacter = !previewMode && !data.myCharacter;

  const hasLoot = allItems.length > 0 || allEquipment.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-text-base">{data.campaign.name}</h1>
            <span className="rounded bg-accent-purple/20 px-1.5 py-0.5 text-xs font-semibold text-accent-purple">
              {t("campaign.player")}
            </span>
          </div>
          {data.campaign.dmName && (
            <p className="text-sm text-text-muted mt-1">DM: {data.campaign.dmName}</p>
          )}
          {data.campaign.description && (
            <p className="mt-2 text-text-muted">{data.campaign.description}</p>
          )}
        </div>
        {!previewMode && (
          <button
            onClick={handleLeave}
            disabled={leaveMutation.isPending}
            className="shrink-0 ml-4 text-sm text-red-400 hover:text-red-300"
          >
            {t("campaign.leave")}
          </button>
        )}
      </div>

      {/* Attach a character when the player joined without one */}
      {needsCharacter && (
        <section className="rounded-lg border border-accent-gold/40 bg-accent-gold/5 p-4 space-y-3">
          <p className="text-sm text-text-base">{t("campaign.selectCharacterPrompt")}</p>
          {attachable.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={attachId}
                onChange={(e) => setAttachId(e.target.value)}
                className="rounded-lg border border-border bg-bg-base px-3 py-2 text-text-base focus:border-accent-gold focus:outline-none"
              >
                <option value="">-</option>
                {attachable.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={handleAttach}
                disabled={!attachId || attachMutation.isPending}
                className="rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-purple/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {attachMutation.isPending ? t("campaign.attaching") : t("campaign.attachCharacter")}
              </button>
            </div>
          ) : (
            <p className="text-sm text-text-faint">
              {t("campaign.noCharacterToBring")}{" "}
              <Link href="/characters/new" className="text-accent-gold hover:underline">
                {t("character.create")}
              </Link>
            </p>
          )}
          {attachMutation.error && (
            <p className="text-sm text-red-400">
              {t("campaign.attachError", { error: attachMutation.error.message })}
            </p>
          )}
        </section>
      )}

      {/* My Summary */}
      <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
        <h2 className="text-lg font-semibold text-text-base">{t("campaign.mySummary")}</h2>
        {data.myCharacter && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-text-muted">{t("progression.xp")}</span>
            <span className="font-mono text-accent-gold">{data.myCharacter.xp - data.myCharacter.xpSpent}</span>
            <span className="text-xs text-text-faint">
              {t("campaign.xpDetail", { total: data.myCharacter.xp, spent: data.myCharacter.xpSpent })}
            </span>
          </div>
        )}
        {hasLoot ? (
          <div className="space-y-3">
            {allItems.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                  <Package size={12} />
                  {t("campaign.receivedItems")}
                </h3>
                {allItems.map((it, i) => (
                  <div key={i} className="flex items-center gap-2 border-l-2 border-amber-800/50 pl-2">
                    <span className="text-sm text-text-base font-medium">{it.name}</span>
                    {it.description && (
                      <span className="text-xs text-text-faint">{it.description}</span>
                    )}
                    <span className="ml-auto text-[10px] text-text-faint">
                      {t("campaign.fromSession", { n: String(it.sessionNumber) })}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {allEquipment.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <Sword size={12} />
                  {t("campaign.receivedEquipment")}
                </h3>
                {allEquipment.map((eq, i) => (
                  <div key={i} className="flex items-center gap-2 border-l-2 border-emerald-800/50 pl-2">
                    <span className="text-sm text-text-base font-medium">{eq.name}</span>
                    <span className="text-xs text-text-faint">{eq.type}</span>
                    {eq.rarity !== "common" && (
                      <span className="text-xs text-accent-gold">{eq.rarity}</span>
                    )}
                    <span className="ml-auto text-[10px] text-text-faint">
                      {t("campaign.fromSession", { n: String(eq.sessionNumber) })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-text-faint">{t("campaign.noItemsYet")}</p>
        )}
      </section>

      {/* Party */}
      <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
        <h2 className="text-lg font-semibold text-text-base">{t("campaign.party")}</h2>
        {data.party.length > 0 ? (
          <div className="space-y-2">
            {data.party.map((member, i) => {
              const isYou = data.myCharacter && member.name === data.myCharacter.name;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isYou
                        ? "bg-accent-gold/20 text-accent-gold"
                        : "bg-bg-elevated text-text-muted"
                    }`}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-base font-medium">{member.name}</span>
                    {(member.race || member.class) && (
                      <span className="text-xs text-text-faint">
                        {[member.race, member.class].filter(Boolean).join(" / ")}
                      </span>
                    )}
                    {isYou && (
                      <span className="rounded bg-accent-gold/20 px-1 py-0.5 text-[10px] text-accent-gold">{t("campaign.you")}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-text-faint">{t("campaign.noCharactersInCampaign")}</p>
        )}
      </section>

      {/* Sessions */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-base">
          {t("campaign.sessionsCount", { count: String(data.sessions.length) })}
        </h2>
        {data.sessions.length === 0 && (
          <p className="text-sm text-text-faint">{t("campaign.noSessions")}</p>
        )}
        {data.sessions.map((session) => (
          <PlayerSessionCard key={session.id} session={session} />
        ))}
      </section>
    </div>
  );
}
