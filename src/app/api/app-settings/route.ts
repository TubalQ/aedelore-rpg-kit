import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { getSettings, setSettings } from "@/lib/db/queries/app-settings";
import { withApi, readJson } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 as const };
  if (!session.user.isAdmin) return { error: "Forbidden", status: 403 as const };
  return null;
}

export const GET = withApi(async () => {
  const gate = await requireAdmin();
  if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  return NextResponse.json(await getSettings());
});

const schema = z
  .object({
    analyticsId: z.string().trim().nullable().optional(),
  })
  .strict();

export const PUT = withApi(async (req: Request) => {
  const gate = await requireAdmin();
  if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }
  const patch = { ...parsed.data };
  if (patch.analyticsId === "") patch.analyticsId = null; // empty → disable analytics
  await setSettings(patch);
  return NextResponse.json({ ok: true });
});
