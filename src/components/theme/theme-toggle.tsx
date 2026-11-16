"use client";

import { Sun, Moon } from "lucide-react";
import { useThemeStore, themeModeOf } from "@/stores/theme-store";
import { useT } from "@/lib/i18n";

// Light/dark switch. The mode is derived from the active palette's background
// luminance (see theme-store), so this works for any palette without a stored
// flag. Reused by the app header and the logged-out landing nav.
export function ThemeToggle({ className, size = 18 }: { className?: string; size?: number }) {
  const { t } = useT();
  const { themeId, toggleMode } = useThemeStore();
  const isLight = themeModeOf(themeId) === "light";
  const label = isLight ? t("theme.toDark") : t("theme.toLight");
  return (
    <button
      type="button"
      onClick={toggleMode}
      className={
        className ??
        "p-2 rounded-md text-text-muted hover:text-accent-gold hover:bg-bg-elevated transition-colors"
      }
      aria-label={label}
      title={label}
    >
      {isLight ? <Moon size={size} /> : <Sun size={size} />}
    </button>
  );
}
