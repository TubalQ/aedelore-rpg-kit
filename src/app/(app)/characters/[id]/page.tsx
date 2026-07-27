"use client";

import { useParams } from "next/navigation";
import { CharacterSheet } from "@/components/character/character-sheet";

export default function CharacterPage() {
  const params = useParams();
  const id = Number(params.id);

  if (Number.isNaN(id)) {
    return <p className="text-red-400">Ogiltigt karaktärs-ID.</p>;
  }

  return <CharacterSheet id={id} />;
}
