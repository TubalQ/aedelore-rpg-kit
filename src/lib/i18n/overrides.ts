import type { Locale } from "@/stores/locale-store";

// ─── Runtime holder for admin UI-text overrides ─────────────
//
// Mirrors src/systems/runtime.ts. Admin-set per-locale overrides are layered
// OVER the code translation dictionaries by translate(). One singleton per
// server process (set per request in the root layout) and one per browser tab
// (set by <I18nOverridesProvider> during render). The default is {} - no
// overrides - so translate() behaves exactly as before until an admin sets one.

export type UiTextOverrides = Partial<Record<Locale, Record<string, string>>>;

let current: UiTextOverrides = {};

export function setUiOverrides(o: UiTextOverrides | null | undefined): void {
  current = o ?? {};
}

/** The override for a key in a locale, or undefined to fall through to code. */
export function getUiOverride(locale: Locale, key: string): string | undefined {
  return current[locale]?.[key];
}
