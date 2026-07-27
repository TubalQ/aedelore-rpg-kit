// ─── Game System Definition - types ─────────────────────
//
// A "system" is a swappable bundle of rules-data + (later)
// theme + seed content that turns this platform into ONE
// specific tabletop RPG. Aedelore is one such system; the
// `example` system is a minimal generic starter.
//
// PoC scope: only `races` is config-driven so far. Classes,
// religions, items, spells, attributes, rules text and theme
// follow in later phases and get added to `GameSystem` here.

export interface StartingEquipment {
  readonly weapon: string;
  readonly food: string;
  readonly gold: number;
  readonly worthiness: number;
  readonly hp: number;
}

export interface RaceData {
  readonly name: string;
  /** Optional localized display labels (override the code i18n dict). */
  readonly labelSv?: string;
  readonly labelEn?: string;
  readonly bonuses: readonly string[];
  readonly startingEquipment: StartingEquipment;
}

export interface RacesDefinition {
  /** Ordered list of race names (drives selection UIs). */
  readonly names: readonly string[];
  /** Race name → full race data. */
  readonly data: Readonly<Record<string, RaceData>>;
}

export type ArmorSlot = "head" | "chest" | "shoulders" | "legs";
export type AbilityType = "weakened" | "arcana";

export interface ClassData {
  readonly name: string;
  /** Optional localized display labels (override the code i18n dict). */
  readonly labelSv?: string;
  readonly labelEn?: string;
  readonly bonuses: readonly string[];
  readonly startingEquipment: {
    readonly armor: Partial<Record<ArmorSlot, string>>;
    readonly shield?: string;
    readonly weapon: string;
    readonly gold: number;
    readonly worthiness: number;
    readonly abilities?: number;
    readonly hpBonus: number;
    readonly arcana?: string;
    readonly spells?: number;
    readonly food?: string;
    readonly ammo?: string;
  };
  readonly abilityType: AbilityType;
  readonly arcanaMax: number;
  readonly arcanaStart: number;
  readonly spellSlots: number;
}

export interface ClassesDefinition {
  readonly names: readonly string[];
  readonly data: Readonly<Record<string, ClassData>>;
}

export interface ReligionData {
  readonly name: string;
  /** Optional localized display labels (override the code i18n dict). */
  readonly labelSv?: string;
  readonly labelEn?: string;
  readonly deity: string;
  readonly description: string;
  readonly bonuses: readonly string[];
}

export interface ReligionsDefinition {
  readonly names: readonly string[];
  readonly data: Readonly<Record<string, ReligionData>>;
}

export interface WeaponData {
  readonly name: string;
  readonly type: string;
  readonly subtype: string;
  readonly ability: string;
  readonly bonus: string;
  readonly damage: string;
  readonly range: string;
  readonly break: number;
}

export interface AmmunitionData {
  readonly name: string;
  readonly cost: string;
}

export interface WeaponsDefinition {
  readonly weapons: readonly WeaponData[];
  readonly ammunition: readonly AmmunitionData[];
  /** Ordered weapon `type` values used to group the equipment dropdowns. */
  readonly categories: readonly string[];
  /** Weapon `subtype` taxonomy (editor reference list). */
  readonly subtypes: readonly string[];
  /** Attributes a weapon's ATK can key off (editor reference list). */
  readonly abilities: readonly string[];
}

export interface ArmorData {
  readonly name: string;
  readonly bodypart: string;
  readonly type: string;
  readonly hp: number;
  readonly ac: number;
  readonly disadvantage: string | null;
}

export interface ShieldData {
  readonly name: string;
  readonly hp: number;
  readonly ac: number;
  readonly damage: string;
  readonly disadvantage: string | null;
}

export interface ArmorDefinition {
  readonly armor: readonly ArmorData[];
  readonly shields: readonly ShieldData[];
  readonly baseAc: number;
  readonly bodyParts: readonly string[];
  /** Armor weight classes (editor reference list). */
  readonly weights: readonly string[];
}

export interface SpellData {
  readonly name: string;
  readonly check: string | null;
  readonly damage: string;
  readonly arcana: number | null;
  readonly weakened: number | null;
  readonly desc: string;
  readonly gain: number | null;
  readonly dc: number | null;
}

export type SpellsDefinition = Readonly<Record<string, readonly SpellData[]>>;

export interface TransformAttack {
  readonly name: string;
  readonly atk: string;
  readonly damage: string;
  readonly range: string;
}

export interface TransformForm {
  readonly name: string;
  readonly icon: string;
  readonly type: "replace";
  readonly attributes: Readonly<Record<string, number>>;
  readonly skills: Readonly<Record<string, number>>;
  readonly hp: number;
  readonly block: number;
  readonly attack: TransformAttack;
}

export interface TransformDefinition {
  readonly name: string;
  readonly triggerSpell: string;
  readonly maxCharges: number;
  readonly resetOn: "rest";
  readonly disableArcana: boolean;
  readonly forms: Readonly<Record<string, TransformForm>>;
}

export type TransformsDefinition = Readonly<Record<string, TransformDefinition>>;

export interface AttributeData {
  readonly name: string;
  /** Optional localized display labels (override the code i18n dict). */
  readonly labelSv?: string;
  readonly labelEn?: string;
  readonly description: string;
  readonly minValue: number;
  readonly maxValue: number;
  readonly skills: readonly string[];
}

export interface SkillData {
  readonly name: string;
  /** Optional localized display labels (override the code i18n dict). */
  readonly labelSv?: string;
  readonly labelEn?: string;
  readonly attribute: string;
  readonly description: string;
}

export interface AttributesDefinition {
  readonly attributeNames: readonly string[];
  readonly attributes: Readonly<Record<string, AttributeData>>;
  readonly skillNames: readonly string[];
  readonly skills: Readonly<Record<string, SkillData>>;
  readonly freePointsTotal: number;
  readonly maxPointsPerField: number;
  readonly maxThirdEye: number;
  /** XP cost to raise one attribute/skill point after creation. */
  readonly xpPerPoint: number;
}

export interface ThemeConfig {
  /** Brand / app name (page title, headers). */
  readonly name: string;
  /** Metadata description. */
  readonly description: string;
  readonly tagline?: string;
  /** Primary accent color (CSS --color-accent-gold). */
  readonly accentColor: string;
  /** Dimmed accent (CSS --color-accent-gold-dim). */
  readonly accentColorDim: string;
  /** Display font family name (wired via next/font at build time). */
  readonly displayFont: string;
  /** DiceBear collection style used for generated avatars. */
  readonly avatarStyle: string;
  readonly hero?: {
    readonly image?: string;
    readonly eyebrow?: string;
  };
}

// ─── Landing (marketing) page ────────────────────────────
// The public "/" splash. All copy + structure is data so a new operator
// re-skins the front door from the DB editor without touching page.tsx.

export interface LandingLink {
  readonly label: string;
  readonly href: string;
}

export interface LandingNavItem {
  readonly href: string;
  readonly label: string;
  /** Lucide icon name (see LANDING_ICONS in system-admin/specs.ts). */
  readonly icon: string;
}

export interface LandingVerse {
  readonly num: string;
  readonly text: string;
}

export interface LandingRaceCard {
  readonly name: string;
  readonly desc: string;
}

export interface LandingClassCard {
  readonly name: string;
  readonly slug: string;
  readonly desc: string;
}

export interface LandingConfig {
  /** Single-letter brand mark shown in the side/top rail. */
  readonly brandLetter: string;
  readonly footer: string;
  readonly sideNav: readonly LandingNavItem[];
  readonly hero: {
    readonly ctaPrimary: LandingLink;
    readonly ctaSecondary: LandingLink;
    readonly scrollHint: string;
  };
  readonly world: {
    readonly chapter: string;
    readonly heading: string;
    readonly verses: readonly LandingVerse[];
  };
  /** Full-bleed cinematic band between the World and Ages chapters. */
  readonly cinematic: {
    /** Filename under the theme art path. */
    readonly image: string;
    readonly quote: string;
    readonly label: string;
  };
  readonly ages: {
    readonly chapter: string;
    readonly heading: string;
    readonly verses: readonly LandingVerse[];
  };
  readonly races: {
    readonly chapter: string;
    readonly heading: string;
    /** Wiki book slug the cards link into. */
    readonly wikiBook: string;
    readonly items: readonly LandingRaceCard[];
  };
  readonly classes: {
    readonly chapter: string;
    readonly heading: string;
    readonly wikiBook: string;
    readonly items: readonly LandingClassCard[];
  };
}

// User-selectable colour palettes (the per-user theme picker in Settings). The
// operator defines the available palettes for their instance; each user picks
// one. Distinct from ThemeConfig (the system brand accent).
export interface PaletteConfig {
  readonly label: string;
  readonly description: string;
  /** CSS custom-property values, keyed without the `--color-` prefix. */
  readonly colors: Readonly<Record<string, string>>;
}

export type PalettesDefinition = Readonly<Record<string, PaletteConfig>>;

export interface GameSystem {
  /** Stable id, matches the folder name under src/systems/. */
  readonly id: string;
  /** Human-facing name of the system. */
  readonly name: string;
  readonly races: RacesDefinition;
  readonly classes: ClassesDefinition;
  readonly religions: ReligionsDefinition;
  readonly weapons: WeaponsDefinition;
  readonly armor: ArmorDefinition;
  readonly spells: SpellsDefinition;
  readonly transforms: TransformsDefinition;
  readonly attributes: AttributesDefinition;
  readonly theme: ThemeConfig;
  readonly landing: LandingConfig;
  readonly palettes: PalettesDefinition;
  // ── added in later phases ──
  // readonly rules: RulesText;
}
