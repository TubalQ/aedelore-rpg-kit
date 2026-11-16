"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";

export interface PanelTab<K extends string> {
  key: K;
  label: string;
}

interface PanelShellProps<K extends string> {
  kicker: string;
  title: string;
  tabs: PanelTab<K>[];
  tab: K;
  onTab: (tab: K) => void;
  onClose: () => void;
  children: ReactNode;
}

/** Side panel frame of the planning view: heading, tabs, scrolling body. */
export function PanelShell<K extends string>({ kicker, title, tabs, tab, onTab, onClose, children }: PanelShellProps<K>) {
  const { t } = useT();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-5 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">{kicker}</p>
            <h2 className="truncate font-display text-2xl font-bold leading-tight text-text-base">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-text-base">
            <X size={18} />
          </button>
        </div>
        <div role="tablist" className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              role="tab"
              aria-selected={tab === tb.key}
              onClick={() => onTab(tb.key)}
              className={cn(
                "min-h-10 shrink-0 border-b-2 px-3 text-sm transition-colors",
                tab === tb.key ? "border-accent-gold font-medium text-text-base" : "border-transparent text-text-muted hover:text-text-base",
              )}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
    </div>
  );
}
