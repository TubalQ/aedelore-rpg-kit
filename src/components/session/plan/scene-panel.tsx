"use client";

import { BookOpen, Package, Sword, UserPlus, Warehouse } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import type { ContentKind, SessionData } from "@/lib/schemas/session";
import type { Scene, ScenePlan } from "@/lib/session/scenes";
import type { SessionContent } from "@/hooks/useSessionContent";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { EnemyList } from "../cards/enemy-list";
import { ContentCards } from "./content-cards";
import { PanelShell } from "./panel-shell";
import { SceneForm, labelClass } from "./scene-form";
import { useTimeLabel } from "./scene-card";

export type SceneTab = "scene" | "inScene" | "combat";

interface ScenePanelProps {
  data: SessionData;
  plan: ScenePlan;
  scene: Scene;
  content: SessionContent;
  disabled: boolean;
  tab: SceneTab;
  onTab: (tab: SceneTab) => void;
  onAdd: (kind: ContentKind) => void;
  onPickFromStash: () => void;
  onClose: () => void;
}

export function ScenePanel({ data, plan, scene, content, disabled, tab, onTab, onAdd, onPickFromStash, onClose }: ScenePanelProps) {
  const { t } = useT();
  const time = useTimeLabel();
  const e = data.encounters[scene.index];
  const kicker = [t("plan.sceneLabel"), e.day ? t("session.dayN", { n: e.day }) : "", time(e.time)].filter(Boolean).join(" · ");
  const memberCount = scene.npcs.length + scene.items.length + scene.equipment.length + scene.readAloud.length;
  const area = "w-full rounded-lg border border-border bg-bg-base px-3 py-2 text-sm text-text-base focus:border-accent-red focus:outline-none disabled:opacity-50";

  const addButton = (kind: ContentKind, label: string, icon: ReactNode) => (
    <button type="button" onClick={() => onAdd(kind)}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 text-sm text-text-base hover:border-border-hover">
      {icon}
      {label}
    </button>
  );

  return (
    <PanelShell
      kicker={kicker}
      title={e.name || t("plan.untitledScene")}
      tabs={[
        { key: "scene", label: t("plan.tabScene") },
        { key: "inScene", label: `${t("plan.tabInScene")}${memberCount ? ` · ${memberCount}` : ""}` },
        { key: "combat", label: `${t("plan.tabCombat")}${e.enemies.length ? ` · ${e.enemies.length}` : ""}` },
      ]}
      tab={tab}
      onTab={onTab}
      onClose={onClose}
    >
      {tab === "scene" && <SceneForm data={data} scene={scene} content={content} disabled={disabled} onDeleted={onClose} />}

      {tab === "inScene" && (
        <div className="flex flex-col gap-5">
          <p className="text-xs text-text-faint">{t("plan.inSceneHint")}</p>
          {memberCount === 0 && <p className="text-sm text-text-faint">{t("plan.sceneEmpty")}</p>}
          <ContentCards data={data} plan={plan} members={scene} content={content} disabled={disabled} sceneIndex={scene.index} />
          {!disabled && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <button type="button" onClick={onPickFromStash}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent-gold px-3 text-sm font-semibold text-bg-base hover:bg-accent-gold/85">
                <Warehouse size={15} aria-hidden="true" />
                {t("plan.addFromStash")}
              </button>
              {addButton("npc", t("plan.addNpc"), <UserPlus size={15} aria-hidden="true" />)}
              {addButton("readAloud", t("plan.addReadAloud"), <BookOpen size={15} aria-hidden="true" />)}
              {addButton("item", t("plan.addItem"), <Package size={15} aria-hidden="true" />)}
              {addButton("equipment", t("plan.addEquipment"), <Sword size={15} aria-hidden="true" />)}
            </div>
          )}
        </div>
      )}

      {tab === "combat" && (
        <div className="flex flex-col gap-4">
          <label className={labelClass}>
            {t("plan.tactics")}
            <AutoTextarea rows={2} value={e.tactics} disabled={disabled} className={area}
              onChange={(ev) => content.updateEncounter(scene.index, { tactics: ev.target.value })} placeholder={t("sessionCard.encounter.tacticsPlaceholder")} />
          </label>
          <label className={labelClass}>
            {t("plan.loot")}
            <AutoTextarea rows={1} value={e.loot} disabled={disabled} className={area}
              onChange={(ev) => content.updateEncounter(scene.index, { loot: ev.target.value })} placeholder={t("sessionCard.encounter.lootPlaceholder")} />
          </label>
          {e.enemies.length === 0 && <p className="text-sm text-text-faint">{t("plan.noEnemies")}</p>}
          <EnemyList enemies={e.enemies} mode="prep" disabled={disabled} onChange={(enemies) => content.updateEncounter(scene.index, { enemies })} />
        </div>
      )}
    </PanelShell>
  );
}
