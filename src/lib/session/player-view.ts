import { SessionDataSchema, isGivenTo, isVisibleTo } from "@/lib/schemas/session";

// What a player sees of one session: only what was revealed to everyone or to
// their character, without the DM's private fields. This is the one place
// players' access to session content is decided (the player-view route is
// their only way to session data).

export function filterSessionForPlayer(
  data: Record<string, unknown>,
  characterName: string | null,
): Record<string, unknown> {
  const parsed = SessionDataSchema.safeParse(data);
  if (!parsed.success) return {};
  const d = parsed.data;

  // Only the fields a player is shown (S15). Everything else stays with the
  // DM: visibleTo (who else was shown it), plannedLocation and linkedTo (can
  // name places and people not revealed yet), stashId, day/time, notes.
  return {
    hook: d.hook,
    prolog: d.prolog,
    npcs: d.npcs
      .filter((n) => n.status === "used" && isVisibleTo(n.visibleTo, characterName))
      .map((n) => ({ name: n.name, role: n.role, description: n.description, disposition: n.disposition })),
    places: d.places
      .filter((p) => p.visited && isVisibleTo(p.visibleTo, characterName))
      .map((p) => ({ name: p.name, description: p.description })),
    // Encounters: only ones that have actually started/finished and are visible.
    encounters: d.encounters
      .filter((e) => e.status !== "planned" && isVisibleTo(e.visibleTo, characterName))
      .map((e) => ({ name: e.name, location: e.location, status: e.status })),
    // An item explicitly handed to this character is always visible to them;
    // otherwise it must have been found in the world AND be visible. Holders
    // stay: Party finds says who in the party has it.
    items: d.items
      .filter((it) => isGivenTo(it.givenTo, characterName) || (it.found && isVisibleTo(it.visibleTo, characterName)))
      .map((it) => ({ name: it.name, description: it.description, found: it.found, givenTo: it.givenTo })),
    equipment: d.equipment
      .filter((eq) => isGivenTo(eq.givenTo, characterName) || isVisibleTo(eq.visibleTo, characterName))
      .map((eq) => ({ name: eq.name, type: eq.type, rarity: eq.rarity, description: eq.description, specialEffect: eq.specialEffect, givenTo: eq.givenTo })),
    readAloud: d.readAloud
      .filter((r) => r.read && isVisibleTo(r.visibleTo, characterName))
      .map((r) => ({ title: r.title, text: r.text })),
    eventLog: d.eventLog.filter((e) => isVisibleTo(e.visibleTo, characterName)).map((e) => ({ text: e.text, timestamp: e.timestamp })),
    turningPoints: d.turningPoints
      .filter((tp) => isVisibleTo(tp.visibleTo, characterName))
      .map((tp) => ({ description: tp.description, consequence: tp.consequence })),
    // `summary` is the DM's "what happened this session" recap - players get it
    // as their story-so-far. `wentWell`/`improve` stay DM-private (GM retro).
    sessionNotes: { summary: d.sessionNotes.summary, followUp: d.sessionNotes.followUp },
  };
}
