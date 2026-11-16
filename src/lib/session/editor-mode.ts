import type { SessionData } from "@/lib/schemas/session";

export type EditorMode = "prep" | "play";

/**
 * The mode a session opens in (#89, the owner 2026-11-16): Play while an
 * encounter is in progress, so a reload during play lands back at the table;
 * otherwise Planning. A locked session has no mode switch and opens in Planning.
 */
export function initialEditorMode(data: SessionData, locked: boolean): EditorMode {
  if (locked) return "prep";
  return data.encounters.some((e) => e.status === "started") ? "play" : "prep";
}
