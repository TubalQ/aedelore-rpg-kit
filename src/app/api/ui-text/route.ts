import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuth as auth } from "@/lib/auth/api-auth";
import { getUiText, setUiText } from "@/lib/db/queries/ui-text";
import { TRANSLATION_KEYS } from "@/lib/i18n";
import type { UiTextOverrides } from "@/lib/i18n";

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
  // Also hand the admin UI the full key list so it can offer valid keys.
  return NextResponse.json({ overrides: await getUiText(), keys: TRANSLATION_KEYS });
}

const localeMap = z.record(z.string(), z.string());
const schema = z.object({ sv: localeMap.optional(), en: localeMap.optional() }).strict();

export async function PUT(req: Request) {
  const gate = await requireAdmin();
  if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid overrides" }, { status: 400 });

  // Keep only known translation keys with a non-empty value (empty = no
  // override → fall back to code). Guarantees clean, meaningful data in the DB.
  const known = new Set<string>(TRANSLATION_KEYS as readonly string[]);
  const clean: UiTextOverrides = {};
  for (const loc of ["sv", "en"] as const) {
    const src = parsed.data[loc];
    if (!src) continue;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(src)) {
      const val = v.trim();
      if (val && known.has(k)) out[k] = val;
    }
    if (Object.keys(out).length > 0) clean[loc] = out;
  }

  await setUiText(clean);
  return NextResponse.json({ ok: true });
}
