"use client";

import { setSystem } from "@/systems/runtime";
import type { GameSystem } from "@/systems/types";

// Hydrates the client-side runtime holder with the DB-loaded active system so
// the domain proxies (RACES, WEAPONS, ...) return live data in client
// components. Set synchronously during render (before children render) so SSR
// and the first client render agree - no hydration mismatch. Idempotent.
export function SystemProvider({
  system,
  children,
}: {
  system: GameSystem;
  children: React.ReactNode;
}) {
  setSystem(system);
  return <>{children}</>;
}
