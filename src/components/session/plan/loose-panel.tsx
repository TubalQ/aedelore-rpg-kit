"use client";

import { useT } from "@/lib/i18n";
import type { SessionData } from "@/lib/schemas/session";
import type { ScenePlan } from "@/lib/session/scenes";
import type { SessionContent } from "@/hooks/useSessionContent";
import { PlaceCard } from "../cards/place-card";
import { ContentCards } from "./content-cards";
import { PanelShell } from "./panel-shell";
import type { LooseTab } from "./plan-selection";

interface LoosePanelProps {
  data: SessionData;
  plan: ScenePlan;
  content: SessionContent;
  disabled: boolean;
  tab: LooseTab;
  onTab: (tab: LooseTab) => void;
  onClose: () => void;
}

/** Content outside every scene, and every place of the session. */
export function LoosePanel({ data, plan, content, disabled, tab, onTab, onClose }: LoosePanelProps) {
  const { t } = useT();
  return (
    <PanelShell
      kicker={t("plan.sessionButton")}
      title={tab === "loose" ? t("plan.loose") : t("plan.places")}
      tabs={[
        { key: "loose", label: t("plan.loose") },
        { key: "places", label: `${t("plan.places")} · ${data.places.length}` },
      ]}
      tab={tab}
      onTab={onTab}
      onClose={onClose}
    >
      {tab === "loose" ? (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-text-faint">{t("plan.looseHint")}</p>
          <ContentCards data={data} plan={plan} members={plan.loose} content={content} disabled={disabled} sceneIndex={null} />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="pb-2 text-xs text-text-faint">{t("plan.placesHint")}</p>
          {data.places.map((p, i) => (
            <PlaceCard key={i} place={p} mode="prep" disabled={disabled} onUpdate={(patch) => content.updatePlace(i, patch)}
              onRemove={() => content.remove("place", i)} onChangeDay={(d) => content.changeDay("place", i, d)} onChangeTime={(tm) => content.changeTime("place", i, tm)} />
          ))}
        </div>
      )}
    </PanelShell>
  );
}
