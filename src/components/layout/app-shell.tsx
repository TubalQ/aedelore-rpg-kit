"use client";

import { type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useAutoLogout } from "@/hooks/useAutoLogout";
import { cn } from "@/lib/utils/cn";

export function AppShell({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebarStore();
  useAutoLogout();

  return (
    <div className="min-h-screen">
      <Sidebar />
      <Header />
      <main
        className={cn(
          "pt-16 min-h-screen transition-all duration-200",
          "pl-0 md:pl-60",
          collapsed && "md:pl-16"
        )}
      >
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
