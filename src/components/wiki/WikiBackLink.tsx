"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

/**
 * Tillbakalänken i wiki-headern. Wikin ligger utanför app-skalet och länkade
 * tidigare alltid till marknadsföringssidan `/` - en inloggad spelare tappade
 * navigationen. Sessionskollen görs klient-side (fetch mot NextAuth-endpointen)
 * så wiki-sidorna kan förbli statiskt genererade.
 */
export function WikiBackLink() {
  const { t } = useT();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!cancelled && s?.user) setLoggedIn(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <Link
      href={loggedIn ? "/dashboard" : "/"}
      className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-sm text-text-muted bg-bg-elevated border border-border rounded hover:text-accent-gold hover:border-accent-gold/40 transition-colors"
    >
      <span>&larr;</span>
      <span>{loggedIn ? t("sidebar.home") : "Aedelore"}</span>
    </Link>
  );
}
