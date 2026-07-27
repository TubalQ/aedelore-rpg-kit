import { create } from "zustand";

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
    localStorage.setItem("aedelore-locale", locale);
    set({ locale });
  },
  hydrate: () => {
    const stored = localStorage.getItem("aedelore-locale");
    const locale: Locale = stored === "sv" ? "sv" : "en";
    set({ locale, hydrated: true });
  },
}));
