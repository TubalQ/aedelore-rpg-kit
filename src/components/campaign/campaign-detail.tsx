"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
  useCampaignPlayers,
} from "@/hooks/useCampaigns";
import { useCampaignSessions, useCreateSession, useDeleteSession } from "@/hooks/useSessions";
import { SessionList } from "@/components/session/session-list";
import { DmCharacterPanel } from "@/components/campaign/dm-character-panel";
import { StashView } from "@/components/stash/stash-view";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { PartyOverview } from "@/components/campaign/party-overview";
import { CampaignOverviewTab } from "@/components/campaign/campaign-overview-tab";
import { useT } from "@/lib/i18n";
import { RefreshFailed } from "@/components/ui/refresh-failed";

const TABS = ["overview", "party", "sessions", "box"] as const;
function parseTab(raw: string | null): Tab {
  return (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "overview";
}

type Tab = (typeof TABS)[number];

interface CampaignDetailProps {
  campaignId: number;
}

export function CampaignDetail({ campaignId }: CampaignDetailProps) {
  const { t } = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: campaign, isLoading, error } = useCampaign(campaignId);
  const { data: players } = useCampaignPlayers(campaignId);
  const { data: sessions } = useCampaignSessions(campaignId);
  const updateMutation = useUpdateCampaign(campaignId);
  const deleteMutation = useDeleteCampaign();
  const createSessionMutation = useCreateSession(campaignId);
  const deleteSessionMutation = useDeleteSession(campaignId);

  // The tab lives in the URL (?tab=...), so reload and Back keep it.
  const [activeTab, setActiveTabState] = useState<Tab>(() => parseTab(searchParams.get("tab")));
  function setActiveTab(tab: Tab) {
    setActiveTabState(tab);
    router.replace(`/campaigns/${campaignId}?tab=${tab}`, { scroll: false });
  }
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");


  if (isLoading) return <p className="text-text-muted">{t("campaign.loading")}</p>;
  if (error && !campaign) return <p className="text-accent-red">{t("campaign.loadError", { error: error.message })}</p>;
  if (!campaign) return <p className="text-accent-red">{t("campaign.notFound")}</p>;

  function startEditing() {
    if (!campaign) return;
    setEditName(campaign.name);
    setEditDesc(campaign.description ?? "");
    setIsEditing(true);
  }

  // Failures are shown by the global mutation error toast.
  function saveEdit() {
    if (!editName.trim()) return;
    updateMutation.mutate(
      { name: editName.trim(), description: editDesc.trim() },
      { onSuccess: () => setIsEditing(false) },
    );
  }

  function handleDelete() {
    if (!confirm(t("campaign.deleteCampaignConfirm"))) return;
    deleteMutation.mutate(campaignId, { onSuccess: () => router.push("/campaigns") });
  }

  function handleCreateSession() {
    createSessionMutation.mutate({}, { onSuccess: (result) => router.push(`/sessions/${result.id}`) });
  }

  function handleDeleteSession(sessionId: number) {
    if (!confirm(t("campaign.deleteSessionConfirm"))) return;
    deleteSessionMutation.mutate(sessionId);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: t("campaign.tabOverview") },
    { key: "party", label: t("campaign.tabParty") },
    { key: "sessions", label: t("campaign.tabSessions") },
    { key: "box", label: t("campaign.tabBox") },
  ];

  const playerCount = players?.length ?? 0;
  const sessionCount = sessions?.length ?? 0;

  return (
    <div className="space-y-4">
      <RefreshFailed error={error} />
      {/* Header */}
      {isEditing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            maxLength={100}
            className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-xl font-bold text-text-base focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
          />
          <AutoTextarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-text-base focus:border-accent-gold focus:outline-none focus:ring-1 focus:ring-accent-gold"
          />
          <div className="flex gap-2">
            <button
              onClick={saveEdit}
              disabled={updateMutation.isPending}
              className="rounded-lg bg-accent-gold px-4 py-2 text-sm font-semibold text-bg-base hover:bg-accent-gold/80 disabled:opacity-50"
            >
              {t("common.save")}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-bg-surface"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-text-base">{campaign.name}</h1>
              <p className="mt-1 text-sm text-text-faint">
                {/* Singular at 1 ("1 players" before). */}
                {playerCount} {t(playerCount === 1 ? "campaign.playersOne" : "campaign.players")} · {sessionCount}{" "}
                {t(sessionCount === 1 ? "campaign.sessionsOne" : "campaign.sessionsMany")}
              </p>
            </div>
            <div className="flex gap-2 shrink-0 ml-4">
              <button
                onClick={startEditing}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted hover:bg-bg-surface pointer-coarse:min-h-11"
              >
                {t("common.edit")}
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg border border-accent-red/50 px-3 py-1.5 text-sm text-accent-red hover:bg-accent-red/15 pointer-coarse:min-h-11"
              >
                {t("campaign.deleteCampaign")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? "border-accent-gold text-accent-gold"
                : "border-transparent text-text-faint hover:text-text-muted"
            }`}
          >
            {label}
            {key === "sessions" && sessionCount > 0 && (
              <span className="ml-1.5 text-xs text-text-faint"> ({sessionCount})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <CampaignOverviewTab campaign={campaign} onStartEditing={startEditing} />
      )}

      {activeTab === "party" && (
        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
            <h2 className="text-lg font-semibold text-text-base">{t("campaign.party")}</h2>
            <PartyOverview campaignId={campaignId} />
          </section>
          <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
            <h2 className="text-lg font-semibold text-text-base">{t("campaign.characters")}</h2>
            <DmCharacterPanel campaignId={campaignId} />
          </section>
        </div>
      )}

      {activeTab === "box" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text-base">{t("box.title")}</h2>
          <StashView campaignId={campaignId} />
        </div>
      )}

      {activeTab === "sessions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-base">
              {t("campaign.tabSessions")} {sessionCount > 0 && `(${sessionCount})`}
            </h2>
            <button
              onClick={handleCreateSession}
              disabled={createSessionMutation.isPending}
              className="rounded-lg bg-accent-gold px-4 py-2 text-sm font-semibold text-bg-base hover:bg-accent-gold/80 disabled:opacity-50"
            >
              {createSessionMutation.isPending ? t("campaign.creatingSession") : t("campaign.newSession")}
            </button>
          </div>
          {sessions && sessions.length > 0 ? (
            <SessionList sessions={sessions} onDelete={handleDeleteSession} />
          ) : (
            <div className="rounded-lg border border-border/50 bg-bg-surface p-8 text-center">
              <p className="text-text-faint">{t("campaign.createFirstSession")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
