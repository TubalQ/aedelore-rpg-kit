import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { getSettings, setSettings } from "@/lib/db/queries/app-settings";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 as const };
  if (!session.user.isAdmin) return { error: "Forbidden", status: 403 as const };
  return null;
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  return NextResponse.json(await getSettings());
}

const schema = z
  .object({
    registrationOpen: z.boolean().optional(),
    credentialsEnabled: z.boolean().optional(),
    analyticsId: z.string().trim().nullable().optional(),
  })
  .strict();

export async function PUT(req: Request) {
  const gate = await requireAdmin();
  if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }
  const patch = { ...parsed.data };
  if (patch.analyticsId === "") patch.analyticsId = null; // empty → disable analytics
  await setSettings(patch);
  return NextResponse.json({ ok: true });
}
