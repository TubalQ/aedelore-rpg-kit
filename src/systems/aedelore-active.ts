import { SYSTEMS, activeSystem } from "@/systems";

/**
 * True when the Aedelore game data is the active system. Tests that check
 * Aedelore content (named races, classes, items) skip themselves otherwise,
 * so the public kit, which ships only the `example` system, runs green.
 */
export const aedeloreActive: boolean = SYSTEMS.aedelore !== undefined && activeSystem === SYSTEMS.aedelore;
