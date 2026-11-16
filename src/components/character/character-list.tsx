"use client";

import Link from "next/link";
import { errorMessage } from "@/lib/api/error-message";
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
    return <p className="text-accent-red">{t("character.loadListError", { error: error.message })}</p>;
  }

  if (!characters || characters.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted mb-4">{t("character.noCharacters")}</p>
        <Link
          href="/characters/new"
          className="inline-block rounded-lg bg-accent-purple px-6 py-3 text-sm font-semibold text-on-accent-purple transition-colors hover:bg-accent-purple/80"
        >
          {t("character.createFirst")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {characters.map((char) => {
        return (
          <CharacterCard
            key={char.id}
            id={char.id}
            name={char.name}
            race={char.data.race}
            characterClass={char.data.class}
            avatarSeed={char.data.avatarSeed}
            avatarImage={char.data.avatarImage}
            xp={char.xp}
            updatedAt={char.updatedAt}
            campaignName={char.campaignName ?? null}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        );
      })}
      {deleteMutation.error && (
        <p className="text-sm text-accent-red">
          {t("character.deleteError", { error: errorMessage(deleteMutation.error) })}
        </p>
      )}
    </div>
  );
}
