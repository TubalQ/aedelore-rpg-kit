"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/api/report-error";
import { StatusPage } from "@/components/layout/status-page";

// retry() (Next 16, F8) re-fetches the segment; reset() only re-rendered
// with the same failing data. Render errors inside the app are caught per page, so the sidebar and header
// stay usable and the user can retry or navigate away.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportError(error, "route-error");
  }, [error]);
  return (
    <StatusPage
      title="error.somethingWrong"
      text="error.reloadHint"
      action={{ label: "common.retry", onClick: retry }}
    />
  );
}
