"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";
import { useCharacters } from "@/hooks/useCharacters";
import { useCampaigns } from "@/hooks/useCampaigns";

export function DashboardContent({ userName }: { userName?: string }) {
  const { t } = useT();
  const { data: characters } = useCharacters();
  const { data: campaigns } = useCampaigns();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-accent-gold">
          {t("dashboard.welcome", { name: userName || t("onboarding.welcome").split(",")[0].split(" ").pop()! })}
        </h1>
        <p className="mt-2 text-text-muted">
          {t("dashboard.subtitle")}
        </p>
      </div>

      {/* Kom igång-guide för nya spelare - tidigare fanns ingen väg in:
          onboardingen upptäcktes först av en slump inne på en karaktärssida. */}
      {characters !== undefined && campaigns !== undefined &&
        (characters.length === 0 || campaigns.length === 0) && (
        <section className="rounded-xl border border-accent-gold/40 bg-accent-gold/5 p-5 space-y-3">
          <h2 className="text-lg font-semibold text-accent-gold">{t("dashboard.getStarted.title")}</h2>
          <ol className="space-y-2 text-sm text-text-muted list-decimal list-inside">
            <li className={characters.length > 0 ? "line-through opacity-60" : ""}>
              {t("dashboard.getStarted.step1")}
            </li>
            <li className={campaigns.length > 0 ? "line-through opacity-60" : ""}>
              {t("dashboard.getStarted.step2")}
            </li>
          </ol>
          <div className="flex flex-wrap gap-2">
            {characters.length === 0 && (
              <Link
                href="/characters/new"
                className="rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-purple/80"
              >
                {t("character.createFirst")}
              </Link>
            )}
            <Link
              href="/campaigns/join"
              className="rounded-lg border border-accent-gold/50 px-4 py-2 text-sm font-semibold text-accent-gold transition-colors hover:bg-accent-gold/10"
            >
              {t("dashboard.getStarted.join")}
            </Link>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DashboardCard
          titleKey="dashboard.characters.title"
          descKey="dashboard.characters.desc"
          href="/characters"
          count={characters?.length}
        />
        <DashboardCard
          titleKey="dashboard.campaigns.title"
          descKey="dashboard.campaigns.desc"
          href="/campaigns"
          count={campaigns?.length}
        />
        <DashboardCard
          titleKey="dashboard.wiki.title"
          descKey="dashboard.wiki.desc"
          href="/wiki"
        />
      </div>
    </div>
  );
}

function DashboardCard({
  titleKey,
  descKey,
  href,
  count,
}: {
  titleKey: TranslationKey;
  descKey: TranslationKey;
  href: string;
  count?: number;
}) {
  const { t } = useT();

  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-bg-surface p-6 transition-all hover:border-border-hover hover:bg-bg-elevated"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-base group-hover:text-accent-gold transition-colors">
          {t(titleKey)}
        </h2>
        {count !== undefined && (
          <span className="rounded-full bg-bg-elevated px-2.5 py-0.5 text-xs font-medium text-text-muted">
            {count}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-text-muted">{t(descKey)}</p>
    </Link>
  );
}
