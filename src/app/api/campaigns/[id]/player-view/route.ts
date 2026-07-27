import { NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { getPlayerCampaignView } from "@/lib/db/queries/campaigns";
import type { PlayerCampaignView } from "@/lib/db/queries/campaigns";
import { SessionDataSchema, VISIBLE_TO_ALL } from "@/lib/schemas/session";

type Params = { params: Promise<{ id: string }> };

function isVisibleTo(visibleTo: string | string[], characterName: string): boolean {
  if (visibleTo === VISIBLE_TO_ALL) return true;
  if (Array.isArray(visibleTo)) return visibleTo.includes(VISIBLE_TO_ALL) || visibleTo.includes(characterName);
  return visibleTo === characterName;
}

function filterSessionForPlayer(
  data: Record<string, unknown>,
  characterName: string,
): Record<string, unknown> {
  const parsed = SessionDataSchema.safeParse(data);
  if (!parsed.success) return {};
  const d = parsed.data;

  return {
    hook: d.hook,
    prolog: d.prolog,
    // `notes` på npc/place/item/equipment är DM-privata - strippa dem här
    // (encounters fältstrippas redan nedan).
    npcs: d.npcs
      .filter((n) => n.status === "used" && isVisibleTo(n.visibleTo, characterName))
      .map(({ notes: _notes, ...n }) => n),
    places: d.places
      .filter((p) => p.visited && isVisibleTo(p.visibleTo, characterName))
      .map(({ notes: _notes, ...p }) => p),
    // Encounters: only ones that have actually started/finished and are visible.
    // Strip DM-only fields (enemies, tactics, loot, notes) - players see name/place only.
    encounters: d.encounters
      .filter((e) => e.status !== "planned" && isVisibleTo(e.visibleTo, characterName))
      .map((e) => ({ name: e.name, location: e.location, status: e.status })),
    // An item explicitly handed to this character is always visible to them;
    // otherwise it must have been found in the world AND be visible.
    items: d.items
      .filter((it) => it.givenTo === characterName || (it.found && isVisibleTo(it.visibleTo, characterName)))
      .map(({ notes: _notes, ...it }) => it),
    equipment: d.equipment
      .filter((eq) => eq.givenTo === characterName || isVisibleTo(eq.visibleTo, characterName))
      .map(({ notes: _notes, ...eq }) => eq),
    readAloud: d.readAloud.filter((r) => r.read && isVisibleTo(r.visibleTo, characterName)),
    eventLog: d.eventLog.filter((e) => isVisibleTo(e.visibleTo, characterName)),
    turningPoints: d.turningPoints.filter((tp) => isVisibleTo(tp.visibleTo, characterName)),
    sessionNotes: { followUp: d.sessionNotes.followUp },
  };
}

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const campaignId = Number(id);
  if (Number.isNaN(campaignId)) {
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
  }

  const view = await getPlayerCampaignView(campaignId, session.user.id);
  if (!view) {
    return NextResponse.json({ error: "Inte medlem i kampanjen" }, { status: 404 });
  }

  const characterName = view.myCharacter?.name ?? "";

  const filteredSessions = view.sessions.map((s) => ({
    id: s.id,
    sessionNumber: s.sessionNumber,
    title: s.title,
    date: s.date,
    status: s.status,
    data: filterSessionForPlayer(s.data, characterName),
  }));

  return NextResponse.json({
    campaign: view.campaign,
    party: view.party,
    myCharacter: view.myCharacter,
    sessions: filteredSessions,
  });
}
