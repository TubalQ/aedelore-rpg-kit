"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Swords,
  BookOpen,
  Settings,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Languages,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSidebarStore } from "@/stores/sidebar-store";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

const NAV_ITEMS: { href: string; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { href: "/dashboard", labelKey: "sidebar.home", icon: Home },
  { href: "/characters", labelKey: "sidebar.characters", icon: Users },
  { href: "/campaigns", labelKey: "sidebar.campaigns", icon: Swords },
  { href: "/wiki", labelKey: "sidebar.wiki", icon: BookOpen },
  { href: "/trash", labelKey: "sidebar.trash", icon: Trash2 },
  { href: "/settings", labelKey: "sidebar.settings", icon: Settings },
];

export function Sidebar() {
  const { t } = useT();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { collapsed, mobileOpen, toggle, setMobileOpen, hydrate } = useSidebarStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const navContent = (
    <>
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        {(!collapsed || mobileOpen) && (
          <Link href="/dashboard" className="font-[family-name:var(--font-display)] text-xl font-bold text-accent-gold">
            Aedelore
          </Link>
        )}
        <button
          onClick={() => {
            if (mobileOpen) {
              setMobileOpen(false);
            } else {
              toggle();
            }
          }}
          className="p-2 rounded-md text-text-muted hover:text-text-base hover:bg-bg-elevated transition-colors"
          aria-label={mobileOpen ? t("sidebar.collapse") : collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
        >
          {mobileOpen ? <X size={18} /> : collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
          const label = t(labelKey);
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-gold/10 text-accent-gold"
                  : "text-text-muted hover:text-text-base hover:bg-bg-elevated"
              )}
              title={collapsed && !mobileOpen ? label : undefined}
            >
              <Icon size={20} className="shrink-0" />
              {(!collapsed || mobileOpen) && <span>{label}</span>}
            </Link>
          );
        })}
        {session?.user?.isAdmin && (
          <>
            <div className="h-px bg-border mx-3 my-2" />
            <Link
              href="/wiki-admin"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === "/wiki-admin" || pathname.startsWith("/wiki-admin/")
                  ? "bg-accent-gold/10 text-accent-gold"
                  : "text-text-muted hover:text-text-base hover:bg-bg-elevated"
              )}
              title={collapsed && !mobileOpen ? t("sidebar.wikiAdmin") : undefined}
            >
              <ShieldCheck size={20} className="shrink-0" />
              {(!collapsed || mobileOpen) && <span>{t("sidebar.wikiAdmin")}</span>}
            </Link>
            <Link
              href="/system-admin"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === "/system-admin" || pathname.startsWith("/system-admin/")
                  ? "bg-accent-gold/10 text-accent-gold"
                  : "text-text-muted hover:text-text-base hover:bg-bg-elevated"
              )}
              title={collapsed && !mobileOpen ? "Game system" : undefined}
            >
              <Swords size={20} className="shrink-0" />
              {(!collapsed || mobileOpen) && <span>Game system</span>}
            </Link>
            <Link
              href="/settings-admin"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === "/settings-admin"
                  ? "bg-accent-gold/10 text-accent-gold"
                  : "text-text-muted hover:text-text-base hover:bg-bg-elevated"
              )}
              title={collapsed && !mobileOpen ? "Instance settings" : undefined}
            >
              <Settings size={20} className="shrink-0" />
              {(!collapsed || mobileOpen) && <span>Instance settings</span>}
            </Link>
            <Link
              href="/ui-text-admin"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === "/ui-text-admin"
                  ? "bg-accent-gold/10 text-accent-gold"
                  : "text-text-muted hover:text-text-base hover:bg-bg-elevated"
              )}
              title={collapsed && !mobileOpen ? "UI text" : undefined}
            >
              <Languages size={20} className="shrink-0" />
              {(!collapsed || mobileOpen) && <span>UI text</span>}
            </Link>
          </>
        )}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar (overlay) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-bg-surface transition-transform duration-200 w-60 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden md:flex flex-col border-r border-border bg-bg-surface transition-all duration-200",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
