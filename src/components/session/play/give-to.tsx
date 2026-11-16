"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Gift, Undo2, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { GiveMode } from "@/lib/session/give";

/** A character something can be handed to. */
export type GiveTarget = { id: number; name: string; subtitle: string };

/** What a card needs to offer giving in play. */
export type GiveHandlers = {
  targets: GiveTarget[];
  onGive: (target: GiveTarget, mode: GiveMode) => void;
  onTakeBack: (name: string) => void;
};

interface GiveToButtonProps extends GiveHandlers {
  what: string;
  /** The characters holding it now. */
  holders: readonly string[];
  disabled: boolean;
}

/**
 * "Give to": a menu of the campaign's characters (a sheet from the bottom on
 * phones). Picking a character hands it over: whoever had it loses it. With
 * "share" switched on, the picked character gets it too and the others keep
 * theirs. Each holder has its own "take back".
 */
export function GiveToButton({ what, targets, holders, disabled, onGive, onTakeBack }: GiveToButtonProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState(false);
  const wide = useMediaQuery("(min-width: 640px)");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => wide && root.current && !root.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open, wide]);

  function toggle() {
    // Every hand-out starts as a move; sharing is a choice made each time.
    if (!open) setShare(false);
    setOpen((o) => !o);
  }

  function pick(target: GiveTarget) {
    setOpen(false);
    onGive(target, share ? "share" : "move");
  }

  const holds = (name: string): boolean => holders.includes(name);
  // Nothing to do: sharing with someone who has it, or moving it to its only holder.
  const unchanged = (name: string): boolean => holds(name) && (share || holders.length === 1);

  const list = (
    <div className="flex flex-col gap-1">
      {holders.length > 0 && (
        <label className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-text-muted">
          <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent-gold)]" />
          {t("play.shareToggle")}
        </label>
      )}
      <ul className="flex flex-col" role="menu">
        {targets.map((c) => (
          <li key={c.id}>
            <button type="button" role="menuitem" onClick={() => pick(c)} disabled={unchanged(c.name)}
              className="flex min-h-12 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-bg-elevated disabled:opacity-50 disabled:hover:bg-transparent">
              <span className="flex min-w-0 flex-1 flex-col justify-center">
                <span className="text-sm font-medium text-text-base">{c.name}</span>
                {c.subtitle && <span className="text-xs text-text-faint">{c.subtitle}</span>}
              </span>
              {holds(c.name) && <Check size={16} className="shrink-0 text-accent-green" aria-label={t("play.hasIt")} />}
            </button>
          </li>
        ))}
        {targets.length === 0 && <li className="px-3 py-3 text-sm text-text-faint">{t("play.noCharacters")}</li>}
      </ul>
    </div>
  );

  return (
    <div ref={root} className="relative flex flex-wrap items-center gap-2">
      {holders.map((name) => (
        <span key={name} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-accent-green/30 bg-accent-green/10 pl-2.5 text-xs text-accent-green">
          {t("play.givenTo", { name })}
          <button type="button" disabled={disabled} onClick={() => onTakeBack(name)}
            aria-label={t("play.takeBackFrom", { what, name })} title={t("play.takeBack")}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-accent-green/70 hover:text-accent-red disabled:opacity-50">
            <Undo2 size={14} aria-hidden="true" />
          </button>
        </span>
      ))}
      <button type="button" disabled={disabled} onClick={toggle} aria-haspopup="menu" aria-expanded={open}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-3 text-xs font-medium text-text-base hover:border-accent-gold disabled:opacity-50">
        <Gift size={14} aria-hidden="true" />
        {t("play.giveTo")}
      </button>
      {open && wide && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-border bg-bg-surface p-1.5 shadow-xl">{list}</div>
      )}
      {open && !wide && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={t("play.giveToTitle", { name: what })} onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-2xl border-t border-border bg-bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-text-base">{t("play.giveToTitle", { name: what })}</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("common.close")} className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted">
                <X size={18} />
              </button>
            </div>
            {list}
          </div>
        </div>
      )}
    </div>
  );
}
