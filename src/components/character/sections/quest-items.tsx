"use client";

import { Archive, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { CharacterData } from "@/lib/schemas/character";
import { useT } from "@/lib/i18n";

interface QuestItemsProps {
  data: CharacterData;
  onChange: (partial: Partial<CharacterData>) => void;
}

// Spelarens quest items = föremål DM delat ut. Spelaren kan inte skapa/radera egna;
// titeln är en knapp som fäller ut innehållet, och föremål kan arkiveras/återställas.
export function QuestItemsSection({ data, onChange }: QuestItemsProps) {
  const { t } = useT();
  const [openActive, setOpenActive] = useState<number | null>(null);
  const [openArchived, setOpenArchived] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  function archiveItem(index: number) {
    const item = data.questItems[index];
    setOpenActive(null);
    onChange({
      questItems: data.questItems.filter((_, i) => i !== index),
      questItemsArchived: [...data.questItemsArchived, item],
    });
  }

  function restoreItem(index: number) {
    const item = data.questItemsArchived[index];
    setOpenArchived(null);
    onChange({
      questItemsArchived: data.questItemsArchived.filter((_, i) => i !== index),
      questItems: [...data.questItems, item],
    });
  }

  return (
    <section className="rounded-lg border border-border bg-bg-surface p-4 space-y-3">
      <h2 className="text-lg font-semibold text-text-base">
        {t("questItems.title")} ({data.questItems.length})
      </h2>

      {data.questItems.length === 0 && (
        <p className="text-xs text-text-faint">{t("questItems.none")}</p>
      )}

      <div className="space-y-1.5">
        {data.questItems.map((item, i) => {
          const open = openActive === i;
          return (
            <div key={i} className="rounded border border-border/50 bg-bg-base">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <button
                  onClick={() => setOpenActive(open ? null : i)}
                  aria-expanded={open}
                  className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-text-base"
                >
                  {open ? (
                    <ChevronDown size={14} className="shrink-0 text-accent-gold" />
                  ) : (
                    <ChevronRight size={14} className="shrink-0 text-accent-gold" />
                  )}
                  <span className="flex-1">{item.name}</span>
                  {item.sessionName && (
                    <span className="shrink-0 text-[10px] text-text-faint">{item.sessionName}</span>
                  )}
                </button>
                <button
                  onClick={() => archiveItem(i)}
                  title={t("questItems.archiveTitle")}
                  className="shrink-0 text-xs text-text-faint hover:text-text-muted"
                >
                  {t("common.archive")}
                </button>
              </div>
              {open && (
                <div className="border-t border-border/40 px-3 py-2">
                  {item.description ? (
                    <p className="whitespace-pre-wrap text-xs text-text-muted">{item.description}</p>
                  ) : (
                    <p className="text-xs italic text-text-faint">{t("questItems.noText")}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.questItemsArchived.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="inline-flex items-center gap-1 rounded border border-border/50 bg-bg-base px-2 py-1 text-xs text-text-muted hover:border-border hover:text-text-base transition-colors"
          >
            <Archive size={11} />
            {showArchived ? t("common.hide") : t("common.show")} {t("common.archive").toLowerCase()} ({data.questItemsArchived.length})
          </button>
          {showArchived && (
            <div className="mt-2 space-y-1.5">
              {data.questItemsArchived.map((item, i) => {
                const open = openArchived === i;
                return (
                  <div key={i} className="rounded border border-border/30 bg-bg-base/50">
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      <button
                        onClick={() => setOpenArchived(open ? null : i)}
                        aria-expanded={open}
                        className="flex flex-1 items-center gap-2 text-left text-xs text-text-faint"
                      >
                        {open ? (
                          <ChevronDown size={12} className="shrink-0" />
                        ) : (
                          <ChevronRight size={12} className="shrink-0" />
                        )}
                        <span className="flex-1">{item.name}</span>
                      </button>
                      <button
                        onClick={() => restoreItem(i)}
                        className="inline-flex shrink-0 items-center gap-1 text-xs text-green-400 hover:text-green-300"
                      >
                        <RotateCcw size={11} /> {t("common.restore")}
                      </button>
                    </div>
                    {open && (
                      <div className="border-t border-border/30 px-3 py-2">
                        {item.description ? (
                          <p className="whitespace-pre-wrap text-xs text-text-faint">{item.description}</p>
                        ) : (
                          <p className="text-xs italic text-text-faint">{t("questItems.noText")}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
