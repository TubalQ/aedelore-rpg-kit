"use client";

import { useSession } from "next-auth/react";
import { signOutAfterSaving } from "@/hooks/useAutoLogout";
import { LogOut, User, Menu } from "lucide-react";
import { useSidebarStore } from "@/stores/sidebar-store";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/lib/i18n";

export function Header() {
  const { data: session } = useSession();
  const { t } = useT();
  const { collapsed, mobileOpen, toggleMobile } = useSidebarStore();

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-bg-surface/80 backdrop-blur-sm px-4 md:px-6 transition-all duration-200",
        "left-0 md:left-60",
        collapsed && "md:left-16"
      )}
    >
      <button
        onClick={toggleMobile}
        className="p-2 rounded-md text-text-muted hover:text-text-base hover:bg-bg-elevated transition-colors md:hidden"
        aria-label={t("nav.menu")}
        aria-expanded={mobileOpen}
        aria-controls="mobile-nav"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-2 md:gap-3">
        <ThemeToggle />
        {session?.user && (
          <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm text-text-muted">
            <User size={16} />
            <span className="truncate max-w-[120px]">{session.user.name || session.user.email}</span>
          </div>
          <button
            onClick={() => void signOutAfterSaving("/login")}
            aria-label={t("nav.signOut")}
            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-text-muted hover:text-accent-red hover:bg-bg-elevated transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11 justify-center"
          >
            <LogOut size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{t("nav.signOut")}</span>
          </button>
          </div>
        )}
      </div>
    </header>
  );
}
