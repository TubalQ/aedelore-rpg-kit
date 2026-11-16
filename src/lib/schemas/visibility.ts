// Who may see a session entry. `visibleTo` holds "all", "dm", or the names of
// the characters it is shared with; a player sees an entry when their
// character's name is in it. A character must therefore never be called
// "dm" or "all": its name would match the value meant for the DM (or for
// everyone) and its player would see everything hidden from players.

/** "all" = synlig för spelare (när entitetens spelvillkor uppfyllts). */
export const VISIBLE_TO_ALL = "all" as const;
/** "dm" = dold för alla spelare. */
export const VISIBLE_TO_DM = "dm" as const;

const RESERVED = new Set<string>([VISIBLE_TO_ALL, VISIBLE_TO_DM]);

/** A name that is also a visibility value ("dm", " ALL ", ...): never a character's name. */
export function isReservedCharacterName(name: string): boolean {
  return RESERVED.has(name.trim().toLowerCase());
}

export const RESERVED_CHARACTER_NAME_MESSAGE = `"${VISIBLE_TO_DM}" and "${VISIBLE_TO_ALL}" are reserved and cannot be a character's name`;
