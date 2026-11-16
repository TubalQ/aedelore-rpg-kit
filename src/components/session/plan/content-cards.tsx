"use client";

import type { ReactNode } from "react";
import { useT, type TranslationKey } from "@/lib/i18n";
import type { SessionData } from "@/lib/schemas/session";
import { scenesOnDay, type SceneMemberKind, type SceneMembers, type ScenePlan } from "@/lib/session/scenes";
import type { SessionContent } from "@/hooks/useSessionContent";
import { NpcCard } from "../cards/npc-card";
import { ItemCard } from "../cards/item-card";
import { EquipmentCard } from "../cards/equipment-card";
import { ReadAloudCard } from "../cards/read-aloud-card";

const GROUPS: { kind: SceneMemberKind; label: TranslationKey }[] = [
  { kind: "npcs", label: "session.npc" },
  { kind: "readAloud", label: "session.readAloud" },
  { kind: "items", label: "session.item" },
  { kind: "equipment", label: "session.equipment" },
];

interface ContentCardsProps {
  data: SessionData;
  plan: ScenePlan;
  members: SceneMembers;
  content: SessionContent;
  disabled: boolean;
  /** The scene these cards are in, or null for loose content. */
  sceneIndex: number | null;
}

/**
 * The editable cards for a set of NPCs, read-alouds, items and equipment, each
 * with a way to move it to another scene or out of scenes.
 */
export function ContentCards({ data, plan, members, content, disabled, sceneIndex }: ContentCardsProps) {
  const { t } = useT();
  const encounterNames = data.encounters.map((e) => e.name).filter(Boolean);
  const npcNames = data.npcs.map((n) => n.name).filter(Boolean);
  const sceneOptions = plan.days.flatMap((day) =>
    scenesOnDay(plan, data, day).map((s) => ({
      index: s.index,
      label: `${day === null ? t("plan.noDay") : t("session.dayN", { n: day })} · ${data.encounters[s.index].name || t("plan.untitledScene")}`,
    })),
  );

  function card(kind: SceneMemberKind, i: number): ReactNode {
    const common = {
      mode: "prep" as const,
      disabled,
      placeNames: content.placeNames,
    };
    if (kind === "npcs") {
      const npc = data.npcs[i];
      return (
        <NpcCard {...common} npc={npc} onUpdate={(p) => content.updateNpc(i, p)} onRemove={() => content.remove("npc", i)}
          onAssignToPlace={(pl) => content.assignToPlace("npcs", i, pl)} onChangeDay={(d) => content.changeDay("npc", i, d)} onChangeTime={(tm) => content.changeTime("npc", i, tm)} />
      );
    }
    if (kind === "items") {
      return (
        <ItemCard {...common} item={data.items[i]} onUpdate={(p) => content.updateItem(i, p)} onRemove={() => content.remove("item", i)}
          onAssignToPlace={(pl) => content.assignToPlace("items", i, pl)} onChangeDay={(d) => content.changeDay("item", i, d)} onChangeTime={(tm) => content.changeTime("item", i, tm)} />
      );
    }
    if (kind === "equipment") {
      return (
        <EquipmentCard {...common} equipment={data.equipment[i]} onUpdate={(p) => content.updateEquipment(i, p)} onRemove={() => content.remove("equipment", i)}
          onAssignToPlace={(pl) => content.assignToPlace("equipment", i, pl)} onChangeDay={(d) => content.changeDay("equipment", i, d)} onChangeTime={(tm) => content.changeTime("equipment", i, tm)} />
      );
    }
    return (
      <ReadAloudCard {...common} readAloud={data.readAloud[i]} encounterNames={encounterNames} npcNames={npcNames}
        onUpdate={(p) => content.updateReadAloud(i, p)} onRemove={() => content.remove("readAloud", i)}
        onChangeDay={(d) => content.changeDay("readAloud", i, d)} onChangeTime={(tm) => content.changeTime("readAloud", i, tm)} />
    );
  }

  function move(kind: SceneMemberKind, i: number, value: string) {
    if (value === "out") content.moveOutOfScene(kind, i);
    else content.moveToScene(kind, i, data.encounters[Number(value)]);
  }

  return (
    <div className="flex flex-col gap-5">
      {GROUPS.filter((g) => members[g.kind].length > 0).map((g) => (
        <section key={g.kind} className="flex flex-col gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">
            {t(g.label)} · {members[g.kind].length}
          </h4>
          {members[g.kind].map((i) => (
            <div key={i} className="flex flex-col gap-1">
              {card(g.kind, i)}
              {!disabled && (
                <div className="flex min-w-0 justify-end">
                  <select
                    value=""
                    onChange={(e) => e.target.value && move(g.kind, i, e.target.value)}
                    aria-label={t("plan.moveTo")}
                    className="w-full max-w-60 min-w-0 rounded-md border border-border bg-bg-base px-2 py-1 text-xs text-text-muted"
                  >
                    <option value="">{t("plan.moveTo")}</option>
                    {sceneIndex !== null && <option value="out">{t("plan.moveOut")}</option>}
                    {sceneOptions.filter((o) => o.index !== sceneIndex).map((o) => (
                      <option key={o.index} value={o.index}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
