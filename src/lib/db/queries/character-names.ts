import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { characters } from "@/lib/db/schema";

// A character's name is its key in the campaign: what the DM shares with or
// hands to a character is stored under its name. That is on purpose (the owner
// 2026-11-11): a player who stops and later comes back with a character of
// the same name gets it all back. So two live characters in one campaign must
// never share a name, or they would share everything. Names compare without
// case and surrounding spaces. Trashed characters and characters in no
// campaign do not count.
//
// The database holds the rule (CHARACTER_NAME_INDEX, so two joins at the same
// moment cannot both get through); every way into a campaign checks first,
// to say clearly what is wrong.

export const CHARACTER_NAME_INDEX = "idx_characters_campaign_name_live";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Conn = typeof db | Tx;

/** Whether a live character in the campaign (other than `exceptId`) already has this name. */
export async function isNameTakenInCampaign(
  conn: Conn,
  campaignId: number,
  name: string,
  exceptId?: number,
): Promise<boolean> {
  const rows = await conn
    .select({ id: characters.id })
    .from(characters)
    .where(
      and(
        eq(characters.campaignId, campaignId),
        isNull(characters.deletedAt),
        sql`lower(btrim(${characters.name})) = lower(btrim(${name}))`,
        exceptId === undefined ? undefined : ne(characters.id, exceptId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Whether a write failed on the name rule in the database (a race the check could not see). */
export function isCampaignNameConflict(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 3; depth++) {
    const pg = e as { code?: unknown; constraint_name?: unknown };
    if (pg.code === "23505" && pg.constraint_name === CHARACTER_NAME_INDEX) return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

