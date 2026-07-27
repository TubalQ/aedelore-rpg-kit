import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserByEmail, countActiveUsers, createLocalUser } from "@/lib/db/queries/users";
import { getSettings } from "@/lib/db/queries/app-settings";
import { hashPassword } from "@/lib/auth/password";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  name: z.string().trim().max(80).optional(),
});

export async function POST(req: Request) {
  const settings = await getSettings();
  if (!settings.credentialsEnabled) {
    return NextResponse.json({ error: "Password sign-in is disabled." }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existingUsers = await countActiveUsers();
  const isFirst = existingUsers === 0;

  // The first account bootstraps the instance (becomes admin). After that,
  // registration is open only while the `registrationOpen` setting is true.
  if (!isFirst && !settings.registrationOpen) {
    return NextResponse.json({ error: "Registration is closed." }, { status: 403 });
  }

  if (await getUserByEmail(email)) {
    return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await createLocalUser({
    email,
    name: parsed.data.name?.trim() || null,
    passwordHash,
    isAdmin: isFirst,
  });

  return NextResponse.json({ ok: true, isAdmin: user.isAdmin });
}
