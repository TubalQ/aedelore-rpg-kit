import { HttpError, parseId, requireApiUser } from "@/lib/api/route-helpers";
import { getStashEntry, verifyDmOwnsCampaign } from "@/lib/db/queries/stash";

/** The campaign id from the route, when the caller is its DM (else 404). */
export async function requireStashDm(rawCampaignId: string): Promise<{ campaignId: number; userId: string }> {
  const user = await requireApiUser();
  const campaignId = parseId(rawCampaignId);
  if (!(await verifyDmOwnsCampaign(campaignId, user.id))) throw new HttpError(404, "Not found or not DM");
  return { campaignId, userId: user.id };
}

/** The stash entry from the route, in a campaign the caller is DM of (else 404). */
export async function requireStashEntry(rawCampaignId: string, rawStashId: string) {
  const { campaignId, userId } = await requireStashDm(rawCampaignId);
  const stashId = parseId(rawStashId, "stash id");
  const entry = await getStashEntry(campaignId, stashId);
  if (!entry) throw new HttpError(404, "Stash entry not found");
  return { campaignId, userId, stashId, entry };
}
