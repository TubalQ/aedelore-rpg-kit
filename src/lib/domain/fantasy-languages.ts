export const FANTASY_LANGUAGES = [
  { id: "common", name: "Gemensamt språk", nameEn: "Common Tongue" },
  { id: "elvish", name: "Alviska", nameEn: "Elvish" },
  { id: "draconic", name: "Drakoniska", nameEn: "Draconic" },
  { id: "dwarvish", name: "Dvärgiska", nameEn: "Dwarvish" },
] as const;

const ELVISH_MAP: [RegExp, string][] = [
  [/\bthe\b/gi, "il"],
  [/\band\b/gi, "ath"],
  [/\bof\b/gi, "en"],
  [/\bis\b/gi, "nai"],
  [/\bwas\b/gi, "anai"],
  [/th/gi, "þ"],
  [/ght/gi, "iel"],
  [/tion/gi, "siel"],
  [/ing\b/gi, "iel"],
  [/ous\b/gi, "wen"],
  [/ness\b/gi, "lith"],
  [/ment\b/gi, "arel"],
  [/ed\b/gi, "il"],
  [/er\b/gi, "ar"],
  [/le\b/gi, "el"],
  [/ck/g, "qu"],
  [/sh/gi, "ss"],
];

const DRACONIC_MAP: [RegExp, string][] = [
  [/\bthe\b/gi, "zar"],
  [/\band\b/gi, "krr"],
  [/\bof\b/gi, "vex"],
  [/\bis\b/gi, "ixz"],
  [/th/gi, "zz"],
  [/tion/gi, "xhon"],
  [/ing\b/gi, "akh"],
  [/ous\b/gi, "rix"],
  [/ness\b/gi, "krath"],
  [/ed\b/gi, "zk"],
  [/er\b/gi, "rr"],
  [/le\b/gi, "kh"],
  [/ee/g, "ii"],
  [/oo/g, "uu"],
  [/s\b/g, "zz"],
];

const DWARVISH_MAP: [RegExp, string][] = [
  [/\bthe\b/gi, "dûr"],
  [/\band\b/gi, "akh"],
  [/\bof\b/gi, "grm"],
  [/\bis\b/gi, "kaz"],
  [/th/gi, "kh"],
  [/tion/gi, "grim"],
  [/ing\b/gi, "ûng"],
  [/ous\b/gi, "ghar"],
  [/ness\b/gi, "thûn"],
  [/ed\b/gi, "ad"],
  [/er\b/gi, "ur"],
  [/le\b/gi, "ul"],
  [/ee/g, "î"],
  [/oo/g, "û"],
  [/c/g, "k"],
];

function applyMap(text: string, map: [RegExp, string][]): string {
  let result = text;
  for (const [pattern, replacement] of map) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function translateToFantasy(text: string, languageId: string): string {
  if (languageId === "common") return text;
  const words = text.split(/(\s+)/);
  return words
    .map((word) => {
      if (/^\s+$/.test(word)) return word;
      switch (languageId) {
        case "elvish": return applyMap(word, ELVISH_MAP);
        case "draconic": return applyMap(word, DRACONIC_MAP);
        case "dwarvish": return applyMap(word, DWARVISH_MAP);
        default: return word;
      }
    })
    .join("");
}
