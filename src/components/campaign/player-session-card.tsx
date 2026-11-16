"use client";

import { useState } from "react";
import {
  Users, MapPin, Swords, Package, Sword, BookOpen,
  Sparkles, Milestone, Clock, ChevronRight, CornerDownRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { SessionItem } from "@/lib/schemas/session";

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

// Free-text disposition → a friend/neutral/hostile dot colour. Matches sv + en
// keywords players' DMs actually type ("Vänlig", "hostile", "Hjälpsam", ...).
function dispositionDot(disposition: string): string {
  const s = (disposition || "").toLowerCase();
  if (/hostil|enemy|fiende|fientlig|aggress|hotfull|misstänk/.test(s)) return "bg-accent-red";
  if (/friend|vänlig|allier|\bally\b|hjälpsam|god vän/.test(s)) return "bg-accent-green";
  return "bg-text-faint";
}

// Rarity → name colour. Common (or blank) stays neutral.
function rarityClass(rarity: string): string {
  const s = (rarity || "").toLowerCase();
  if (/legend|artifact|epic|mytisk/.test(s)) return "text-accent-gold";
  if (/rare|sällsynt/.test(s)) return "text-accent-blue";
  if (/uncommon|ovanlig/.test(s)) return "text-accent-green";
  return "text-text-base";
}
const isCommon = (r: string) => !r || /^common$|^vanlig/i.test(r.trim());

function BandLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2 mb-3 ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent-gold-dim">{children}</span>
      <span className="h-px flex-1 bg-[linear-gradient(90deg,var(--color-accent-gold-dim),transparent)]" />
    </div>
  );
}

function FactCard({
  icon, label, color, children,
}: { icon: React.ReactNode; label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-bg-base p-3">
      <div className={`flex items-center gap-1.5 mb-2 text-[10px] font-bold uppercase tracking-[0.13em] ${color}`}>
        {icon}
        {label}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function PlayerSessionCard({ session }: PlayerSessionCardProps) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const d = session.data;
  const npcs = (d.npcs ?? []) as { name: string; role: string; description: string; disposition: string }[];
  const places = (d.places ?? []) as { name: string; description: string }[];
  const encounters = (d.encounters ?? []) as { name: string; location: string; status: string }[];
  const items = (d.items ?? []) as Pick<SessionItem, "name" | "description" | "givenTo">[];
  const equipment = (d.equipment ?? []) as { name: string; type: string; description: string; rarity: string }[];
  const readAloud = (d.readAloud ?? []) as { title: string; text: string }[];
  const eventLog = (d.eventLog ?? []) as { text: string; timestamp: string }[];
  const turningPoints = (d.turningPoints ?? []) as { description: string; consequence: string }[];
  const summary = (d.sessionNotes as Record<string, string> | undefined)?.summary ?? "";
  const followUp = (d.sessionNotes as Record<string, string> | undefined)?.followUp ?? "";
  const hook = (d.hook ?? "") as string;
  const prolog = (d.prolog ?? "") as string;

  const hasStory = Boolean(summary) || readAloud.length > 0 || Boolean(hook) || Boolean(prolog);
  const hasScene = places.length > 0 || npcs.length > 0 || encounters.length > 0;
  const hasRewards = items.length > 0 || equipment.length > 0;
  const hasGains = hasRewards || turningPoints.length > 0 || Boolean(followUp) || eventLog.length > 0;

  return (
    <div className="rounded-lg border border-border bg-bg-surface overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-bg-base/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display font-bold text-text-base">#{session.sessionNumber}</span>
          {session.title && <span className="font-display text-text-muted truncate">{session.title}</span>}
          {session.date && <span className="text-xs text-text-faint shrink-0">{session.date}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {session.status === "locked" && (
            <span className="rounded bg-accent-gold/20 px-1.5 py-0.5 text-[10px] text-accent-gold">{t("common.done")}</span>
          )}
          <div className="flex items-center gap-1 text-text-faint">
            {readAloud.length > 0 && <span aria-label={t("session.readAloud")}><BookOpen size={12} /></span>}
            {places.length > 0 && <span aria-label={t("session.places")}><MapPin size={12} /></span>}
            {npcs.length > 0 && <span aria-label={t("session.npcs")}><Users size={12} /></span>}
            {(items.length > 0 || equipment.length > 0) && <span aria-label={t("session.tierGains")}><Package size={12} /></span>}
          </div>
          <ChevronRight size={14} className={`text-text-faint transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div>
          {/* Tier 1 – the story you read */}
          {hasStory && (
            <section className="px-4 py-4">
              <BandLabel>{t("session.tierStory")}</BandLabel>
              {summary && (
                <div className="mb-3 border-l-[3px] border-l-accent-gold-dim pl-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent-gold mb-1">{t("session.recap")}</div>
                  <p className="font-display text-[15px] leading-relaxed text-text-muted whitespace-pre-wrap">{summary}</p>
                </div>
              )}
              {/* Y17: a dark box on every palette, so its text has fixed light colours too (text-base was dark on Vellum). */}
              {(readAloud.length > 0 || hook || prolog) && (
              <div className="rounded-lg border border-[#2b2411] border-l-[3px] border-l-accent-gold bg-[linear-gradient(160deg,#17140d,#0d0b07)] px-4 py-4">
                {readAloud.map((ra, i) => (
                  <div key={i} className={i > 0 ? "mt-3 pt-3 border-t border-[#241d0f]" : ""}>
                    {i === 0 && (
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent-gold-dim mb-1.5">
                        {t("session.readCue")}
                      </div>
                    )}
                    {ra.title && <p className="font-display text-sm font-semibold text-[#ece4d0] mb-0.5">{ra.title}</p>}
                    <p className="font-display text-[17px] leading-[1.62] text-[#ece4d0] whitespace-pre-wrap">
                      {i === 0 && ra.text ? (
                        <>
                          <span className="float-left font-display font-bold text-accent-gold text-[44px] leading-[0.82] pr-2 pt-1">
                            {ra.text.charAt(0)}
                          </span>
                          {ra.text.slice(1)}
                        </>
                      ) : (
                        ra.text
                      )}
                    </p>
                  </div>
                ))}
                {(hook || prolog) && (
                  <div className={readAloud.length > 0 ? "mt-3 pt-3 border-t border-[#241d0f] space-y-2.5" : "space-y-2.5"}>
                    {hook && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-accent-gold-dim mb-0.5">{t("session.hook")}</div>
                        <p className="text-[13px] text-[#b8ae96] whitespace-pre-wrap">{hook}</p>
                      </div>
                    )}
                    {prolog && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-accent-gold-dim mb-0.5">{t("session.prologue")}</div>
                        <p className="text-[13px] text-[#b8ae96] whitespace-pre-wrap">{prolog}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}
            </section>
          )}

          {/* Tier 2 – the scene, scannable */}
          {hasScene && (
            <section className="px-4 py-4 border-t border-border">
              <BandLabel>{t("session.tierScene")}</BandLabel>
              <div className="flex flex-col gap-2.5">
                {places.length > 0 && (
                  <FactCard icon={<MapPin size={13} />} label={t("session.places")} color="text-accent-cyan">
                    {places.map((p, i) => (
                      <div key={i} className="text-[13px] text-text-base">
                        <span className="font-semibold">{p.name}</span>
                        {p.description && <p className="text-xs text-text-muted mt-0.5 leading-snug">{p.description}</p>}
                      </div>
                    ))}
                  </FactCard>
                )}
                {npcs.length > 0 && (
                  <FactCard icon={<Users size={13} />} label={t("session.npcs")} color="text-accent-blue">
                    {npcs.map((n, i) => (
                      <div key={i} className="flex items-start gap-2 text-[13px]">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dispositionDot(n.disposition)}`} />
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-text-base">{n.name}</span>
                          {n.role && <span className="text-[11px] text-text-faint ml-1.5">({n.role})</span>}
                          {n.description && <p className="text-xs text-text-muted mt-0.5 leading-snug">{n.description}</p>}
                        </div>
                        {n.disposition && (
                          <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-text-muted">{n.disposition}</span>
                        )}
                      </div>
                    ))}
                  </FactCard>
                )}
                {encounters.length > 0 && (
                  <FactCard icon={<Swords size={13} />} label={t("session.encounter")} color="text-accent-red">
                    {encounters.map((enc, i) => (
                      <div key={i} className="flex items-center gap-2 text-[13px]">
                        <span className="font-semibold text-text-base">{enc.name}</span>
                        {enc.location && <span className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px] text-text-faint">{enc.location}</span>}
                      </div>
                    ))}
                  </FactCard>
                )}
              </div>
            </section>
          )}

          {/* Tier 3 – your finds + the record */}
          {hasGains && (
            <section className="px-4 py-4 border-t border-border">
              {hasRewards && (
                <>
                  <BandLabel>{t("session.tierGains")}</BandLabel>
                  <div className="flex flex-col gap-1.5">
                    {items.map((it, i) => (
                      <div key={`i${i}`} className="flex items-center gap-2.5 rounded-md border border-border bg-bg-base px-2.5 py-2">
                        <Sparkles size={16} className="shrink-0 text-accent-gold-dim" />
                        <span className="font-semibold text-[13.5px] text-text-base">{it.name}</span>
                        {it.givenTo.length > 0 && (
                          <span className="ml-auto flex items-center gap-1 rounded-full border border-accent-green/30 bg-accent-green/10 px-2 py-0.5 text-[11px] font-semibold text-accent-green">
                            <CornerDownRight size={11} />{it.givenTo.join(", ")}
                          </span>
                        )}
                      </div>
                    ))}
                    {equipment.map((eq, i) => (
                      <div key={`e${i}`} className="flex items-center gap-2.5 rounded-md border border-border bg-bg-base px-2.5 py-2">
                        {eq.type === "weapon" ? <Sword size={16} className="shrink-0 text-accent-gold-dim" /> : <Package size={16} className="shrink-0 text-accent-gold-dim" />}
                        <span className={`font-semibold text-[13.5px] ${rarityClass(eq.rarity)}`}>{eq.name}</span>
                        {!isCommon(eq.rarity) && <span className="text-[11px] text-text-faint">{eq.rarity}</span>}
                        {eq.type && <span className="ml-auto text-[11px] text-text-faint">{eq.type}</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {turningPoints.length > 0 && (
                <>
                  <BandLabel className={hasRewards ? "mt-4" : ""}>{t("session.turningPoints")}</BandLabel>
                  <div className="space-y-2">
                    {turningPoints.map((tp, i) => (
                      <div key={i} className="relative pl-5">
                        <Milestone size={12} className="absolute left-0 top-1 text-accent-gold" />
                        <p className="font-display text-[15px] leading-snug text-text-base">{tp.description}</p>
                        {tp.consequence && <p className="text-xs text-text-muted mt-0.5">{tp.consequence}</p>}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {followUp && (
                <div className="mt-3 rounded-md border border-accent-purple/25 bg-accent-purple/[0.07] px-3 py-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent-purple mb-0.5">{t("session.followUp")}</div>
                  <p className="text-[12.5px] text-text-muted whitespace-pre-wrap">{followUp}</p>
                </div>
              )}

              {eventLog.length > 0 && (
                <details className="mt-3 group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-accent-green [&::-webkit-details-marker]:hidden">
                    <Clock size={12} />
                    {t("session.events")}
                    <ChevronRight size={12} className="ml-auto text-text-faint transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="mt-1.5 space-y-1">
                    {eventLog.map((evt, i) => (
                      <div key={i} className="flex gap-2.5 text-xs text-text-muted">
                        <span className="shrink-0 font-mono tabular-nums text-[11px] text-text-faint">{evt.timestamp}</span>
                        <span>{evt.text}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
