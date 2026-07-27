import { useLocaleStore, type Locale } from "@/stores/locale-store";
import { sv, type TranslationKey } from "./sv";
import { en } from "./en";
import { getUiOverride } from "./overrides";
export type { TranslationKey } from "./sv";
export { tAttr, tSkill, tRace, tClass, tReligion, tBodyPart } from "./game-terms";
export type { UiTextOverrides } from "./overrides";

const translations: Record<Locale, Record<TranslationKey, string>> = { sv, en };

/** All translation keys (for the admin UI-text editor + override validation). */
export const TRANSLATION_KEYS: readonly TranslationKey[] = Object.keys(sv) as TranslationKey[];

export function translate(key: TranslationKey, locale: Locale, vars?: Record<string, string | number>): string {
  // Fallback chain: admin DB override → locale dict → Swedish dict → raw key.
  let text = getUiOverride(locale, key) ?? translations[locale][key] ?? translations.sv[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return {
    t: (key: TranslationKey, vars?: Record<string, string | number>) => translate(key, locale, vars),
    locale,
  };
}
