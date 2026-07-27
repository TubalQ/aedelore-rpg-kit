// ─── System registry + active-system selection ──────────
//
// Register every available system here. The active one is
// chosen at build/runtime via NEXT_PUBLIC_ACTIVE_SYSTEM
// (defaults to "example"). The domain layer reads its data
// from `activeSystem`, so swapping systems needs NO code
// changes - only this env var.
//
// To add your own game, copy src/systems/example to
// src/systems/<name>, register it below, and set the env var.
// See docs/BUILD-YOUR-OWN-SYSTEM.md.

import type { GameSystem } from "@/systems/types";
import { example } from "@/systems/example";

export const SYSTEMS: Readonly<Record<string, GameSystem>> = {
  example,
};

// Single source of truth for the default system id. The server loaders
// (systems/load.ts, lib/db/queries/system-data.ts) import this too, so the
// client domain layer and the server can never disagree on the active system.
export const DEFAULT_SYSTEM = "example";

const requested = process.env.NEXT_PUBLIC_ACTIVE_SYSTEM ?? DEFAULT_SYSTEM;

export const activeSystem: GameSystem = SYSTEMS[requested] ?? example;

export type { GameSystem } from "@/systems/types";
