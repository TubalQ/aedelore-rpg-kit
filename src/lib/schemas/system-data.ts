import { z } from "zod";

// Validation for game-system data edited in /system-admin. Structural schemas
// mirror src/systems/types.ts; crossRefErrors() adds the cross-field checks that
// make edited data "land right" (a bonus that names a real attribute, a starting
// weapon that exists, spells keyed by a real class, ...).

const startingEquipment = z.object({
  weapon: z.string(),
  food: z.string(),
  gold: z.number(),
  worthiness: z.number(),
  hp: z.number(),
});

// Optional per-entry localized labels (override the code i18n dict; set in the
// editor). Declared on every entry schema so z.object doesn't strip them.
const labels = { labelSv: z.string().optional(), labelEn: z.string().optional() };

const raceData = z.object({
  name: z.string().min(1),
  ...labels,
  bonuses: z.array(z.string()),
  startingEquipment,
});

const namedDef = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ names: z.array(z.string()), data: z.record(z.string(), item) });

export const races = namedDef(raceData);

const classData = z.object({
  name: z.string().min(1),
  ...labels,
  bonuses: z.array(z.string()),
  startingEquipment: z.object({}).passthrough(),
  abilityType: z.enum(["weakened", "arcana"]),
  arcanaMax: z.number(),
  arcanaStart: z.number(),
  spellSlots: z.number(),
});
export const classes = namedDef(classData);

const religionData = z.object({
  name: z.string().min(1),
  ...labels,
  deity: z.string(),
  description: z.string(),
  bonuses: z.array(z.string()),
});
export const religions = namedDef(religionData);

const weaponData = z.object({
  name: z.string().min(1),
  type: z.string(),
  subtype: z.string(),
  ability: z.string(),
  bonus: z.string(),
  damage: z.string(),
  range: z.string(),
  break: z.number(),
});
export const weapons = z.object({
  weapons: z.array(weaponData),
  ammunition: z.array(z.object({ name: z.string(), cost: z.string() })),
  // Optional so a weapons row that predates the field still validates; the
  // editor always writes it and deploys backfill it.
  categories: z.array(z.string()).optional(),
  subtypes: z.array(z.string()).optional(),
  abilities: z.array(z.string()).optional(),
});

const armorData = z.object({
  name: z.string().min(1),
  bodypart: z.string(),
  type: z.string(),
  hp: z.number(),
  ac: z.number(),
  disadvantage: z.string().nullable(),
});
export const armor = z.object({
  armor: z.array(armorData),
  shields: z.array(
    z.object({
      name: z.string(),
      hp: z.number(),
      ac: z.number(),
      damage: z.string(),
      disadvantage: z.string().nullable(),
    }),
  ),
  baseAc: z.number(),
  bodyParts: z.array(z.string()),
  weights: z.array(z.string()).optional(),
});

const spellData = z.object({
  name: z.string().min(1),
  check: z.string().nullable(),
  damage: z.string(),
  arcana: z.number().nullable(),
  weakened: z.number().nullable(),
  desc: z.string(),
  gain: z.number().nullable(),
  dc: z.number().nullable(),
});
export const spells = z.record(z.string(), z.array(spellData));

// transforms: accepted structurally (passthrough) for now.
export const transforms = z.record(z.string(), z.object({}).passthrough());

// attributes: attribute + skill DEFINITIONS (add/edit-able in /system-admin via
// the dedicated AttributesEditor) plus the rules scalars. Renaming an existing
// name is NOT supported from the UI (it would need a persisted-data migration).
// Inner objects `.passthrough()` so per-entry i18n labels (Phase C) ride along.
const attributeDef = z
  .object({
    name: z.string().min(1),
    ...labels,
    description: z.string(),
    minValue: z.number(),
    maxValue: z.number(),
    skills: z.array(z.string()),
  })
  .passthrough();
const skillDef = z
  .object({
    name: z.string().min(1),
    ...labels,
    attribute: z.string(),
    description: z.string(),
  })
  .passthrough();
export const attributes = z
  .object({
    attributeNames: z.array(z.string()),
    attributes: z.record(z.string(), attributeDef),
    skillNames: z.array(z.string()),
    skills: z.record(z.string(), skillDef),
    freePointsTotal: z.number(),
    maxPointsPerField: z.number(),
    maxThirdEye: z.number(),
    xpPerPoint: z.number(),
  })
  .passthrough();

export const theme = z.object({
  name: z.string().min(1),
  description: z.string(),
  tagline: z.string().optional(),
  accentColor: z.string().min(1),
  accentColorDim: z.string().min(1),
  displayFont: z.string(),
  avatarStyle: z.string(),
  hero: z.object({ image: z.string().optional(), eyebrow: z.string().optional() }).partial().optional(),
});

const landingLink = z.object({ label: z.string(), href: z.string() });
const landingVerse = z.object({ num: z.string(), text: z.string() });
export const landing = z.object({
  brandLetter: z.string(),
  footer: z.string(),
  sideNav: z.array(z.object({ href: z.string(), label: z.string(), icon: z.string() })),
  hero: z.object({
    ctaPrimary: landingLink,
    ctaSecondary: landingLink,
    scrollHint: z.string(),
  }),
  world: z.object({ chapter: z.string(), heading: z.string(), verses: z.array(landingVerse) }),
  cinematic: z.object({ image: z.string(), quote: z.string(), label: z.string() }),
  ages: z.object({ chapter: z.string(), heading: z.string(), verses: z.array(landingVerse) }),
  races: z.object({
    chapter: z.string(),
    heading: z.string(),
    wikiBook: z.string(),
    items: z.array(z.object({ name: z.string(), desc: z.string() })),
  }),
  classes: z.object({
    chapter: z.string(),
    heading: z.string(),
    wikiBook: z.string(),
    items: z.array(z.object({ name: z.string(), slug: z.string(), desc: z.string() })),
  }),
});

// User-selectable colour palettes (per-user theme picker). Record keyed by
// palette id; colours are a free-form map of CSS-var-name → value.
export const palettes = z.record(
  z.string(),
  z.object({
    label: z.string(),
    description: z.string(),
    colors: z.record(z.string(), z.string()),
  }),
);

export const KIND_SCHEMAS: Record<string, z.ZodTypeAny> = {
  races,
  classes,
  religions,
  weapons,
  armor,
  spells,
  transforms,
  attributes,
  theme,
  landing,
  palettes,
};

/**
 * Cross-reference checks against the *other* kinds' current data. Returns a
 * list of human-readable problems (empty = ok). `refs` supplies the valid names
 * a reference may point at.
 */
export interface CrossRefs {
  attributeNames: string[];
  skillNames: string[];
  weaponNames: string[];
  classNames: string[];
  shieldNames: string[];
  armorNames: string[];
  bodyParts: string[];
}

type ClassEntry = {
  bonuses?: string[];
  startingEquipment?: {
    weapon?: string;
    shield?: string;
    armor?: Record<string, string>;
  };
};

export interface CrossRefResult {
  /** Hard problems the game logic depends on - block saving. */
  errors: string[];
  /** Advisory mismatches (e.g. a bonus naming an unknown stat) - saved anyway. */
  warnings: string[];
}

// Extra bonus targets that aren't attributes/skills but are legitimate (a
// system can hand out worthiness, HP, AC, ...). Keeps the bonus check from
// nagging about well-known non-attribute stats.
const SPECIAL_BONUS_STATS = ["Worthiness", "HP", "AC", "Initiative", "Movement", "Speed"];

export function crossRefErrors(kind: string, data: unknown, refs: CrossRefs): CrossRefResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const statNames = new Set([...refs.attributeNames, ...refs.skillNames, ...SPECIAL_BONUS_STATS]);
  // A reference is only enforced when the valid set is known (non-empty), so a
  // missing/empty source never produces false errors.
  const bad = (value: string | undefined, valid: string[]) =>
    !!value && valid.length > 0 && !valid.includes(value);

  // Bonuses are free text ("Proficiency with all weapons", "Starting Gold: 5")
  // OR stat modifiers ("+1 Strength"). Only the stat-modifier form is checked,
  // and only as a WARNING - bonus-calc silently ignores names it can't resolve.
  const checkBonus = (b: string, where: string) => {
    const m = b.match(/^[+-]?\d+\s+(.+)$/);
    if (!m) return; // descriptive text, not a stat bonus
    const stat = m[1].trim();
    if (refs.attributeNames.length > 0 && !statNames.has(stat)) {
      warnings.push(`${where}: bonus "${b}" names "${stat}", which is not a known attribute or skill.`);
    }
  };

  if ((kind === "races" || kind === "classes" || kind === "religions") && data && typeof data === "object") {
    const d = (data as { data?: Record<string, ClassEntry> }).data ?? {};
    for (const [name, entry] of Object.entries(d)) {
      const where = `${kind} "${name}"`;
      for (const b of entry.bonuses ?? []) checkBonus(b, where);
      if (kind === "religions") continue;

      const se = entry.startingEquipment ?? {};
      if (bad(se.weapon, refs.weaponNames)) {
        errors.push(`${where}: starting weapon "${se.weapon}" is not a defined weapon.`);
      }
      if (bad(se.shield, refs.shieldNames)) {
        errors.push(`${where}: starting shield "${se.shield}" is not a defined shield.`);
      }
      for (const [slot, armorName] of Object.entries(se.armor ?? {})) {
        if (bad(slot, refs.bodyParts)) {
          errors.push(`${where}: armor slot "${slot}" is not a defined body part.`);
        }
        if (bad(armorName, refs.armorNames)) {
          errors.push(`${where}: starting armor "${armorName}" is not a defined armor.`);
        }
      }
    }
  }

  if (kind === "weapons" && data && typeof data === "object") {
    for (const w of (data as { weapons?: { name?: string; ability?: string }[] }).weapons ?? []) {
      // Compound abilities like "Strength/Dexterity" (finesse) are allowed;
      // check each part. Advisory only.
      const parts = (w.ability ?? "").split("/").map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        if (bad(part, refs.attributeNames)) {
          warnings.push(`weapon "${w.name}": ability "${part}" is not an attribute.`);
        }
      }
    }
  }

  if (kind === "armor" && data && typeof data === "object") {
    for (const a of (data as { armor?: { name?: string; bodypart?: string }[] }).armor ?? []) {
      if (bad(a.bodypart, refs.bodyParts)) {
        errors.push(`armor "${a.name}": body part "${a.bodypart}" is not a defined body part.`);
      }
    }
  }

  if (kind === "spells" && data && typeof data === "object") {
    for (const cls of Object.keys(data as object)) {
      if (refs.classNames.length > 0 && !refs.classNames.includes(cls)) {
        errors.push(`spells: "${cls}" is not a defined class.`);
      }
    }
  }

  return { errors, warnings };
}
