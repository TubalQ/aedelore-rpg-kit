"use client";

import Link from "next/link";
import { useCharacters, useDeleteCharacter } from "@/hooks/useCharacters";
import { useT } from "@/lib/i18n";
import { CharacterCard } from "./character-card";

export function CharacterList() {
  const { data: characters, isLoading, error } = useCharacters();
  const deleteMutation = useDeleteCharacter();
  const { t } = useT();

  if (isLoading) {
    return <p className="text-text-muted">{t("character.loadingList")}</p>;
  }

  if (error) {
    return <p className="text-red-400">{t("character.loadListError", { error: error.message })}</p>;
  }

  if (!characters || characters.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted mb-4">{t("character.noCharacters")}</p>
        <Link
          href="/characters/new"
          className="inline-block rounded-lg bg-accent-purple px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-purple/80"
        >
          {t("character.createFirst")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {characters.map((char) => {
        const data = char.data as Record<string, unknown> | undefined;
        return (
          <CharacterCard
            key={char.id as number}
            id={char.id as number}
            name={char.name as string}
            race={(data?.race as string) ?? null}
            characterClass={(data?.class as string) ?? null}
            avatarSeed={(data?.avatarSeed as string) ?? ""}
            avatarImage={(data?.avatarImage as string) ?? ""}
            xp={char.xp as number}
            updatedAt={char.updatedAt as string}
            campaignName={(char.campaignName as string | null) ?? null}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        );
      })}
      {deleteMutation.error && (
        <p className="text-sm text-red-400">
          {t("character.deleteError", { error: deleteMutation.error.message })}
        </p>
      )}
    </div>
  );
}
