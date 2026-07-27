"use client";

import { Eye, EyeOff } from "lucide-react";
import { VISIBLE_TO_ALL, VISIBLE_TO_DM, isDmOnly } from "@/lib/schemas/session";
import { useT } from "@/lib/i18n";

interface VisibilityToggleProps {
  visibleTo: string | string[];
  disabled: boolean;
  onChange: (visibleTo: string) => void;
}

export function VisibilityToggle({ visibleTo, disabled, onChange }: VisibilityToggleProps) {
  const { t } = useT();
  const dmOnly = isDmOnly(visibleTo);
  const label = dmOnly ? t("visibility.dmOnly") : t("visibility.all");
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(dmOnly ? VISIBLE_TO_ALL : VISIBLE_TO_DM);
      }}
      disabled={disabled}
      title={t("visibility.toggleHint")}
      aria-label={label}
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] shrink-0 ${
        dmOnly ? "bg-purple-900/30 text-purple-300" : "bg-bg-base text-text-faint hover:text-text-muted"
      } disabled:opacity-50`}
    >
      {dmOnly ? <EyeOff size={11} /> : <Eye size={11} />}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
