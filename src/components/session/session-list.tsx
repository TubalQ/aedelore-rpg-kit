"use client";

import Link from "next/link";
import type { SessionRow } from "@/lib/schemas/session";
import { useT } from "@/lib/i18n";

interface SessionListProps {
  sessions: SessionRow[];
  onDelete: (id: number) => void;
}

export function SessionList({ sessions, onDelete }: SessionListProps) {
  const { t } = useT();
  if (sessions.length === 0) {
    return <p className="text-sm text-text-faint">{t("session.noSessions")}</p>;
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => {
        const isLocked = session.status === "locked";
        return (
          <div
            key={session.id}
            className="flex items-center justify-between rounded-lg border border-border bg-bg-surface p-3"
          >
            <Link
              href={`/sessions/${session.id}`}
              className="flex-1 hover:text-accent-gold transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-text-faint w-8">
                  #{session.sessionNumber}
                </span>
                <span className="text-text-base font-medium">
                  {session.title || t("session.untitled")}
                </span>
                {isLocked && (
                  <span className="rounded bg-accent-gold/20 px-2 py-0.5 text-xs text-accent-gold">
                    {t("common.locked")}
                  </span>
                )}
              </div>
              {session.date && (
                <p className="ml-11 text-xs text-text-faint">{session.date}</p>
              )}
            </Link>
            {!isLocked && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onDelete(session.id);
                }}
                className="text-xs text-red-400 hover:text-red-300 shrink-0 ml-2"
              >
                {t("common.remove")}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
