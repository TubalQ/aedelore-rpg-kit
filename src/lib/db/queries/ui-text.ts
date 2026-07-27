import { db } from "@/lib/db/client";
import { uiText } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cache } from "react";
import type { UiTextOverrides } from "@/lib/i18n/overrides";

// Admin-editable per-locale UI-text overrides (singleton row id = 1). Layered
// over the code translation dictionaries by translate(). Request-memoized.
export const getUiText = cache(async (): Promise<UiTextOverrides> => {
  try {
    const [row] = await db.select().from(uiText).where(eq(uiText.id, 1)).limit(1);
    return (row?.data as UiTextOverrides) ?? {};
  } catch {
    // DB unreachable / table missing → no overrides (never crash the layout).
    return {};
  }
});

/** Replace the whole override set (the admin editor sends the full object). */
export async function setUiText(data: UiTextOverrides): Promise<void> {
  const [row] = await db.select().from(uiText).where(eq(uiText.id, 1)).limit(1);
  if (row) {
    await db.update(uiText).set({ data, updatedAt: new Date() }).where(eq(uiText.id, 1));
  } else {
    await db.insert(uiText).values({ id: 1, data });
  }
}
