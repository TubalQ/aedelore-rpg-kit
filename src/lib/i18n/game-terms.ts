import type { Locale } from "@/stores/locale-store";
import { getSystem } from "@/systems/runtime";

// Per-entry localized labels set in /system-admin override the hardcoded dicts
// below (so an editor-ADDED race/attribute/etc. gets a proper sv/en label). The
// code dicts stay as the default fallback for the built-in Aedelore terms.
function liveLabel(entry: { labelSv?: string; labelEn?: string } | undefined, locale: Locale): string | undefined {
  if (!entry) return undefined;
  const v = locale === "sv" ? entry.labelSv : entry.labelEn;
  return v && v.trim() ? v : undefined;
}

const attributeNames: Record<string, Record<Locale, string>> = {
  Strength: { sv: "Styrka", en: "Strength" },
  Dexterity: { sv: "Smidighet", en: "Dexterity" },
  Toughness: { sv: "Seghet", en: "Toughness" },
  Intelligence: { sv: "Intelligens", en: "Intelligence" },
  Wisdom: { sv: "Visdom", en: "Wisdom" },
  "Force of Will": { sv: "Viljekraft", en: "Force of Will" },
  "Third Eye": { sv: "Tredje ögat", en: "Third Eye" },
};

const skillNames: Record<string, Record<Locale, string>> = {
  Athletics: { sv: "Fysik", en: "Athletics" },
  "Raw Power": { sv: "Rå kraft", en: "Raw Power" },
  Unarmed: { sv: "Obeväpnad strid", en: "Unarmed" },
  Endurance: { sv: "Uthållighet", en: "Endurance" },
  Acrobatics: { sv: "Akrobatik", en: "Acrobatics" },
  "Sleight of Hand": { sv: "Fingerfärdighet", en: "Sleight of Hand" },
  Stealth: { sv: "Smyg", en: "Stealth" },
  "Bonus While Injured": { sv: "Bonus vid skada", en: "Bonus While Injured" },
  Resistance: { sv: "Motstånd", en: "Resistance" },
  Arcana: { sv: "Arcana", en: "Arcana" },
  History: { sv: "Historia", en: "History" },
  Investigation: { sv: "Undersökning", en: "Investigation" },
  Nature: { sv: "Natur", en: "Nature" },
  Religion: { sv: "Religion", en: "Religion" },
  Luck: { sv: "Tur", en: "Luck" },
  "Animal Handling": { sv: "Djurhantering", en: "Animal Handling" },
  Deception: { sv: "Bluff", en: "Deception" },
  Intimidation: { sv: "Skrämsel", en: "Intimidation" },
  Performance: { sv: "Uppträdande", en: "Performance" },
  Persuasion: { sv: "Övertalning", en: "Persuasion" },
};

const raceNames: Record<string, Record<Locale, string>> = {
  Human: { sv: "Människa", en: "Human" },
  Dwarf: { sv: "Dvärg", en: "Dwarf" },
  Halfling: { sv: "Halvling", en: "Halfling" },
  "High Elf": { sv: "Högalv", en: "High Elf" },
  "Moon Elf": { sv: "Månalv", en: "Moon Elf" },
  Orc: { sv: "Ork", en: "Orc" },
  Troll: { sv: "Troll", en: "Troll" },
  "Half-Elf": { sv: "Halvalv", en: "Half-Elf" },
};

const classNames: Record<string, Record<Locale, string>> = {
  Warrior: { sv: "Krigare", en: "Warrior" },
  "Thief/Rogue": { sv: "Tjuv/Skurk", en: "Thief/Rogue" },
  Outcast: { sv: "Utstött", en: "Outcast" },
  Mage: { sv: "Magier", en: "Mage" },
  Hunter: { sv: "Jägare", en: "Hunter" },
  Druid: { sv: "Druid", en: "Druid" },
  Warden: { sv: "Väktare", en: "Warden" },
  Ascendant: { sv: "Upphöjd", en: "Ascendant" },
  Revenant: { sv: "Revenant", en: "Revenant" },
};

const religionNames: Record<string, Record<Locale, string>> = {
  "Creed of Shadows (Noctara)": { sv: "Skuggornas credo (Noctara)", en: "Creed of Shadows (Noctara)" },
  "The Shattered Path (Tatsu)": { sv: "Den söndrade vägen (Tatsu)", en: "The Shattered Path (Tatsu)" },
  "The Silent Hunt (Groove Guardian)": { sv: "Den stilla jakten (Lundens väktare)", en: "The Silent Hunt (Groove Guardian)" },
  "The Stone's Heart (Great Mountain)": { sv: "Klippans hjärta (Det stora berget)", en: "The Stone's Heart (Great Mountain)" },
  "The Veil of Tohu": { sv: "Tohus slöja", en: "The Veil of Tohu" },
  "Earthsong Covenant": { sv: "Jordsångens pakt", en: "Earthsong Covenant" },
  "The Flame of Taninsam": { sv: "Taninsams låga", en: "The Flame of Taninsam" },
  "Nature's Embrace (Tiamat)": { sv: "Naturens famntag (Tiamat)", en: "Nature's Embrace (Tiamat)" },
  "The Soul of the Clan": { sv: "Klanens själ", en: "The Soul of the Clan" },
  "The Abyssal Veil": { sv: "Avgrundens slöja", en: "The Abyssal Veil" },
  "The Radiant Path": { sv: "Den lysande stigen", en: "The Radiant Path" },
  "The Black Rebellion": { sv: "Det svarta upproret", en: "The Black Rebellion" },
  "The Arcane Creed": { sv: "Det arkana credot", en: "The Arcane Creed" },
  "The Voices of the Forgotten Loa": { sv: "De bortglömda Loaernas röster", en: "The Voices of the Forgotten Loa" },
  "The Doctrine of Emanations": { sv: "Emanationernas lära", en: "The Doctrine of Emanations" },
  None: { sv: "Ingen", en: "None" },
};

const bodyParts: Record<string, Record<Locale, string>> = {
  head: { sv: "Huvud", en: "Head" },
  shoulders: { sv: "Axlar", en: "Shoulders" },
  chest: { sv: "Bröst", en: "Chest" },
  hands: { sv: "Händer", en: "Hands" },
  legs: { sv: "Ben", en: "Legs" },
  feet: { sv: "Fötter", en: "Feet" },
};

// Kanoniskt statnamn ur godtycklig inmatning: matchar case-okänsligt mot både
// kanoniska engelska namn och sv/en-etiketter. Historiska utrustningsbonusar
// skrevs som fritext ("styrka", "STR-varianter" osv.) och räknades aldrig
// eftersom bonus-beräkningen jämför exakt sträng - via den här slår redan
// tilldelade föremål igenom i builden också.
const statNameLookup: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const tables of [attributeNames, skillNames]) {
    for (const [canonical, locales] of Object.entries(tables)) {
      map[canonical.toLowerCase()] = canonical;
      for (const label of Object.values(locales)) map[label.toLowerCase()] = canonical;
    }
  }
  return map;
})();

export function normalizeStatName(raw: string): string | null {
  return statNameLookup[raw.trim().toLowerCase()] ?? null;
}

export function tAttr(name: string, locale: Locale): string {
  return liveLabel(getSystem().attributes.attributes[name], locale) ?? attributeNames[name]?.[locale] ?? name;
}

export function tSkill(name: string, locale: Locale): string {
  return liveLabel(getSystem().attributes.skills[name], locale) ?? skillNames[name]?.[locale] ?? name;
}

export function tRace(name: string, locale: Locale): string {
  return liveLabel(getSystem().races.data[name], locale) ?? raceNames[name]?.[locale] ?? name;
}

export function tClass(name: string, locale: Locale): string {
  return liveLabel(getSystem().classes.data[name], locale) ?? classNames[name]?.[locale] ?? name;
}

export function tReligion(name: string, locale: Locale): string {
  return liveLabel(getSystem().religions.data[name], locale) ?? religionNames[name]?.[locale] ?? name;
}

export function tBodyPart(name: string, locale: Locale): string {
  return bodyParts[name]?.[locale] ?? name;
}
