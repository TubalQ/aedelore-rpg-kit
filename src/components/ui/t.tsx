"use client";

import { useT, type TranslationKey } from "@/lib/i18n";

/**
 * Renderar en översatt sträng i valt språk. Klientkomponent - används för att
 * lokalisera etiketter inuti serverkomponenter (t.ex. publika wiki-sidor), där
 * useT()-hooken inte kan köras direkt. Följer locale-storet precis som resten av appen.
 */
export function T({ k, vars }: { k: TranslationKey; vars?: Record<string, string | number> }) {
  const { t } = useT();
  return <>{t(k, vars)}</>;
}
