"use client";

import { create } from "zustand";

interface SidebarState {
  collapsed: boolean;
  hydrated: boolean;
  mobileOpen: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
  hydrate: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  hydrated: false,
  mobileOpen: false,
  toggle: () =>
    set((state) => {
      const next = !state.collapsed;
      localStorage.setItem("sidebar-collapsed", String(next));
      return { collapsed: next };
    }),
  setCollapsed: (collapsed) => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
    set({ collapsed });
  },
  setMobileOpen: (mobileOpen) => set({ mobileOpen }),
  toggleMobile: () => set((state) => ({ mobileOpen: !state.mobileOpen })),
  hydrate: () => {
    const stored = localStorage.getItem("sidebar-collapsed");
    set({ collapsed: stored === "true", hydrated: true });
  },
}));
