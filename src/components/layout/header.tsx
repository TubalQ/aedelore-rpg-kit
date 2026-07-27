"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, User, Menu } from "lucide-react";
import { useSidebarStore } from "@/stores/sidebar-store";
import { cn } from "@/lib/utils/cn";

export function Header() {
  const { data: session } = useSession();
  const { collapsed, toggleMobile } = useSidebarStore();

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
        aria-label="Menu"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1" />

      {session?.user && (
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm text-text-muted">
            <User size={16} />
            <span className="truncate max-w-[120px]">{session.user.name || session.user.email}</span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-accent-red hover:bg-bg-elevated transition-colors"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Logga ut</span>
          </button>
        </div>
      )}
    </header>
  );
}
