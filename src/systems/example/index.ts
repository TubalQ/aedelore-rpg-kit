import type {
  GameSystem,
  RacesDefinition,
  ClassesDefinition,
  ReligionsDefinition,
  WeaponsDefinition,
  ArmorDefinition,
  SpellsDefinition,
  TransformsDefinition,
  AttributesDefinition,
  ThemeConfig,
  LandingConfig,
  PalettesDefinition,
} from "@/systems/types";
import racesJson from "./races.json";
import classesJson from "./classes.json";
import religionsJson from "./religions.json";
import weaponsJson from "./weapons.json";
import armorJson from "./armor.json";
import spellsJson from "./spells.json";
import transformsJson from "./transforms.json";
import attributesJson from "./attributes.json";
import themeJson from "./theme.json";
import landingJson from "./landing.json";
import palettesJson from "./palettes.json";

// A minimal generic starter system. Copy this folder, rename
// it, and edit the JSON to build your own tabletop RPG.
export const example: GameSystem = {
  id: "example",
  name: "Example Fantasy",
  races: racesJson as unknown as RacesDefinition,
  classes: classesJson as unknown as ClassesDefinition,
  religions: religionsJson as unknown as ReligionsDefinition,
  weapons: weaponsJson as unknown as WeaponsDefinition,
  armor: armorJson as unknown as ArmorDefinition,
  spells: spellsJson as unknown as SpellsDefinition,
  transforms: transformsJson as unknown as TransformsDefinition,
  attributes: attributesJson as unknown as AttributesDefinition,
  theme: themeJson as unknown as ThemeConfig,
  landing: landingJson as unknown as LandingConfig,
  palettes: palettesJson as unknown as PalettesDefinition,
};
