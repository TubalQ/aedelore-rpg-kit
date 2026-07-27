import Link from "next/link";
import {
  BookOpen,
  Users,
  Swords,
  Shield,
  Scroll,
  Map,
  Castle,
  Crown,
  Compass,
  Flame,
  Moon,
  Star,
  Sparkles,
  Feather,
  Home,
  Globe,
  Mountain,
  Skull,
  LogIn,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { HeroMotes } from "@/components/HeroMotes";
import { loadActiveSystem } from "@/systems/load";

const ART = "/uploads/images/gallery/2025-09/scaled-1680-";

// String icon name (from the landing config) → Lucide component. Keep in sync
// with LANDING_ICONS in system-admin/specs.ts. Unknown names fall back to a
// neutral icon so a bad value never crashes the splash.
const LANDING_ICON_MAP: Record<string, LucideIcon> = {
  Map,
  Scroll,
  Users,
  Swords,
  Shield,
  BookOpen,
  Castle,
  Crown,
  Compass,
  Flame,
  Moon,
  Star,
  Sparkles,
  Feather,
  Home,
  Globe,
  Mountain,
  Skull,
};

const navIcon = (name: string): LucideIcon => LANDING_ICON_MAP[name] ?? BookOpen;

export default async function LandingPage() {
  // Live theme + landing content from the DB-backed active system.
  const { theme, landing } = await loadActiveSystem();
  return (
    <div className="relative min-h-screen bg-bg-base">
      <nav className="fixed left-0 top-0 bottom-0 z-40 w-16 hidden md:flex flex-col items-center py-6 gap-6 bg-bg-surface/80 backdrop-blur-sm border-r border-border">
        <Link href="/" className="font-display text-xl font-bold text-accent-gold mb-4" title={theme.name}>
          {landing.brandLetter}
        </Link>
        {landing.sideNav.map(({ href, label, icon }) => {
          const Icon = navIcon(icon);
          return (
            <Link
              key={href}
              href={href}
              className="p-2 text-text-muted hover:text-accent-gold transition-colors"
              title={label}
            >
              <Icon size={20} />
            </Link>
          );
        })}
        <div className="mt-auto">
          <Link
            href="/login"
            className="p-2 text-text-muted hover:text-accent-gold transition-colors"
            title="Sign in"
          >
            <LogIn size={20} />
          </Link>
        </div>
      </nav>

      {/* Mobil: toppbar med samma nav - sidorailen är dold <md och lämnade
          annars ankarlänkar + inloggning helt oåtkomliga på telefon. */}
      <nav className="fixed inset-x-0 top-0 z-40 flex items-center gap-1 px-3 h-12 md:hidden bg-bg-surface/80 backdrop-blur-sm border-b border-border">
        <Link href="/" className="font-display text-lg font-bold text-accent-gold mr-1" title={theme.name}>
          {landing.brandLetter}
        </Link>
        {landing.sideNav.map(({ href, label, icon }) => {
          const Icon = navIcon(icon);
          return (
            <Link
              key={href}
              href={href}
              className="p-2.5 text-text-muted hover:text-accent-gold transition-colors"
              title={label}
            >
              <Icon size={20} />
            </Link>
          );
        })}
        <Link
          href="/login"
          className="ml-auto p-2.5 text-text-muted hover:text-accent-gold transition-colors"
          title="Sign in"
        >
          <LogIn size={20} />
        </Link>
      </nav>

      <div className="md:pl-16">
        <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
          {/* Bakgrundskonst (från temat) */}
          {theme.hero?.image && (
            <img
              src={`${ART}/${theme.hero.image}`}
              alt=""
              aria-hidden="true"
              fetchPriority="high"
              className="hero-drift pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_30%]"
            />
          )}
          {/* Ljusstrålar */}
          <div
            aria-hidden="true"
            className="hero-rays pointer-events-none absolute inset-x-0 -top-[20%] h-[120%] mix-blend-screen"
            style={{
              background:
                "linear-gradient(100deg,transparent 40%,rgba(150,200,220,.06) 47%,transparent 52%),linear-gradient(80deg,transparent 55%,rgba(150,200,220,.05) 60%,transparent 66%)",
            }}
          />
          <HeroMotes />
          {/* Scrim + vinjett */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 8%, rgba(120,180,200,.10), transparent 55%), linear-gradient(180deg, rgba(10,10,15,.55) 0%, rgba(10,10,15,.28) 34%, rgba(10,10,15,.74) 78%, var(--color-bg-base) 100%)",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ boxShadow: "inset 0 0 220px 70px rgba(0,0,0,.72)" }}
          />
          {/* Innehåll */}
          <div className="relative z-10 flex max-w-3xl flex-col items-center gap-5">
            <span className="text-xs font-semibold uppercase tracking-[0.34em] text-accent-gold/75">
              {theme.hero?.eyebrow}
            </span>
            <h1 className="hero-breathe font-display text-6xl font-semibold leading-none tracking-wide text-accent-gold sm:text-7xl lg:text-8xl">
              {theme.name}
            </h1>
            <p className="font-display text-lg italic text-text-base/90 sm:text-xl">
              {theme.tagline}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-4">
              <Link
                href={landing.hero.ctaPrimary.href}
                className="rounded-md bg-accent-gold px-8 py-3.5 font-semibold text-bg-base shadow-[0_8px_30px_rgba(201,168,76,.22)] transition-all hover:brightness-110"
              >
                {landing.hero.ctaPrimary.label}
              </Link>
              <Link
                href={landing.hero.ctaSecondary.href}
                className="rounded-md border border-border/80 bg-black/20 px-8 py-3.5 text-text-base backdrop-blur-sm transition-all hover:border-accent-gold/50 hover:text-accent-gold"
              >
                {landing.hero.ctaSecondary.label}
              </Link>
            </div>
          </div>
          <span className="scroll-bob absolute bottom-7 left-1/2 text-[0.68rem] uppercase tracking-[0.3em] text-text-muted/70">
            {landing.hero.scrollHint}
          </span>
        </section>

        <section id="world" className="scroll-mt-14 md:scroll-mt-0 max-w-3xl mx-auto px-6 py-24">
          <p className="text-xs text-text-faint tracking-widest uppercase mb-2">{landing.world.chapter}</p>
          <h2 className="font-display text-3xl text-accent-gold mb-8">{landing.world.heading}</h2>
          <div className="space-y-6">
            {landing.world.verses.map((v) => (
              <p key={v.num} className="text-text-muted leading-relaxed">
                <span className="text-accent-gold-dim font-display mr-2">{v.num}.</span>
                {v.text}
              </p>
            ))}
          </div>
        </section>

        {/* Filmiskt band */}
        {landing.cinematic.image && (
          <section className="relative flex min-h-[62vh] items-center justify-center overflow-hidden px-6 py-[10vh] text-center">
            <img
              src={`${ART}/${landing.cinematic.image}`}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_34%]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, var(--color-bg-base), rgba(10,10,15,.5) 30%, rgba(10,10,15,.6) 70%, var(--color-bg-base)), radial-gradient(60% 60% at 50% 50%, transparent, rgba(10,10,15,.5))",
              }}
            />
            <div className="relative z-10 max-w-2xl">
              <p className="text-balance font-display text-2xl italic leading-snug text-text-base drop-shadow-[0_2px_20px_rgba(0,0,0,.8)] sm:text-3xl">
                {landing.cinematic.quote}
              </p>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-accent-gold/70">
                {landing.cinematic.label}
              </p>
            </div>
          </section>
        )}

        <section id="ages" className="scroll-mt-14 md:scroll-mt-0 max-w-3xl mx-auto px-6 py-24">
          <p className="text-xs text-text-faint tracking-widest uppercase mb-2">{landing.ages.chapter}</p>
          <h2 className="font-display text-3xl text-accent-gold mb-8">{landing.ages.heading}</h2>
          <div className="space-y-6">
            {landing.ages.verses.map((v) => (
              <p key={v.num} className="text-text-muted leading-relaxed">
                <span className="text-accent-gold-dim font-display mr-2">{v.num}.</span>
                {v.text}
              </p>
            ))}
          </div>
        </section>

        <div className="border-t border-border max-w-md mx-auto" />

        <section id="races" className="scroll-mt-14 md:scroll-mt-0 max-w-5xl mx-auto px-6 py-24">
          <p className="text-xs text-text-faint tracking-widest uppercase mb-2">{landing.races.chapter}</p>
          <h2 className="font-display text-3xl text-accent-gold mb-8">{landing.races.heading}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {landing.races.items.map((race) => (
              <Link
                key={race.name}
                href={`/wiki/${landing.races.wikiBook}/${race.name.toLowerCase().replace(/ /g, "-")}`}
                className="group p-5 bg-bg-surface border border-border rounded-lg hover:border-accent-gold/40 transition-colors"
              >
                <h3 className="font-display text-base text-text-base group-hover:text-accent-gold transition-colors">
                  {race.name}
                </h3>
                <p className="mt-2 text-xs text-text-muted line-clamp-3">{race.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <div className="border-t border-border max-w-md mx-auto" />

        <section id="classes" className="scroll-mt-14 md:scroll-mt-0 max-w-5xl mx-auto px-6 py-24">
          <p className="text-xs text-text-faint tracking-widest uppercase mb-2">{landing.classes.chapter}</p>
          <h2 className="font-display text-3xl text-accent-gold mb-8">{landing.classes.heading}</h2>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-3">
            {landing.classes.items.map((cls) => (
              <Link
                key={cls.name}
                href={`/wiki/${landing.classes.wikiBook}/${cls.slug}`}
                className="group p-5 bg-bg-surface border border-border rounded-lg hover:border-accent-purple/40 transition-colors"
              >
                <h3 className="font-display text-base text-text-base group-hover:text-accent-purple transition-colors">
                  {cls.name}
                </h3>
                <p className="mt-2 text-xs text-text-muted">{cls.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <footer className="border-t border-border py-12 text-center">
          <p className="text-text-faint text-sm">{landing.footer}</p>
        </footer>
      </div>
    </div>
  );
}
