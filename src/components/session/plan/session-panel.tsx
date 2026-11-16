"use client";

import { useT } from "@/lib/i18n";
import type { SessionData } from "@/lib/schemas/session";
import { SessionMetaSection } from "../sections/meta";
import { AfterSessionSection, HookPrologSection } from "../sections/notes";
import { DmNotesSection } from "../sections/dm-notes";
import { PanelShell } from "./panel-shell";

export type SessionTab = "prep" | "dmNotes" | "after" | "info";

export type SessionMeta = { title: string; date: string; location: string; gameLocation: string };

interface SessionPanelProps {
  sessionNumber: number;
  data: SessionData;
  meta: SessionMeta;
  disabled: boolean;
  tab: SessionTab;
  onTab: (tab: SessionTab) => void;
  onDataChange: (patch: Partial<SessionData>) => void;
  onMetaChange: (field: string, value: string) => void;
  onClose: () => void;
}

/** Everything about the session as a whole: hook and prolog, DM notes, afterwards, info. */
export function SessionPanel({ sessionNumber, data, meta, disabled, tab, onTab, onDataChange, onMetaChange, onClose }: SessionPanelProps) {
  const { t } = useT();
  return (
    <PanelShell
      kicker={t("plan.sessionButton")}
      title={meta.title || `#${sessionNumber}`}
      tabs={[
        { key: "prep", label: t("plan.tabPrep") },
        { key: "dmNotes", label: `${t("plan.tabDmNotes")}${data.dmNotes.length ? ` · ${data.dmNotes.length}` : ""}` },
        { key: "after", label: t("plan.tabAfter") },
        { key: "info", label: t("plan.tabInfo") },
      ]}
      tab={tab}
      onTab={onTab}
      onClose={onClose}
    >
      {tab === "prep" && (
        <HookPrologSection hook={data.hook} prolog={data.prolog} disabled={disabled}
          onHookChange={(hook) => onDataChange({ hook })} onPrologChange={(prolog) => onDataChange({ prolog })} />
      )}
      {tab === "dmNotes" && <DmNotesSection notes={data.dmNotes} disabled={disabled} onChange={(dmNotes) => onDataChange({ dmNotes })} />}
      {tab === "after" && (
        <AfterSessionSection sessionNotes={data.sessionNotes} disabled={disabled} onSessionNotesChange={(sessionNotes) => onDataChange({ sessionNotes })} />
      )}
      {tab === "info" && <SessionMetaSection meta={meta} disabled={disabled} onChange={onMetaChange} />}
    </PanelShell>
  );
}
