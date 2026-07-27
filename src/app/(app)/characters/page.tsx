"use client";

import Link from "next/link";
import { CharacterList } from "@/components/character/character-list";
import { useT } from "@/lib/i18n";

export default function CharactersPage() {
  const { t } = useT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-base">{t("dashboard.characters.title")}</h1>
        <Link
          href="/characters/new"
          className="rounded-lg bg-accent-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-purple/80"
        >
          {t("character.new")}
        </Link>
      </div>
      <CharacterList />
    </div>
  );
}
