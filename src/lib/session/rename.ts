// Rename cascades in the session editor (S3). Renaming a place, scene or NPC
// moves what points at it by name. The editor renames on every keystroke, so:
//
// - An empty old name is never a source. Unplaced content has an empty
//   location, so a cascade from "" pulled all of it into the first place or
//   scene that got a name.
// - Clearing a name to type a new one does not cascade to "". The old name is
//   remembered instead, and the cascade runs from it once the new name starts.
//   A cascade to "" made the content unplaced and it never came back.

export interface RenameStep {
  /** The name to move references from, or null for no cascade. */
  from: string | null;
  /** The name to remember while this entry has no name, or null to forget. */
  remember: string | null;
}

/** Decides one rename step. `remembered` is the name kept from when this entry was cleared. */
export function renameStep(oldName: string, newName: string, remembered: string | null): RenameStep {
  const old = oldName.trim() ? oldName : null;
  if (!newName.trim()) return { from: null, remember: old ?? remembered };
  const from = old ?? remembered;
  return { from: from !== null && from !== newName ? from : null, remember: null };
}

/**
 * Name remembered for one entry while it is cleared. Tied to the list length,
 * so an add or remove (which shifts indices) drops it rather than applying it
 * to another entry.
 */
export interface ClearedName {
  index: number;
  length: number;
  name: string;
}

export function rememberedFor(cleared: ClearedName | null, index: number, length: number): string | null {
  return cleared && cleared.index === index && cleared.length === length ? cleared.name : null;
}
