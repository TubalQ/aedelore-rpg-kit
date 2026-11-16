import type { SessionData } from "@/lib/schemas/session";

// The session editor keeps its own copy of the session. The stashId a new
// item or piece of equipment got on save has to reach that copy at once, also
// while the list is still being edited: without it the next save links by
// name, and a renamed entry becomes a second stash entry. (Everything else
// from the server, stash content included, reaches the copy per key through
// reconcileSessionData in ./reconcile.ts.)

type Linked = { stashId: number | null; name: string };

const norm = (s: string): string => s.trim().toLowerCase();
// A name typed on while its save was in flight still continues the saved one.
const sameThing = (local: string, saved: string): boolean =>
  norm(local).startsWith(norm(saved)) || norm(saved).startsWith(norm(local));

function adopt<T extends Linked>(local: T[], saved: Linked[]): T[] {
  // An id another local card already carries belongs to that card (an existing
  // placement, or one shifted to this index by a change made elsewhere).
  // Adopting it would make this card write over that entry on the next save (S2).
  const taken = new Set(local.map((el) => el.stashId).filter((id): id is number => typeof id === "number"));
  let changed = false;
  const next = local.map((el, i) => {
    const s = saved[i];
    if (el.stashId || !s?.stashId || taken.has(s.stashId) || !el.name.trim() || !sameThing(el.name, s.name)) return el;
    taken.add(s.stashId);
    changed = true;
    return { ...el, stashId: s.stashId };
  });
  return changed ? next : local;
}

/** Gives new local items/equipment the stashId the server linked them to. */
export function adoptStashIds(local: SessionData, saved: Pick<SessionData, "items" | "equipment">): SessionData {
  const items = adopt(local.items, saved.items);
  const equipment = adopt(local.equipment, saved.equipment);
  return items === local.items && equipment === local.equipment ? local : { ...local, items, equipment };
}
