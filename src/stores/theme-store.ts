"use client";

import type { ThemeId } from "@/lib/domain/themes";
import { create } from "zustand";
import {
  DEFAULT_THEME,
  resolvePalettes,
  pickDefaultThemeId,
  paletteIsLight,
  withOnAccent,
  withThemeAccent,
  type Palette,
} from "@/lib/domain/themes";
import { getSystem } from "@/systems/runtime";
import { readStored, writeStored } from "@/lib/utils/safe-storage";

// Palettes are now live game-system data (edited in /system-admin), read from
// the active system with the bundled THEMES as fallback (see themes.ts helpers).
type ThemeMode = "light" | "dark";

function palettes(): Record<string, Palette> {
  return withOnAccent(
    withThemeAccent(
      resolvePalettes<Record<string, Palette>>(getSystem().palettes as Record<string, Palette> | undefined),
      getSystem().theme,
    ),
  );
}

function defaultThemeId(): ThemeId {
  return pickDefaultThemeId(palettes());
}

/** Light or dark, derived from the palette's page background (no stored flag). */
export function themeModeOf(id: ThemeId): ThemeMode {
  const p = palettes()[id];
  return p && paletteIsLight(p.colors) ? "light" : "dark";
}

/** The palette a bare light/dark toggle lands on when no per-mode memory exists:
    the default for dark, the first light palette for light. */
function defaultForMode(mode: ThemeMode): ThemeId {
  const ids = Object.keys(palettes());
  if (mode === "dark") {
    return themeModeOf(DEFAULT_THEME) === "dark"
      ? DEFAULT_THEME
      : ids.find((id) => themeModeOf(id) === "dark") ?? DEFAULT_THEME;
  }
  return ids.find((id) => themeModeOf(id) === "light") ?? defaultThemeId();
}

interface ThemeState {
  themeId: ThemeId;
  hydrated: boolean;
  setTheme: (id: ThemeId) => void;
  toggleMode: () => void;
  hydrate: () => void;
}

function applyTheme(id: ThemeId) {
  const theme = palettes()[id];
  if (!theme) return;
  const style = document.documentElement.style;
  for (const [key, value] of Object.entries(theme.colors)) {
    style.setProperty(`--color-${key}`, value);
  }
  // Native controls (scrollbars, select dropdowns) follow the palette's mode.
  const scheme = paletteIsLight(theme.colors) ? "light" : "dark";
  style.colorScheme = scheme;
  // globals.css keys light-palette fixes on it (#89).
  document.documentElement.setAttribute("data-scheme", scheme);
  document.documentElement.setAttribute("data-theme", id);
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeId: DEFAULT_THEME,
  hydrated: false,
  setTheme: (id) => {
    writeStored("aedelore-theme", id);
    // Remember the last choice per mode so the light/dark toggle is reversible
    // and respects a user who picked e.g. Ember instead of the default dark.
    writeStored(`aedelore-theme-${themeModeOf(id)}`, id);
    applyTheme(id);
    set({ themeId: id });
  },
  toggleMode: () => {
    const target: ThemeMode = themeModeOf(get().themeId) === "dark" ? "light" : "dark";
    const all = palettes();
    const remembered = readStored(`aedelore-theme-${target}`);
    const id =
      remembered && remembered in all && themeModeOf(remembered) === target
        ? remembered
        : defaultForMode(target);
    get().setTheme(id);
  },
  hydrate: () => {
    const stored = readStored("aedelore-theme");
    const id = stored && stored in palettes() ? stored : defaultThemeId();
    applyTheme(id);
    set({ themeId: id, hydrated: true });
  },
}));
