// Field specs that drive the graphical editors. Each editable kind is either a
// "record" (named entries: races, classes, religions) or a "list" (rows:
// weapons, armor). The spec says which fields an entry/row has and how to render
// them, including cross-reference dropdowns (a starting weapon must be a real
// weapon, a bonus must name a real attribute/skill).

export type OptionSource = "attributes" | "weapons" | "bodyparts";

export type Field =
  | { key: string; label: string; type: "text" }
  | { key: string; label: string; type: "textarea" }
  | { key: string; label: string; type: "number" }
  | { key: string; label: string; type: "select"; options: string[] | OptionSource }
  | { key: string; label: string; type: "bonuses" }
  // stringlist: a repeatable array of plain strings (add/delete).
  | { key: string; label: string; type: "stringlist"; itemLabel?: string }
  | { key: string; label: string; type: "object"; fields: Field[] }
  // objectlist: a repeatable array of objects, each with `fields` (add/delete).
  | { key: string; label: string; type: "objectlist"; itemLabel?: string; fields: Field[] };

export type Palette = { label: string; accent: string; dim: string };

export type KindSpec =
  | { shape: "record"; label: string; entry: Field[] }
  // list: rows under arrayKey, plus optional top-level `scalars` (e.g. baseAc).
  | { shape: "list"; label: string; arrayKey: string; row: Field[]; scalars?: Field[] }
  // grouped: a Record<groupKey, row[]> - e.g. spells keyed by class name.
  | { shape: "grouped"; label: string; groupSource: "classes"; row: Field[] }
  // single: one object - e.g. theme. `palette` renders one dropdown that sets
  // accentColor + accentColorDim together (curated pairs that look good).
  | { shape: "single"; label: string; fields: Field[]; palette?: Palette[] };

// Display fonts bundled via next/font in app/layout.tsx. Switching is data
// (theme.displayFont); adding a NEW font needs code. Keys MUST match
// DISPLAY_FONT_VARS in app/layout.tsx.
export const DISPLAY_FONTS = ["Crimson Text", "Cinzel", "EB Garamond"];

// DiceBear collection styles bundled in /api/avatar (switching between them
// needs no code - adding a NEW one does).
export const AVATAR_STYLES = [
  "adventurer",
  "avataaars",
  "bottts",
  "lorelei",
  "micah",
  "notionists",
  "pixelArt",
  "thumbs",
];

// Lucide icon names offered for the landing side-nav. Every name here MUST be
// mapped to a component in src/app/page.tsx (LANDING_ICON_MAP) or it renders
// blank. Adding a NEW icon = add it here AND in that map.
export const LANDING_ICONS = [
  "Map",
  "Scroll",
  "Users",
  "Swords",
  "Shield",
  "BookOpen",
  "Castle",
  "Crown",
  "Compass",
  "Flame",
  "Moon",
  "Star",
  "Sparkles",
  "Feather",
  "Home",
  "Globe",
  "Mountain",
  "Skull",
];

// Curated accent + dim colour pairs.
export const PALETTES: Palette[] = [
  { label: "Gold", accent: "#c9a84c", dim: "#8a7333" },
  { label: "Crimson", accent: "#d13b3b", dim: "#8f2727" },
  { label: "Ember", accent: "#e0662f", dim: "#9c4620" },
  { label: "Rose", accent: "#e0407f", dim: "#9c2c58" },
  { label: "Violet", accent: "#9b5de5", dim: "#6b3fa0" },
  { label: "Azure", accent: "#4a90d9", dim: "#336497" },
  { label: "Emerald", accent: "#3fb37a", dim: "#2c7d55" },
  { label: "Teal", accent: "#2fb3b3", dim: "#207d7d" },
  { label: "Slate", accent: "#8a94a6", dim: "#5f6675" },
];

const startingEquipment: Field = {
  key: "startingEquipment",
  label: "Starting equipment",
  type: "object",
  fields: [
    { key: "weapon", label: "Weapon", type: "select", options: "weapons" },
    { key: "food", label: "Food", type: "text" },
    { key: "gold", label: "Gold", type: "number" },
    { key: "worthiness", label: "Worthiness", type: "number" },
    { key: "hp", label: "HP", type: "number" },
  ],
};

// Optional per-entry localized labels (override the code i18n dict). Reused
// across the record specs; the AttributesEditor adds the same pair to its
// attribute/skill rows.
export const labelFields: Field[] = [
  { key: "labelSv", label: "Label (Svenska)", type: "text" },
  { key: "labelEn", label: "Label (English)", type: "text" },
];

export const SPECS: Record<string, KindSpec> = {
  races: {
    shape: "record",
    label: "Races",
    entry: [
      { key: "name", label: "Name", type: "text" },
      ...labelFields,
      { key: "bonuses", label: "Bonuses", type: "bonuses" },
      startingEquipment,
    ],
  },
  classes: {
    shape: "record",
    label: "Classes",
    entry: [
      { key: "name", label: "Name", type: "text" },
      ...labelFields,
      { key: "bonuses", label: "Bonuses", type: "bonuses" },
      { key: "abilityType", label: "Ability type", type: "select", options: ["weakened", "arcana"] },
      { key: "arcanaMax", label: "Arcana max", type: "number" },
      { key: "arcanaStart", label: "Arcana start", type: "number" },
      { key: "spellSlots", label: "Spell slots", type: "number" },
      {
        key: "startingEquipment",
        label: "Starting equipment",
        type: "object",
        fields: [
          { key: "weapon", label: "Weapon", type: "select", options: "weapons" },
          { key: "shield", label: "Shield", type: "text" },
          { key: "gold", label: "Gold", type: "number" },
          { key: "worthiness", label: "Worthiness", type: "number" },
          { key: "hpBonus", label: "HP bonus", type: "number" },
          { key: "abilities", label: "Abilities", type: "number" },
          { key: "arcana", label: "Arcana die", type: "text" },
          { key: "spells", label: "Spells", type: "number" },
        ],
      },
    ],
  },
  religions: {
    shape: "record",
    label: "Religions",
    entry: [
      { key: "name", label: "Name", type: "text" },
      ...labelFields,
      { key: "deity", label: "Deity", type: "text" },
      { key: "description", label: "Description", type: "text" },
      { key: "bonuses", label: "Bonuses", type: "bonuses" },
    ],
  },
  weapons: {
    shape: "list",
    label: "Weapons",
    arrayKey: "weapons",
    scalars: [
      { key: "categories", label: "Weapon categories (groups the type dropdown)", type: "stringlist", itemLabel: "category" },
      { key: "subtypes", label: "Weapon subtypes", type: "stringlist", itemLabel: "subtype" },
      { key: "abilities", label: "Weapon abilities (governing attributes)", type: "stringlist", itemLabel: "ability" },
    ],
    row: [
      { key: "name", label: "Name", type: "text" },
      { key: "type", label: "Type", type: "text" },
      { key: "subtype", label: "Subtype", type: "text" },
      { key: "ability", label: "Ability", type: "select", options: "attributes" },
      { key: "bonus", label: "Bonus", type: "text" },
      { key: "damage", label: "Damage", type: "text" },
      { key: "range", label: "Range", type: "text" },
      { key: "break", label: "Break", type: "number" },
    ],
  },
  armor: {
    shape: "list",
    label: "Armor",
    arrayKey: "armor",
    scalars: [
      { key: "baseAc", label: "Base AC (before armor)", type: "number" },
      { key: "bodyParts", label: "Body parts (armor slots)", type: "stringlist", itemLabel: "body part" },
      { key: "weights", label: "Armor weight classes", type: "stringlist", itemLabel: "weight" },
    ],
    row: [
      { key: "name", label: "Name", type: "text" },
      { key: "bodypart", label: "Body part", type: "select", options: "bodyparts" },
      { key: "type", label: "Type", type: "text" },
      { key: "hp", label: "HP", type: "number" },
      { key: "ac", label: "AC", type: "number" },
      { key: "disadvantage", label: "Disadvantage", type: "text" },
    ],
  },
  spells: {
    shape: "grouped",
    label: "Spells & Abilities",
    groupSource: "classes",
    row: [
      { key: "name", label: "Name", type: "text" },
      { key: "desc", label: "Description", type: "text" },
      { key: "damage", label: "Damage", type: "text" },
      { key: "check", label: "Check", type: "text" },
      { key: "arcana", label: "Arcana cost", type: "number" },
      { key: "weakened", label: "Weakened cost", type: "number" },
      { key: "gain", label: "Gain", type: "number" },
      { key: "dc", label: "DC", type: "number" },
    ],
  },
  // Rendered by a dedicated AttributesEditor (system-admin/page.tsx), not the
  // generic SingleEditor - the attributes kind holds attribute + skill
  // DEFINITIONS (records + parallel name arrays) plus the rules scalars. The
  // fields below are the editable rules scalars (the editor renders them);
  // attribute/skill definitions are edited as lists in that component.
  attributes: {
    shape: "single",
    label: "Attributes",
    fields: [
      { key: "freePointsTotal", label: "Free points at creation", type: "number" },
      { key: "maxPointsPerField", label: "Max points per attribute/skill (creation)", type: "number" },
      { key: "maxThirdEye", label: "Max Third Eye", type: "number" },
      { key: "xpPerPoint", label: "XP cost per point (after creation)", type: "number" },
    ],
  },
  theme: {
    shape: "single",
    label: "Theme",
    palette: PALETTES,
    fields: [
      { key: "name", label: "Name (brand)", type: "text" },
      { key: "description", label: "Description", type: "text" },
      { key: "tagline", label: "Tagline", type: "text" },
      { key: "avatarStyle", label: "Avatar style", type: "select", options: AVATAR_STYLES },
      { key: "displayFont", label: "Display font", type: "select", options: DISPLAY_FONTS },
      {
        key: "hero",
        label: "Hero (landing splash)",
        type: "object",
        fields: [
          { key: "image", label: "Background image filename", type: "text" },
          { key: "eyebrow", label: "Eyebrow text", type: "text" },
        ],
      },
    ],
  },
  // Rendered by a dedicated PalettesEditor (a plain Record<id, palette>, not the
  // {names,data} record shape). The empty spec just registers the editor tab.
  palettes: {
    shape: "single",
    label: "Palettes",
    fields: [],
  },
  landing: {
    shape: "single",
    label: "Landing page",
    fields: [
      { key: "brandLetter", label: "Brand letter", type: "text" },
      { key: "footer", label: "Footer text", type: "text" },
      {
        key: "sideNav",
        label: "Side navigation",
        type: "objectlist",
        itemLabel: "link",
        fields: [
          { key: "href", label: "Link (href)", type: "text" },
          { key: "label", label: "Label", type: "text" },
          { key: "icon", label: "Icon", type: "select", options: LANDING_ICONS },
        ],
      },
      {
        key: "hero",
        label: "Hero call-to-action",
        type: "object",
        fields: [
          {
            key: "ctaPrimary",
            label: "Primary button",
            type: "object",
            fields: [
              { key: "label", label: "Label", type: "text" },
              { key: "href", label: "Link", type: "text" },
            ],
          },
          {
            key: "ctaSecondary",
            label: "Secondary button",
            type: "object",
            fields: [
              { key: "label", label: "Label", type: "text" },
              { key: "href", label: "Link", type: "text" },
            ],
          },
          { key: "scrollHint", label: "Scroll hint", type: "text" },
        ],
      },
      {
        key: "world",
        label: "Chapter - The World",
        type: "object",
        fields: [
          { key: "chapter", label: "Chapter label", type: "text" },
          { key: "heading", label: "Heading", type: "text" },
          {
            key: "verses",
            label: "Verses",
            type: "objectlist",
            itemLabel: "verse",
            fields: [
              { key: "num", label: "Numeral", type: "text" },
              { key: "text", label: "Text", type: "textarea" },
            ],
          },
        ],
      },
      {
        key: "cinematic",
        label: "Cinematic band",
        type: "object",
        fields: [
          { key: "image", label: "Image filename", type: "text" },
          { key: "quote", label: "Quote", type: "textarea" },
          { key: "label", label: "Caption", type: "text" },
        ],
      },
      {
        key: "ages",
        label: "Chapter - Ages Past",
        type: "object",
        fields: [
          { key: "chapter", label: "Chapter label", type: "text" },
          { key: "heading", label: "Heading", type: "text" },
          {
            key: "verses",
            label: "Verses",
            type: "objectlist",
            itemLabel: "verse",
            fields: [
              { key: "num", label: "Numeral", type: "text" },
              { key: "text", label: "Text", type: "textarea" },
            ],
          },
        ],
      },
      {
        key: "races",
        label: "Chapter - Races",
        type: "object",
        fields: [
          { key: "chapter", label: "Chapter label", type: "text" },
          { key: "heading", label: "Heading", type: "text" },
          { key: "wikiBook", label: "Wiki book slug", type: "text" },
          {
            key: "items",
            label: "Race cards",
            type: "objectlist",
            itemLabel: "race",
            fields: [
              { key: "name", label: "Name", type: "text" },
              { key: "desc", label: "Description", type: "textarea" },
            ],
          },
        ],
      },
      {
        key: "classes",
        label: "Chapter - Classes",
        type: "object",
        fields: [
          { key: "chapter", label: "Chapter label", type: "text" },
          { key: "heading", label: "Heading", type: "text" },
          { key: "wikiBook", label: "Wiki book slug", type: "text" },
          {
            key: "items",
            label: "Class cards",
            type: "objectlist",
            itemLabel: "class",
            fields: [
              { key: "name", label: "Name", type: "text" },
              { key: "slug", label: "Wiki slug", type: "text" },
              { key: "desc", label: "Description", type: "textarea" },
            ],
          },
        ],
      },
    ],
  },
};

export const EDITABLE_KINDS = Object.keys(SPECS);
