import type { Metadata } from "next";
import { Inter, Crimson_Text, Cinzel, EB_Garamond } from "next/font/google";
import { Providers } from "./providers";
import { ThemeScript } from "@/components/theme/theme-script";
import { ThemeHydrator } from "@/components/theme/theme-hydrator";
import Script from "next/script";
import { loadActiveSystem } from "@/systems/load";
import { getSettings } from "@/lib/db/queries/app-settings";
import { getUiText } from "@/lib/db/queries/ui-text";
import { setSystem } from "@/systems/runtime";
import { setUiOverrides } from "@/lib/i18n/overrides";
import { SystemProvider } from "@/components/system/SystemProvider";
import { I18nOverridesProvider } from "@/components/i18n/I18nOverridesProvider";
import { WelcomeNotice } from "@/components/WelcomeNotice";
import "./globals.css";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

// Curated display-font allow-list. Each is bundled via next/font at build time
// (adding a NEW font needs code); an operator SWITCHES between them from the
// theme editor (theme.displayFont). Keys MUST match DISPLAY_FONTS in
// system-admin/specs.ts. --font-display is set per-request from the active theme.
const crimson = Crimson_Text({ variable: "--font-crimson", subsets: ["latin"], weight: ["400", "600", "700"] });
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"], weight: ["400", "600", "700"] });
const garamond = EB_Garamond({ variable: "--font-garamond", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const DISPLAY_FONT_VARS: Record<string, string> = {
  "Crimson Text": "var(--font-crimson)",
  Cinzel: "var(--font-cinzel)",
  "EB Garamond": "var(--font-garamond)",
};

// Live brand metadata from the DB-backed active system.
export async function generateMetadata(): Promise<Metadata> {
  const { theme } = await loadActiveSystem();
  return { title: theme.name, description: theme.description };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

// Game data is loaded from the DB at request time (see loadActiveSystem below),
// so routes must render dynamically rather than be prerendered with build-time
// fallback data. Negligible cost for a self-hosted app; makes live edits show.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Load the active system's data (races/classes/...) from the DB, with the
  // bundled JSON as fallback. Set the server holder for this request and hand
  // the same data to the client provider so the domain proxies are live on
  // both sides.
  const system = await loadActiveSystem();
  setSystem(system);
  const settings = await getSettings();
  // Admin UI-text overrides: set the server holder for this request and hand
  // the same data to the client provider (live in client components).
  const uiOverrides = await getUiText();
  setUiOverrides(uiOverrides);

  return (
    <html
      lang="en"
      className={`${inter.variable} ${crimson.variable} ${cinzel.variable} ${garamond.variable} h-full antialiased dark`}
      style={
        {
          "--color-accent-gold": system.theme.accentColor,
          "--color-accent-gold-dim": system.theme.accentColorDim,
          "--font-display": DISPLAY_FONT_VARS[system.theme.displayFont] ?? "var(--font-crimson)",
        } as React.CSSProperties
      }
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-bg-base text-text-base">
        <ThemeScript palettes={system.palettes} />
        {/* First-party Umami analytics - only when an analytics id is set in the
            instance settings (DB). No env var; configured from the admin UI. */}
        {settings.analyticsId && (
          <Script
            src="/stats.js"
            data-website-id={settings.analyticsId}
            strategy="afterInteractive"
          />
        )}
        <Providers>
          <ThemeHydrator />
          <I18nOverridesProvider overrides={uiOverrides}>
            <SystemProvider system={system}>{children}</SystemProvider>
          </I18nOverridesProvider>
        </Providers>
        {/* Attribution card for kit-based instances (the Apache NOTICE, shown
            in-app). Hidden on Aedelore itself, which IS the origin; shown on the
            example shell and any system built on the kit. Dismissable. */}
        {system.id !== "aedelore" && <WelcomeNotice />}
      </body>
    </html>
  );
}
