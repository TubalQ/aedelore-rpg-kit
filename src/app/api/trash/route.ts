import { NextResponse } from "next/server";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { getDeletedCharacters } from "@/lib/db/queries/characters";
import { getDeletedCampaigns } from "@/lib/db/queries/campaigns";
import { getDeletedSessions } from "@/lib/db/queries/sessions";
import { getDeletedBooks, getDeletedChapters, getDeletedPages } from "@/lib/db/queries/wiki";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [characters, campaigns, sessions] = await Promise.all([
    getDeletedCharacters(session.user.id),
    getDeletedCampaigns(session.user.id),
    getDeletedSessions(session.user.id),
  ]);

  if (session.user.isAdmin) {
    const [wikiBooks, wikiChapters, wikiPages] = await Promise.all([
      getDeletedBooks(),
      getDeletedChapters(),
      getDeletedPages(),
    ]);
    return NextResponse.json({ characters, campaigns, sessions, wikiBooks, wikiChapters, wikiPages });
  }

  return NextResponse.json({ characters, campaigns, sessions, wikiBooks: [], wikiChapters: [], wikiPages: [] });
}
