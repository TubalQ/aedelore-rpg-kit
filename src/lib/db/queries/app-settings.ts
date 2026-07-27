import { db } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cache } from "react";

// App-wide, admin-editable instance settings (SSoT = DB, replaces the former
// AUTH_REGISTRATION_OPEN / AUTH_CREDENTIALS_ENABLED / NEXT_PUBLIC_ANALYTICS_ID
// env vars). Secrets stay in env; these are non-secret operational toggles.
export interface AppSettings {
  /** After the first (admin) user exists, may new users self-register? */
  registrationOpen: boolean;
  /** Is email/password sign-in enabled (vs OIDC-only)? */
  credentialsEnabled: boolean;
  /** Umami website id for /stats.js, or null to disable analytics. */
  analyticsId: string | null;
}

// Fresh-install defaults: email/password ON (so the first admin can register),
// registration open, no analytics. A live/private instance overrides in the DB.
const DEFAULTS: AppSettings = {
  registrationOpen: true,
  credentialsEnabled: true,
  analyticsId: null,
};

/** Current settings (DB row merged over defaults). Request-memoized. */
export const getSettings = cache(async (): Promise<AppSettings> => {
  try {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, 1))
      .limit(1);
    return { ...DEFAULTS, ...((row?.data as Partial<AppSettings>) ?? {}) };
  } catch {
    // DB unreachable / table missing → safe defaults (never crash auth/layout).
    return DEFAULTS;
  }
});

/** Upsert a partial settings patch into the singleton row. */
export async function setSettings(patch: Partial<AppSettings>): Promise<void> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1);
  const next: AppSettings = {
    ...DEFAULTS,
    ...((row?.data as Partial<AppSettings>) ?? {}),
    ...patch,
  };
  if (row) {
    await db
      .update(appSettings)
      .set({ data: next, updatedAt: new Date() })
      .where(eq(appSettings.id, 1));
  } else {
    await db.insert(appSettings).values({ id: 1, data: next });
  }
}
