"use client";

import { useSyncExternalStore } from "react";
import { onlineManager } from "@tanstack/react-query";
import { useT } from "@/lib/i18n";

const subscribe = (cb: () => void) => onlineManager.subscribe(cb);
const isOnline = () => onlineManager.isOnline();
const onServer = () => true;

/**
 * Shown above a view that keeps its last loaded data while it cannot refresh
 * (F3): a background refresh failed, or the browser is offline (React Query
 * pauses its requests then, so no error ever arrives). The view stays usable,
 * local edits included; refreshes and failed saves resume by themselves.
 */
export function RefreshFailed({ error }: { error: Error | null }): React.ReactElement | null {
  const { t } = useT();
  const online = useSyncExternalStore(subscribe, isOnline, onServer);
  if (online && !error) return null;
  return (
    <p role="status" className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
      {online ? t("common.refreshFailed") : t("common.offline")}
    </p>
  );
}
