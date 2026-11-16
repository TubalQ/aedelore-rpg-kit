"use client";

import { Eye, EyeOff } from "lucide-react";
import { VISIBLE_TO_ALL, VISIBLE_TO_DM, isDmOnly } from "@/lib/schemas/session";
import { useT } from "@/lib/i18n";

interface VisibilityToggleProps {
  visibleTo: string | string[];
  disabled: boolean;
  onChange: (visibleTo: string) => void;
}

/**
 * Who sees a card (#85). Both states are drawn as a clear chip: an open eye in
 * green when players see it, a struck eye in purple when only the DM does.
 * A switch for screen readers: "Visible to players", on or off.
 */
export function VisibilityToggle({ visibleTo, disabled, onChange }: VisibilityToggleProps) {
  const { t } = useT();
  const dmOnly = isDmOnly(visibleTo);
  const label = dmOnly ? t("visibility.dmOnly") : t("visibility.all");
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!dmOnly}
      onClick={(e) => {
        e.stopPropagation();
        onChange(dmOnly ? VISIBLE_TO_ALL : VISIBLE_TO_DM);
      }}
      disabled={disabled}
      title={t("visibility.toggleHint")}
      aria-label={t("visibility.switchLabel")}
      className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium shrink-0 pointer-coarse:min-h-11 pointer-coarse:px-2.5 ${
        dmOnly
          ? "border-accent-purple/40 bg-accent-purple/10 text-accent-purple"
          : "border-accent-green/40 bg-accent-green/10 text-accent-green"
      } disabled:opacity-50`}
    >
      {dmOnly ? <EyeOff size={11} aria-hidden="true" /> : <Eye size={11} aria-hidden="true" />}
      <span>{label}</span>
    </button>
  );
}
