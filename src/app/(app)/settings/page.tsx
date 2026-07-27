"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { type ThemeId, resolvePalettes } from "@/lib/domain/themes";
import { getSystem } from "@/systems/runtime";

type PaletteEntry = { label: string; description: string; colors: Record<string, string> };
function livePalettes(): Record<string, PaletteEntry> {
  return resolvePalettes<Record<string, PaletteEntry>>(
    getSystem().palettes as Record<string, PaletteEntry> | undefined,
  );
}
import { useThemeStore } from "@/stores/theme-store";
import { useLocaleStore, type Locale } from "@/stores/locale-store";
import { useToastStore } from "@/stores/toast-store";
import { useT } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { LoginHistorySection } from "./login-history";
import { McpConnectionSection } from "./mcp-connection";

const LOCALE_OPTIONS: { id: Locale; label: string; flag: string }[] = [
  { id: "sv", label: "Svenska", flag: "🇸🇪" },
  { id: "en", label: "English", flag: "🇬🇧" },
];

export default function SettingsPage() {
  const { t } = useT();
  const { themeId, setTheme } = useThemeStore();
  const { locale, setLocale } = useLocaleStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await api("/api/account/delete", { method: "POST" });
      await signOut({ callbackUrl: "/login" });
    } catch {
      useToastStore.getState().addToast(t("settings.deleteError"), "error");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="space-y-12">
      <h1 className="font-display text-2xl text-accent-gold">{t("settings.title")}</h1>

      {/* Language */}
      <section>
        <h2 className="font-display text-lg text-text-base mb-4">{t("settings.language")}</h2>
        <div className="flex gap-3">
          {LOCALE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setLocale(opt.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                locale === opt.id
                  ? "border-accent-gold bg-accent-gold/10 text-accent-gold"
                  : "border-border bg-bg-surface text-text-muted hover:border-border-hover"
              )}
            >
              <span className="text-lg">{opt.flag}</span>
              {opt.label}
              {locale === opt.id && <Check size={14} />}
            </button>
          ))}
        </div>
      </section>

      {/* Theme */}
      <section>
        <h2 className="font-display text-lg text-text-base mb-4">{t("settings.theme")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.keys(livePalettes()).map((id) => (
            <ThemeCard
              key={id}
              id={id}
              palette={livePalettes()[id]}
              active={themeId === id}
              onSelect={setTheme}
            />
          ))}
        </div>
      </section>

      <LoginHistorySection />

      <McpConnectionSection />

      <section>
        <h2 className="font-display text-lg text-red-400 mb-4">{t("settings.dangerZone")}</h2>
        <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4">
          <p className="text-sm text-text-muted mb-4">
            {t("settings.deleteWarning")}
          </p>
          {confirmDelete && (
            <p className="text-sm text-red-400 mb-4">
              {t("settings.deleteConfirmText")}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                confirmDelete
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              )}
            >
              <Trash2 size={14} />
              {deleting ? t("settings.deleting") : confirmDelete ? t("settings.confirmDeletion") : t("settings.deleteAccount")}
            </button>
            {confirmDelete && !deleting && (
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-bg-surface transition-colors"
              >
                {t("common.cancel")}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ThemeCard({
  id,
  palette,
  active,
  onSelect,
}: {
  id: ThemeId;
  palette: PaletteEntry;
  active: boolean;
  onSelect: (id: ThemeId) => void;
}) {
  const theme = palette;
  const c = theme.colors;

  return (
    <button
      onClick={() => onSelect(id)}
      className={cn(
        "relative text-left rounded-lg border p-3 transition-all",
        active
          ? "border-accent-gold ring-1 ring-accent-gold/30"
          : "border-border hover:border-border-hover"
      )}
    >
      {active && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent-gold flex items-center justify-center">
          <Check size={12} className="text-bg-base" />
        </div>
      )}

      <div className="flex gap-1 mb-3">
        <div className="h-8 flex-1 rounded-sm" style={{ background: c["bg-base"] }} />
        <div className="h-8 flex-1 rounded-sm" style={{ background: c["bg-surface"] }} />
        <div className="h-8 flex-1 rounded-sm" style={{ background: c["bg-elevated"] }} />
      </div>

      <div className="flex gap-1 mb-3">
        <div className="h-3 w-3 rounded-full" style={{ background: c["accent-gold"] }} />
        <div className="h-3 w-3 rounded-full" style={{ background: c["accent-purple"] }} />
        <div className="h-3 w-3 rounded-full" style={{ background: c["text-base"] }} />
        <div className="h-3 w-3 rounded-full" style={{ background: c["text-muted"] }} />
      </div>

      <div className="text-sm font-medium text-text-base">{theme.label}</div>
      <div className="text-xs text-text-muted mt-0.5">{theme.description}</div>
    </button>
  );
}
