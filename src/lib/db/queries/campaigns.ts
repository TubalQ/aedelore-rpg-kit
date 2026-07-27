import { eq, ne, and, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { campaigns, campaignPlayers, gameSessions, characters, campaignItems } from "@/lib/db/schema";
import type { CampaignWithCounts, CampaignPlayer } from "@/lib/schemas/campaign";
import { CharacterDataSchema } from "@/lib/schemas/character";
import type { CharacterData } from "@/lib/schemas/character";
import crypto from "crypto";

export async function getCampaignsByUser(userId: string): Promise<CampaignWithCounts[]> {
  const dmRows = await db.execute(sql`
    SELECT c.*, 'dm' AS role,
      (SELECT COUNT(*) FROM game_sessions gs WHERE gs.campaign_id = c.id AND gs.deleted_at IS NULL) AS session_count,
      (SELECT COUNT(*) FROM campaign_players cp WHERE cp.campaign_id = c.id) AS player_count,
      (SELECT gs.id FROM game_sessions gs WHERE gs.campaign_id = c.id AND gs.deleted_at IS NULL AND gs.status = 'active' ORDER BY gs.session_number DESC LIMIT 1) AS last_active_session_id
    FROM campaigns c
    WHERE c.user_id = ${userId} AND c.deleted_at IS NULL
  `);

  const playerRows = await db.execute(sql`
    SELECT c.*, 'player' AS role,
      (SELECT COUNT(*) FROM game_sessions gs WHERE gs.campaign_id = c.id AND gs.deleted_at IS NULL) AS session_count,
      (SELECT COUNT(*) FROM campaign_players cp WHERE cp.campaign_id = c.id) AS player_count,
      (SELECT gs.id FROM game_sessions gs WHERE gs.campaign_id = c.id AND gs.deleted_at IS NULL AND gs.status = 'active' ORDER BY gs.session_number DESC LIMIT 1) AS last_active_session_id
    FROM campaigns c
    JOIN campaign_players cp ON cp.campaign_id = c.id
    WHERE cp.user_id = ${userId} AND c.deleted_at IS NULL
  `);

  const seen = new Set<number>();
  const allRows: typeof dmRows extends Iterable<infer T> ? T[] : never[] = [];
  for (const r of dmRows) {
    seen.add(r.id as number);
    allRows.push(r);
  }
  for (const r of playerRows) {
    if (!seen.has(r.id as number)) allRows.push(r);
  }
  allRows.sort((a, b) => new Date(b.updated_at as string).getTime() - new Date(a.updated_at as string).getTime());

  return allRows.map((r) => ({
    id: r.id as number,
    userId: r.user_id as string,
    name: r.name as string,
    description: r.description as string | null,
    shareCode: r.share_code as string | null,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
    deletedAt: r.deleted_at ? new Date(r.deleted_at as string) : null,
    sessionCount: Number(r.session_count),
    playerCount: Number(r.player_count),
    role: r.role as "dm" | "player",
    lastActiveSessionId: r.last_active_session_id ? Number(r.last_active_session_id) : null,
  }));
}

export async function getCampaignById(id: number, userId: string) {
  const rows = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.id, id),
        eq(campaigns.userId, userId),
        isNull(campaigns.deletedAt),
      ),
    );
  return rows[0] ?? null;
}

export async function createCampaign(
  userId: string,
  name: string,
  description: string,
) {
  const rows = await db
    .insert(campaigns)
    .values({ userId, name, description })
    .returning();
  return rows[0];
}

export async function updateCampaign(
  id: number,
  userId: string,
  updates: { name?: string; description?: string },
) {
  const setClause: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) setClause.name = updates.name;
  if (updates.description !== undefined) setClause.description = updates.description;

  const rows = await db
    .update(campaigns)
    .set(setClause)
    .where(
      and(
        eq(campaigns.id, id),
        eq(campaigns.userId, userId),
        isNull(campaigns.deletedAt),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function softDeleteCampaign(id: number, userId: string) {
  const now = new Date();
  // Atomic (#6): campaign + its sessions are deleted together or not at all.
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(campaigns)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(campaigns.id, id),
          eq(campaigns.userId, userId),
          isNull(campaigns.deletedAt),
        ),
      )
      .returning();

    if (rows[0]) {
      await tx
        .update(gameSessions)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            eq(gameSessions.campaignId, id),
            isNull(gameSessions.deletedAt),
          ),
        );
    }

    return rows[0] ?? null;
  });
}

export async function getDeletedCampaigns(userId: string) {
  return db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.userId, userId), sql`${campaigns.deletedAt} IS NOT NULL`));
}

export async function restoreCampaign(id: number, userId: string) {
  const now = new Date();

  // Atomic (#6): read the cascade timestamp and restore campaign + its sessions
  // in one transaction so a crash can't leave the campaign restored but its
  // sessions still hidden.
  return db.transaction(async (tx) => {
    // Capture the campaign's deletedAt so we restore ONLY sessions that were
    // cascade-deleted together with the campaign (same timestamp), not sessions
    // that were independently deleted earlier.
    const [existing] = await tx
      .select({ deletedAt: campaigns.deletedAt })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.id, id),
          eq(campaigns.userId, userId),
          sql`${campaigns.deletedAt} IS NOT NULL`,
        ),
      );
    if (!existing) return null;

    const rows = await tx
      .update(campaigns)
      .set({ deletedAt: null, updatedAt: now })
      .where(
        and(
          eq(campaigns.id, id),
          eq(campaigns.userId, userId),
          sql`${campaigns.deletedAt} IS NOT NULL`,
        ),
      )
      .returning();

    if (rows[0] && existing.deletedAt) {
      await tx
        .update(gameSessions)
        .set({ deletedAt: null, updatedAt: now })
        .where(
          and(
            eq(gameSessions.campaignId, id),
            eq(gameSessions.deletedAt, existing.deletedAt),
          ),
        );
    }

    return rows[0] ?? null;
  });
}

export async function permanentDeleteCampaign(id: number, userId: string) {
  const rows = await db
    .delete(campaigns)
    .where(
      and(
        eq(campaigns.id, id),
        eq(campaigns.userId, userId),
        sql`${campaigns.deletedAt} IS NOT NULL`,
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function generateShareCode(id: number, userId: string): Promise<string | null> {
  const campaign = await getCampaignById(id, userId);
  if (!campaign) return null;

  if (campaign.shareCode) return campaign.shareCode;

  const code = crypto.randomBytes(4).toString("hex").toUpperCase();
  await db
    .update(campaigns)
    .set({ shareCode: code })
    .where(eq(campaigns.id, id));

  return code;
}

export async function revokeShareCode(id: number, userId: string): Promise<boolean> {
  const campaign = await getCampaignById(id, userId);
  if (!campaign) return false;

  // Atomic (#6): clearing the code, kicking players and detaching their
  // characters must all land together - a partial revoke would leave players
  // attached to a campaign whose invite was supposedly withdrawn.
  await db.transaction(async (tx) => {
    await tx
      .update(campaigns)
      .set({ shareCode: null })
      .where(eq(campaigns.id, id));

    await tx
      .delete(campaignPlayers)
      .where(eq(campaignPlayers.campaignId, id));

    // Revoking kicks every player, so detach their characters too (mirrors
    // leaveCampaign / removePlayer). The DM's own attached character stays.
    await tx
      .update(characters)
      .set({ campaignId: null, updatedAt: new Date() })
      .where(
        and(
          eq(characters.campaignId, id),
          ne(characters.userId, campaign.userId),
        ),
      );
  });

  return true;
}

export async function joinCampaign(
  shareCode: string,
  userId: string,
  characterId?: number,
): Promise<{ campaignId: number; campaignName: string } | { error: string }> {
  const rows = await db
    .select()
    .from(campaigns)
    .where(
      and(
        eq(campaigns.shareCode, shareCode.toUpperCase()),
        isNull(campaigns.deletedAt),
      ),
    );

  const campaign = rows[0];
  if (!campaign) return { error: "Ogiltig delningskod" };
  if (campaign.userId === userId) return { error: "Du äger denna kampanj" };

  const existing = await db
    .select()
    .from(campaignPlayers)
    .where(
      and(
        eq(campaignPlayers.campaignId, campaign.id),
        eq(campaignPlayers.userId, userId),
      ),
    );

  if (existing.length > 0) return { error: "Du har redan gått med i denna kampanj" };

  // Atomic (#6): join the campaign and attach the chosen character together so a
  // failure can't leave the player "in" the campaign with no character attached.
  await db.transaction(async (tx) => {
    await tx
      .insert(campaignPlayers)
      .values({ campaignId: campaign.id, userId });

    // Attach the chosen character so it enters the party and the DM can control
    // it. Owner-scoped so a player can only bring their own character.
    if (characterId !== undefined) {
      await tx
        .update(characters)
        .set({ campaignId: campaign.id, updatedAt: new Date() })
        .where(
          and(
            eq(characters.id, characterId),
            eq(characters.userId, userId),
            isNull(characters.deletedAt),
          ),
        );
    }
  });

  return { campaignId: campaign.id, campaignName: campaign.name };
}

export async function leaveCampaign(campaignId: number, userId: string): Promise<boolean> {
  // Atomic (#6): leaving and detaching the player's characters happen together.
  return db.transaction(async (tx) => {
    const rows = await tx
      .delete(campaignPlayers)
      .where(
        and(
          eq(campaignPlayers.campaignId, campaignId),
          eq(campaignPlayers.userId, userId),
        ),
      )
      .returning();

    // Detach this player's characters from the campaign so they no longer appear
    // in the party / DM control after leaving.
    if (rows.length > 0) {
      await tx
        .update(characters)
        .set({ campaignId: null, updatedAt: new Date() })
        .where(and(eq(characters.campaignId, campaignId), eq(characters.userId, userId)));
    }

    return rows.length > 0;
  });
}

export async function getCampaignPlayers(
  campaignId: number,
  userId: string,
): Promise<CampaignPlayer[] | null> {
  const campaign = await db
    .select({ id: campaigns.id, userId: campaigns.userId })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), isNull(campaigns.deletedAt)));

  if (campaign.length === 0) return null;

  const isDm = campaign[0].userId === userId;
  if (!isDm) {
    const membership = await db
      .select()
      .from(campaignPlayers)
      .where(
        and(
          eq(campaignPlayers.campaignId, campaignId),
          eq(campaignPlayers.userId, userId),
        ),
      );
    if (membership.length === 0) return null;
  }

  const rows = await db.execute(sql`
    SELECT
      u.id,
      u.username,
      cp.joined_at,
      c.id AS character_id,
      c.name AS character_name,
      c.data AS character_data
    FROM users u
    JOIN campaign_players cp ON u.id = cp.user_id
    LEFT JOIN characters c ON c.user_id = u.id AND c.campaign_id = ${campaignId} AND c.deleted_at IS NULL
    WHERE cp.campaign_id = ${campaignId}
    ORDER BY cp.joined_at
  `);

  return Array.from(rows).map((r) => {
    const data = r.character_data as Record<string, unknown> | null;
    return {
      id: r.id as string,
      username: r.username as string | null,
      joinedAt: new Date(r.joined_at as string),
      character: r.character_id
        ? {
            id: r.character_id as number,
            name: r.character_name as string,
            race: (data?.race as string) ?? null,
            class: (data?.class as string) ?? null,
          }
        : null,
    };
  });
}

export interface CampaignCharacter {
  id: number;
  name: string;
  playerName: string | null;
  playerId: string;
  data: CharacterData;
  xp: number;
  xpSpent: number;
  raceClassLocked: boolean;
  attributesLocked: boolean;
  abilitiesLocked: boolean;
}

export async function getCampaignCharacters(
  campaignId: number,
  dmUserId: string,
): Promise<CampaignCharacter[] | null> {
  const campaign = await getCampaignById(campaignId, dmUserId);
  if (!campaign) return null;

  const rows = await db.execute(sql`
    SELECT
      c.id, c.name, c.data, c.xp, c.xp_spent,
      c.race_class_locked, c.attributes_locked, c.abilities_locked,
      u.id AS player_id, u.username AS player_name
    FROM characters c
    JOIN users u ON c.user_id = u.id
    WHERE c.campaign_id = ${campaignId} AND c.deleted_at IS NULL
    ORDER BY c.name
  `);

  return Array.from(rows).map((r) => {
    const parsed = CharacterDataSchema.safeParse(r.data ?? {});
    return {
      id: r.id as number,
      name: r.name as string,
      playerName: r.player_name as string | null,
      playerId: r.player_id as string,
      data: parsed.success ? parsed.data : CharacterDataSchema.parse({}),
      xp: r.xp as number,
      xpSpent: r.xp_spent as number,
      raceClassLocked: r.race_class_locked as boolean,
      attributesLocked: r.attributes_locked as boolean,
      abilitiesLocked: r.abilities_locked as boolean,
    };
  });
}

export interface PlayerCampaignView {
  campaign: {
    id: number;
    name: string;
    description: string | null;
    dmName: string | null;
  };
  party: { name: string; race: string | null; class: string | null }[];
  myCharacter: { id: number; name: string; xp: number; xpSpent: number } | null;
  sessions: {
    id: number;
    sessionNumber: number;
    title: string | null;
    date: string | null;
    status: string;
    data: Record<string, unknown>;
  }[];
}

export async function getPlayerCampaignView(
  campaignId: number,
  playerId: string,
): Promise<PlayerCampaignView | null> {
  // Medlem i kampanjen, eller dess DM (för "visa som spelare"-förhandsgranskning)
  const memberCheck = await db.execute(sql`
    SELECT cp.user_id
    FROM campaign_players cp
    WHERE cp.campaign_id = ${campaignId} AND cp.user_id = ${playerId}
    UNION
    SELECT c.user_id
    FROM campaigns c
    WHERE c.id = ${campaignId} AND c.user_id = ${playerId} AND c.deleted_at IS NULL
  `);
  if (Array.from(memberCheck).length === 0) return null;

  const campaignRows = await db.execute(sql`
    SELECT c.id, c.name, c.description, u.username AS dm_name
    FROM campaigns c
    JOIN users u ON c.user_id = u.id
    WHERE c.id = ${campaignId} AND c.deleted_at IS NULL
  `);
  const camp = Array.from(campaignRows)[0];
  if (!camp) return null;

  const partyRows = await db.execute(sql`
    SELECT ch.name, ch.data
    FROM characters ch
    WHERE ch.campaign_id = ${campaignId} AND ch.deleted_at IS NULL
    ORDER BY ch.name
  `);

  const party = Array.from(partyRows).map((r) => {
    const d = r.data as Record<string, unknown> | null;
    return {
      name: r.name as string,
      race: (d?.race as string) ?? null,
      class: (d?.class as string) ?? null,
    };
  });

  const myCharRow = await db.execute(sql`
    SELECT ch.id, ch.name, ch.xp, ch.xp_spent
    FROM characters ch
    WHERE ch.campaign_id = ${campaignId}
      AND ch.user_id = ${playerId}
      AND ch.deleted_at IS NULL
    LIMIT 1
  `);
  const myChar = Array.from(myCharRow)[0];

  const sessionRows = await db.execute(sql`
    SELECT gs.id, gs.session_number, gs.title, gs.date, gs.status, gs.data
    FROM game_sessions gs
    WHERE gs.campaign_id = ${campaignId}
      AND gs.deleted_at IS NULL
      AND (gs.status = 'locked' OR gs.id = (
        SELECT g2.id FROM game_sessions g2
        WHERE g2.campaign_id = ${campaignId} AND g2.deleted_at IS NULL AND g2.status = 'active'
        ORDER BY g2.session_number DESC LIMIT 1
      ))
    ORDER BY gs.session_number
  `);

  return {
    campaign: {
      id: camp.id as number,
      name: camp.name as string,
      description: camp.description as string | null,
      dmName: camp.dm_name as string | null,
    },
    party,
    myCharacter: myChar
      ? {
          id: myChar.id as number,
          name: myChar.name as string,
          xp: (myChar.xp as number) ?? 0,
          xpSpent: (myChar.xp_spent as number) ?? 0,
        }
      : null,
    sessions: Array.from(sessionRows).map((r) => ({
      id: r.id as number,
      sessionNumber: r.session_number as number,
      title: r.title as string | null,
      date: r.date as string | null,
      status: r.status as string,
      data: r.data as Record<string, unknown>,
    })),
  };
}

export async function removePlayer(
  campaignId: number,
  playerId: string,
  dmUserId: string,
): Promise<boolean> {
  const campaign = await getCampaignById(campaignId, dmUserId);
  if (!campaign) return false;

  // Atomic (#6): removing the player and detaching their characters together.
  return db.transaction(async (tx) => {
    const rows = await tx
      .delete(campaignPlayers)
      .where(
        and(
          eq(campaignPlayers.campaignId, campaignId),
          eq(campaignPlayers.userId, playerId),
        ),
      )
      .returning();

    // Detach the removed player's characters from the campaign.
    if (rows.length > 0) {
      await tx
        .update(characters)
        .set({ campaignId: null, updatedAt: new Date() })
        .where(and(eq(characters.campaignId, campaignId), eq(characters.userId, playerId)));
    }

    return rows.length > 0;
  });
}

// ─── Campaign item box (förråd) ──────────────────────────────

/** Kollar att userId är DM (ägare) för kampanjen. Returnerar kampanj-id eller null. */
async function verifyDmOwnsCampaign(campaignId: number, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId), isNull(campaigns.deletedAt)));
  return rows.length > 0;
}

/** Lådans föremål (endast DM). Null om inte DM/kampanj saknas. */
export async function getCampaignBox(campaignId: number, userId: string) {
  if (!(await verifyDmOwnsCampaign(campaignId, userId))) return null;
  const rows = await db
    .select({ id: campaignItems.id, kind: campaignItems.kind, data: campaignItems.data, sortOrder: campaignItems.sortOrder })
    .from(campaignItems)
    .where(eq(campaignItems.campaignId, campaignId))
    .orderBy(campaignItems.sortOrder, campaignItems.id);
  return rows;
}

/** Lägg till ett föremål i lådan. */
export async function addCampaignBoxItem(
  campaignId: number,
  userId: string,
  kind: "quest" | "equipment",
  data: Record<string, unknown>,
) {
  if (!(await verifyDmOwnsCampaign(campaignId, userId))) return null;
  const [row] = await db
    .insert(campaignItems)
    .values({ campaignId, kind, data })
    .returning();
  return row ?? null;
}

/** Ta bort ett föremål ur lådan. */
export async function removeCampaignBoxItem(campaignId: number, userId: string, itemId: number) {
  if (!(await verifyDmOwnsCampaign(campaignId, userId))) return null;
  const rows = await db
    .delete(campaignItems)
    .where(and(eq(campaignItems.id, itemId), eq(campaignItems.campaignId, campaignId)))
    .returning();
  return rows[0] ?? null;
}

/** Hämta ett enskilt låd-föremål (för utdelning). */
export async function getCampaignBoxItem(campaignId: number, userId: string, itemId: number) {
  if (!(await verifyDmOwnsCampaign(campaignId, userId))) return null;
  const rows = await db
    .select({ id: campaignItems.id, kind: campaignItems.kind, data: campaignItems.data })
    .from(campaignItems)
    .where(and(eq(campaignItems.id, itemId), eq(campaignItems.campaignId, campaignId)));
  return rows[0] ?? null;
}
