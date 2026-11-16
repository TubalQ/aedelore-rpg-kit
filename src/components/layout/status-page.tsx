"use client";

import Link from "next/link";
import { useT, type TranslationKey } from "@/lib/i18n";

/** Themed full-page message for 404s and render errors, always with a way on. */
export function StatusPage({
  title,
  text,
  action,
}: {
  title: TranslationKey;
  text: TranslationKey;
  action?: { label: TranslationKey; onClick: () => void };
}) {
  const { t } = useT();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-2xl text-accent-gold">{t(title)}</h1>
      <p className="max-w-md text-sm text-text-muted">{t(text)}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="rounded-lg bg-accent-gold/20 px-4 py-2 text-sm text-accent-gold hover:bg-accent-gold/30"
          >
            {t(action.label)}
          </button>
        )}
        <Link href="/" className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:text-text-base">
          {t("error.backHome")}
        </Link>
      </div>
    </div>
  );
}
