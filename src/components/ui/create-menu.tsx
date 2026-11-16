"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Plus } from "lucide-react";

export interface CreateMenuItem {
  key: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  onSelect: () => void;
}

/**
 * The one "Create" button with a menu of what can be created (session editor,
 * stash). Closes on selection, Escape and outside click; arrow keys move focus.
 */
export function CreateMenu({ label, items, footer }: { label: string; items: CreateMenuItem[]; footer?: CreateMenuItem }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onMenuKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? []);
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "ArrowDown" ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  const row = (item: CreateMenuItem) => (
    <button
      key={item.key}
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        item.onSelect();
      }}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-bg-overlay focus:bg-bg-overlay min-h-[52px]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-surface text-accent-gold">{item.icon}</span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-text-base">{item.label}</span>
        {item.hint && <span className="text-xs text-text-faint">{item.hint}</span>}
      </span>
    </button>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent-gold px-4 py-2 text-sm font-semibold text-bg-base hover:bg-accent-gold/85"
      >
        <Plus size={16} aria-hidden="true" />
        {label}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className="absolute left-0 top-full z-30 mt-2 w-[min(330px,calc(100vw-2rem))] rounded-xl border border-border bg-bg-elevated p-2 shadow-2xl"
        >
          {items.map(row)}
          {footer && (
            <>
              <div className="mx-1 my-1.5 h-px bg-border" />
              {row(footer)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
