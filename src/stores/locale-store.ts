import { create } from "zustand";
import { readStored, writeStored } from "@/lib/utils/safe-storage";

export type Locale = "sv" | "en";

interface LocaleState {
  locale: Locale;
  hydrated: boolean;
  setLocale: (locale: Locale) => void;
  hydrate: () => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  // Engelska är default; svenska är opt-in via språktogglen i inställningar (sparas i localStorage).
  locale: "en",
  hydrated: false,
  setLocale: (locale) => {
    writeStored("aedelore-locale", locale);
    document.documentElement.lang = locale;
    set({ locale });
  },
  hydrate: () => {
    const stored = readStored("aedelore-locale");
    const locale: Locale = stored === "sv" ? "sv" : "en";
    // <html lang> follows the chosen language, so screen readers pronounce it right.
    document.documentElement.lang = locale;
    set({ locale, hydrated: true });
  },
}));
