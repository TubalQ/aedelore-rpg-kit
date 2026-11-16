"use client";

import { BookOpen, Castle, LayoutGrid, List, MapPin, Package, ScrollText, Sword, UserPlus, Warehouse } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { ContentKind } from "@/lib/schemas/session";
import { CreateMenu } from "@/components/ui/create-menu";
import { cn } from "@/lib/utils/cn";

export type PlanViewMode = "board" | "list";
export type DayFilter = "all" | number | null;

interface PlanToolbarProps {
  days: (number | null)[];
  dayFilter: DayFilter;
  view: PlanViewMode;
  disabled: boolean;
  sessionOpen: boolean;
  onDayFilter: (f: DayFilter) => void;
  onView: (v: PlanViewMode) => void;
  onCreate: (kind: ContentKind) => void;
  onPickFromStash: () => void;
  onAddDay: () => void;
  onOpenSession: () => void;
}

const chip = (active: boolean) =>
  cn(
    "min-h-9 shrink-0 rounded-full border px-3 text-xs transition-colors",
    active ? "border-accent-gold bg-accent-gold/15 text-accent-gold" : "border-border text-text-muted hover:text-text-base",
  );

export function PlanToolbar(p: PlanToolbarProps) {
  const { t } = useT();
  const icon = "shrink-0";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {!p.disabled && (
          <CreateMenu
            label={t("plan.add")}
            items={[
              { key: "scene", label: t("plan.newScene"), hint: t("plan.newSceneHint"), icon: <Castle size={16} className={icon} />, onSelect: () => p.onCreate("encounter") },
              { key: "place", label: t("plan.newPlace"), hint: t("plan.newPlaceHint"), icon: <MapPin size={16} className={icon} />, onSelect: () => p.onCreate("place") },
              { key: "readAloud", label: t("plan.newReadAloud"), hint: t("plan.newReadAloudHint"), icon: <BookOpen size={16} className={icon} />, onSelect: () => p.onCreate("readAloud") },
              { key: "npc", label: t("plan.newNpc"), hint: t("plan.newNpcHint"), icon: <UserPlus size={16} className={icon} />, onSelect: () => p.onCreate("npc") },
              { key: "item", label: t("plan.newItem"), hint: t("plan.newItemHint"), icon: <Package size={16} className={icon} />, onSelect: () => p.onCreate("item") },
              { key: "equipment", label: t("plan.newEquipment"), hint: t("plan.newEquipmentHint"), icon: <Sword size={16} className={icon} />, onSelect: () => p.onCreate("equipment") },
            ]}
            footer={{ key: "stash", label: t("plan.fromStash"), icon: <Warehouse size={16} className={icon} />, onSelect: p.onPickFromStash }}
          />
        )}
        <button type="button" onClick={p.onOpenSession} aria-pressed={p.sessionOpen}
          className={cn("inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm", p.sessionOpen ? "border-accent-gold text-text-base" : "border-border text-text-muted hover:text-text-base")}>
          <ScrollText size={16} aria-hidden="true" />
          {t("plan.sessionButton")}
        </button>
        <div className="ml-auto flex rounded-lg border border-border p-0.5" role="group" aria-label={t("plan.view")}>
          {([["board", LayoutGrid, t("plan.board")], ["list", List, t("plan.list")]] as const).map(([v, Icon, label]) => (
            <button key={v} type="button" aria-pressed={p.view === v} aria-label={label} onClick={() => p.onView(v)}
              className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-sm", p.view === v ? "bg-bg-elevated text-text-base" : "text-text-muted hover:text-text-base")}>
              <Icon size={15} aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button type="button" className={chip(p.dayFilter === "all")} aria-pressed={p.dayFilter === "all"} onClick={() => p.onDayFilter("all")}>{t("plan.allDays")}</button>
        {p.days.map((d) => (
          <button key={d ?? "none"} type="button" className={chip(p.dayFilter === d)} aria-pressed={p.dayFilter === d} onClick={() => p.onDayFilter(d)}>
            {d === null ? t("plan.noDay") : t("session.dayN", { n: d })}
          </button>
        ))}
        {!p.disabled && (
          <button type="button" className={cn(chip(false), "border-dashed")} onClick={p.onAddDay}>+ {t("plan.addDay")}</button>
        )}
      </div>
    </div>
  );
}
