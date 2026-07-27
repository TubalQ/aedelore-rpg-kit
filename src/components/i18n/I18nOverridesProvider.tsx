"use client";

import { setUiOverrides } from "@/lib/i18n/overrides";
import type { UiTextOverrides } from "@/lib/i18n/overrides";

// Hydrates the client-side UI-text override holder so useT()/translate() return
// admin-overridden strings in client components. Set synchronously during
// render (before children) so SSR and the first client render agree - no
// hydration mismatch. Mirrors <SystemProvider>. Idempotent.
export function I18nOverridesProvider({
  overrides,
  children,
}: {
  overrides: UiTextOverrides;
  children: React.ReactNode;
}) {
  setUiOverrides(overrides);
  return <>{children}</>;
}
