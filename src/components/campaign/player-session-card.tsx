"use client";

import { useState } from "react";
import { Users, MapPin, Package, Sword, BookOpen } from "lucide-react";
import { useT } from "@/lib/i18n";

interface SessionCardData {
  id: number;
  sessionNumber: number;
  title: string | null;
  date: string | null;
  status: string;
  data: Record<string, unknown>;
}

interface PlayerSessionCardProps {
  session: SessionCardData;
}

export function PlayerSessionCard({ session }: PlayerSessionCardProps) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const d = session.data;
  const npcs = (d.npcs ?? []) as { name: string; role: string; description: string; disposition: string }[];
  const places = (d.places ?? []) as { name: string; description: string }[];
  const encounters = (d.encounters ?? []) as { name: string; location: string; status: string }[];
  const items = (d.items ?? []) as { name: string; description: string; givenTo: string }[];
  const equipment = (d.equipment ?? []) as { name: string; type: string; description: string; rarity: string }[];
  const readAloud = (d.readAloud ?? []) as { title: string; text: string }[];
  const eventLog = (d.eventLog ?? []) as { text: string; timestamp: string }[];
  const turningPoints = (d.turningPoints ?? []) as { description: string; consequence: string }[];
  const followUp = (d.sessionNotes as Record<string, string> | undefined)?.followUp ?? "";
  const hook = (d.hook ?? "") as string;
  const prolog = (d.prolog ?? "") as string;

  return (
    <div className="rounded-lg border border-border bg-bg-surface overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-base/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text-base">#{session.sessionNumber}</span>
          {session.title && <span className="text-text-muted">{session.title}</span>}
          {session.date && <span className="text-xs text-text-faint">{session.date}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {session.status === "locked" && (
            <span className="rounded bg-accent-gold/20 px-1.5 py-0.5 text-[10px] text-accent-gold">{t("common.done")}</span>
          )}
          <div className="flex items-center gap-1 text-text-faint">
            {npcs.length > 0 && <span aria-label="NPCs"><Users size={12} /></span>}
            {places.length > 0 && <span aria-label={t("session.places")}><MapPin size={12} /></span>}
            {items.length > 0 && <span aria-label={t("session.items")}><Package size={12} /></span>}
            {equipment.length > 0 && <span aria-label={t("session.equipment")}><Sword size={12} /></span>}
            {readAloud.length > 0 && <span aria-label={t("session.readAloud")}><BookOpen size={12} /></span>}
          </div>
          <span className="text-text-faint text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-4 text-sm">
          {hook && (
            <div>
              <h4 className="text-xs font-semibold text-text-faint mb-1">Hook</h4>
              <p className="text-text-muted whitespace-pre-wrap">{hook}</p>
            </div>
          )}
          {prolog && (
            <div>
              <h4 className="text-xs font-semibold text-text-faint mb-1">Prolog</h4>
              <p className="text-text-muted whitespace-pre-wrap">{prolog}</p>
            </div>
          )}

          {readAloud.length > 0 && (
            <ContentSection title={t("session.readAloud")} color="text-purple-400">
              {readAloud.map((ra, i) => (
                <div key={i} className="border-l-2 border-purple-800/50 pl-2">
                  {ra.title && <p className="text-text-base font-medium text-xs">{ra.title}</p>}
                  <p className="text-text-muted text-xs italic whitespace-pre-wrap">{ra.text}</p>
                </div>
              ))}
            </ContentSection>
          )}

          {places.length > 0 && (
            <ContentSection title={t("session.places")} color="text-cyan-400">
              {places.map((p, i) => (
                <div key={i}>
                  <span className="text-text-base text-xs font-medium">{p.name}</span>
                  {p.description && <p className="text-text-muted text-xs">{p.description}</p>}
                </div>
              ))}
            </ContentSection>
          )}

          {npcs.length > 0 && (
            <ContentSection title="NPCs" color="text-blue-400">
              {npcs.map((n, i) => (
                <div key={i}>
                  <span className="text-text-base text-xs font-medium">{n.name}</span>
                  {n.role && <span className="text-text-faint text-[10px] ml-1">({n.role})</span>}
                  {n.description && <p className="text-text-muted text-xs">{n.description}</p>}
                </div>
              ))}
            </ContentSection>
          )}

          {encounters.length > 0 && (
            <ContentSection title={t("session.encounter")} color="text-red-400">
              {encounters.map((enc, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-text-base text-xs font-medium">{enc.name}</span>
                  {enc.location && <span className="text-[10px] text-text-faint">@ {enc.location}</span>}
                </div>
              ))}
            </ContentSection>
          )}

          {items.length > 0 && (
            <ContentSection title={t("session.items")} color="text-amber-400">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-text-base text-xs font-medium">{it.name}</span>
                  {it.givenTo && <span className="text-[10px] text-green-400">&rarr; {it.givenTo}</span>}
                </div>
              ))}
            </ContentSection>
          )}

          {equipment.length > 0 && (
            <ContentSection title={t("session.equipment")} color="text-emerald-400">
              {equipment.map((eq, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-text-base text-xs font-medium">{eq.name}</span>
                  <span className="text-[10px] text-text-faint">{eq.type}</span>
                  {eq.rarity !== "common" && (
                    <span className="text-[10px] text-accent-gold">{eq.rarity}</span>
                  )}
                </div>
              ))}
            </ContentSection>
          )}

          {eventLog.length > 0 && (
            <ContentSection title={t("session.events")} color="text-green-400">
              {eventLog.map((evt, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="text-text-faint font-mono shrink-0">{evt.timestamp}</span>
                  <span className="text-text-muted">{evt.text}</span>
                </div>
              ))}
            </ContentSection>
          )}

          {turningPoints.length > 0 && (
            <ContentSection title={t("session.turningPoints")} color="text-accent-gold">
              {turningPoints.map((tp, i) => (
                <div key={i} className="border-l-2 border-accent-gold/30 pl-2">
                  <p className="text-text-base text-xs">{tp.description}</p>
                  {tp.consequence && <p className="text-text-muted text-xs">{tp.consequence}</p>}
                </div>
              ))}
            </ContentSection>
          )}

          {followUp && (
            <div>
              <h4 className="text-xs font-semibold text-text-faint mb-1">{t("session.followUp")}</h4>
              <p className="text-text-muted text-xs whitespace-pre-wrap">{followUp}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ContentSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className={`text-xs font-semibold ${color}`}>{title}</h4>
      {children}
    </div>
  );
}
