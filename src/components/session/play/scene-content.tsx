"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import type { SessionData } from "@/lib/schemas/session";
import type { SceneMembers } from "@/lib/session/scenes";
import type { SessionContent } from "@/hooks/useSessionContent";
import { NpcCard } from "../cards/npc-card";
import { ItemCard } from "../cards/item-card";
import { EquipmentCard } from "../cards/equipment-card";
import { ReadAloudCard } from "../cards/read-aloud-card";
import { PlaceCard } from "../cards/place-card";
import type { GiveHandlers } from "./give-to";
import type { GiveKind } from "@/lib/session/give";

interface SceneContentProps {
  data: SessionData;
  members: SceneMembers;
  places: number[];
  content: SessionContent;
  disabled: boolean;
  /** Giving in play for the entry at `index` of a list. */
  giveFor: (kind: GiveKind, index: number) => GiveHandlers;
  /** What to say when there is nothing; the loose group says it differently (M8). */
  emptyText?: string;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">{title}</h3>
      {children}
    </section>
  );
}

/** What is in a scene during play: read-alouds first, then people, things and the place. */
export function SceneContent({ data, members, places, content, disabled, giveFor, emptyText }: SceneContentProps) {
  const { t } = useT();
  const noop = () => {};
  const common = { mode: "play" as const, disabled, placeNames: content.placeNames, onRemove: noop, onChangeDay: noop, onChangeTime: noop };
  const encounterNames = data.encounters.map((e) => e.name).filter(Boolean);
  const npcNames = data.npcs.map((n) => n.name).filter(Boolean);
  const things = members.npcs.length + members.items.length + members.equipment.length;

  return (
    <div className="flex flex-col gap-5">
      {members.readAloud.length > 0 && (
        <Group title={`${t("play.readAloud")} · ${members.readAloud.length}`}>
          {members.readAloud.map((i) => (
            <ReadAloudCard key={i} {...common} readAloud={data.readAloud[i]} encounterNames={encounterNames} npcNames={npcNames}
              onUpdate={(p) => content.updateReadAloud(i, p)} />
          ))}
        </Group>
      )}
      {things > 0 && (
        <Group title={`${t("play.inScene")} · ${things}`}>
          {members.npcs.map((i) => (
            <NpcCard key={`n${i}`} {...common} npc={data.npcs[i]} onUpdate={(p) => content.updateNpc(i, p)} onAssignToPlace={noop} />
          ))}
          {members.items.map((i) => (
            <ItemCard key={`i${i}`} {...common} item={data.items[i]} onUpdate={(p) => content.updateItem(i, p)} onAssignToPlace={noop}
              give={giveFor("items", i)} />
          ))}
          {members.equipment.map((i) => (
            <EquipmentCard key={`q${i}`} {...common} equipment={data.equipment[i]} onUpdate={(p) => content.updateEquipment(i, p)} onAssignToPlace={noop}
              give={giveFor("equipment", i)} />
          ))}
        </Group>
      )}
      {places.length > 0 && (
        <Group title={t("play.place")}>
          {places.map((i) => (
            <PlaceCard key={i} place={data.places[i]} mode="play" disabled={disabled} onUpdate={(p) => content.updatePlace(i, p)}
              onRemove={noop} onChangeDay={noop} onChangeTime={noop} />
          ))}
        </Group>
      )}
      {members.readAloud.length + things + places.length === 0 && <p className="text-sm text-text-faint">{emptyText ?? t("play.sceneEmpty")}</p>}
    </div>
  );
}
