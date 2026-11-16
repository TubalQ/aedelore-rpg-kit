// Finding the campaign character an AI means by name ("given_to": "arvid ").
// An exact match wins; otherwise a case- and space-insensitive match counts
// when it is the only one. Anything else is an error that lists the names, so
// the AI can retry with the right one instead of the item silently going
// nowhere.

export type CampaignCharacterRef = { id: number; name: string };

export type PickResult =
  | { ok: true; character: CampaignCharacterRef }
  | { ok: false; message: string };

export function pickCharacter(characters: readonly CampaignCharacterRef[], wanted: string): PickResult {
  const exact = characters.filter((c) => c.name === wanted);
  if (exact.length === 1) return { ok: true, character: exact[0] };

  const norm = (s: string): string => s.trim().toLowerCase();
  const loose = characters.filter((c) => norm(c.name) === norm(wanted));
  if (loose.length === 1) return { ok: true, character: loose[0] };

  const list = characters.map((c) => `"${c.name}"`).join(", ") || "none";
  if (exact.length > 1 || loose.length > 1) {
    return { ok: false, message: `More than one character in the campaign is called "${wanted}". Characters: ${list}.` };
  }
  return { ok: false, message: `No character in the campaign is called "${wanted}". Characters: ${list}.` };
}
