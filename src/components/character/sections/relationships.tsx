"use client";

import { Archive } from "lucide-react";
import { useState } from "react";
import type { CharacterData } from "@/lib/schemas/character";
import { useT } from "@/lib/i18n";

interface RelationshipsProps {
  data: CharacterData;
  onChange: (partial: Partial<CharacterData>) => void;
}

const RELATION_TYPES = [
  "Ally",
  "Friend",
  "Neutral",
  "Rival",
  "Enemy",
  "Mentor",
  "Student",
  "Business",
  "Family",
  "Romantic",
] as const;

export function RelationshipsSection({ data, onChange }: RelationshipsProps) {
  const { t } = useT();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("Neutral");
  const [showArchived, setShowArchived] = useState(false);

  const active = data.relationships.filter((r) => !r.archived);
  const archived = data.relationships.filter((r) => r.archived);

  function addRelationship() {
    if (!name.trim()) return;
    onChange({
      relationships: [
        ...data.relationships,
        { name: name.trim(), relation, notes: "", archived: false },
      ],
    });
    setName("");
    setRelation("Neutral");
  }

  function removeRelationship(index: number) {
    onChange({ relationships: data.relationships.filter((_, i) => i !== index) });
  }

  function archiveRelationship(index: number) {
    onChange({
      relationships: data.relationships.map((r, i) =>
        i === index ? { ...r, archived: true } : r,
      ),
    });
  }

  function restoreRelationship(index: number) {
    const archivedIndices = data.relationships
      .map((r, i) => (r.archived ? i : -1))
      .filter((i) => i >= 0);
    const realIndex = archivedIndices[index];
    if (realIndex === undefined) return;
    onChange({
      relationships: data.relationships.map((r, i) =>
        i === realIndex ? { ...r, archived: false } : r,
      ),
    });
  }

  function updateNotes(index: number, notes: string) {
    onChange({
      relationships: data.relationships.map((r, i) =>
        i === index ? { ...r, notes } : r,
      ),
    });
  }

  function updateRelation(index: number, rel: string) {
    onChange({
      relationships: data.relationships.map((r, i) =>
        i === index ? { ...r, relation: rel } : r,
      ),
    });
  }

  const relationColor = (rel: string): string => {
    switch (rel) {
      case "Ally": case "Friend": case "Family": case "Romantic": return "text-green-400";
      case "Enemy": case "Rival": return "text-red-400";
      case "Mentor": case "Student": return "text-blue-400";
      default: return "text-text-faint";
    }
  };

  return (
    <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
      <h2 className="text-lg font-semibold text-text-base">
        {t("relationships.title")} ({active.length})
      </h2>

      {active.length === 0 && (
        <p className="text-xs text-text-faint">{t("relationships.none")}</p>
      )}

      <div className="space-y-1">
        {data.relationships.map((rel, i) => {
          if (rel.archived) return null;
          return (
            <div key={i} className="rounded border border-border/50 bg-bg-base px-3 py-2 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-base flex-1">{rel.name}</span>
                <select
                  value={rel.relation}
                  onChange={(e) => updateRelation(i, e.target.value)}
                  className={`rounded border border-border bg-bg-surface px-1.5 py-0.5 text-xs ${relationColor(rel.relation)} focus:outline-none`}
                >
                  {RELATION_TYPES.map((rt) => (
                    <option key={rt} value={rt}>{rt}</option>
                  ))}
                </select>
                <button
                  onClick={() => archiveRelationship(i)}
                  className="text-xs text-text-faint hover:text-text-muted"
                >
                  {t("common.archive")}
                </button>
                <button
                  onClick={() => removeRelationship(i)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  X
                </button>
              </div>
              <input
                type="text"
                value={rel.notes}
                onChange={(e) => updateNotes(i, e.target.value)}
                className="w-full bg-transparent text-xs text-text-faint outline-none"
                placeholder={t("relationships.notesPlaceholder")}
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addRelationship()}
          className="flex-1 rounded border border-border bg-bg-base px-2 py-1 text-sm text-text-base focus:outline-none"
          placeholder={t("relationships.npcNamePlaceholder")}
        />
        <select
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
          className="w-full sm:w-auto rounded border border-border bg-bg-base px-2 py-1 text-xs text-text-base focus:outline-none"
        >
          {RELATION_TYPES.map((rt) => (
            <option key={rt} value={rt}>{rt}</option>
          ))}
        </select>
        <button
          onClick={addRelationship}
          disabled={!name.trim()}
          className="w-full sm:w-auto rounded bg-accent-gold/20 px-3 py-1 text-xs text-accent-gold hover:bg-accent-gold/30 disabled:opacity-50"
        >
          + {t("common.add")}
        </button>
      </div>

      {archived.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="inline-flex items-center gap-1 rounded border border-border/50 bg-bg-base px-2 py-1 text-xs text-text-muted hover:text-text-base hover:border-border transition-colors"
          >
            <Archive size={11} />
            {showArchived ? t("common.hide") : t("common.show")} {t("common.archive").toLowerCase()} ({archived.length})
          </button>
          {showArchived && (
            <div className="mt-2 space-y-1">
              {archived.map((rel, archIdx) => (
                <div key={archIdx} className="flex items-center gap-2 rounded border border-border/30 bg-bg-base/50 px-3 py-1.5 opacity-60">
                  <span className="flex-1 text-xs text-text-faint">{rel.name}</span>
                  <span className="text-[10px] text-text-faint">{rel.relation}</span>
                  <button
                    onClick={() => restoreRelationship(archIdx)}
                    className="text-xs text-green-400 hover:text-green-300"
                  >
                    {t("common.restore")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
