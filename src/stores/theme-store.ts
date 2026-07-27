"use client";

import { create } from "zustand";
import { DEFAULT_THEME, resolvePalettes, pickDefaultThemeId, type Palette } from "@/lib/domain/themes";
import { getSystem } from "@/systems/runtime";

// Palettes are now live game-system data (edited in /system-admin), read from
// the active system with the bundled THEMES as fallback (see themes.ts helpers).
type ThemeId = string;

function palettes(): Record<string, Palette> {
  return resolvePalettes<Record<string, Palette>>(
    getSystem().palettes as Record<string, Palette> | undefined,
  );
}

function defaultThemeId(): ThemeId {
  return pickDefaultThemeId(palettes());
}

interface ThemeState {
  themeId: ThemeId;
  hydrated: boolean;
  setTheme: (id: ThemeId) => void;
  hydrate: () => void;
}

function applyTheme(id: ThemeId) {
  const theme = palettes()[id];
  if (!theme) return;
  const style = document.documentElement.style;
  for (const [key, value] of Object.entries(theme.colors)) {
    style.setProperty(`--color-${key}`, value);
  }
  document.documentElement.setAttribute("data-theme", id);
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: DEFAULT_THEME,
  hydrated: false,
  setTheme: (id) => {
    localStorage.setItem("aedelore-theme", id);
    applyTheme(id);
    set({ themeId: id });
  },
  hydrate: () => {
    const stored = localStorage.getItem("aedelore-theme");
    const id = stored && stored in palettes() ? stored : defaultThemeId();
    applyTheme(id);
    set({ themeId: id, hydrated: true });
  },
}));
