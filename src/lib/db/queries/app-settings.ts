import { db } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cache } from "react";

// App-wide, admin-editable instance settings (SSoT = DB). Secrets stay in env;
// these are non-secret operational toggles. The former registrationOpen /
// credentialsEnabled toggles were removed 2026-08-22 when sign-in went OIDC-only
// (registration and account policy live in the OIDC providers now).
export interface AppSettings {
  /** Umami website id for /stats.js, or null to disable analytics. */
  analyticsId: string | null;
}

// Fresh-install default: no analytics. A live/private instance overrides in the DB.
const DEFAULTS: AppSettings = {
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
