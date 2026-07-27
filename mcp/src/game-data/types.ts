// Game data is fetched live from the app's /api/game-data endpoint.
// Types here describe that JSON shape, not the domain model.
// The domain source of truth is the app (src/lib/domain + system_data DB).

export interface GameDataCache {
  weapons: WeaponsData;
  armor: ArmorData;
  shields: ShieldEntry[];
  spells: Record<string, SpellEntry[]>;
  races: NamedDataCollection;
  classes: NamedDataCollection;
  religions: NamedDataCollection;
  attributes: AttributesData;
}

interface WeaponsData {
  weapons: WeaponEntry[];
  ammunition: AmmunitionEntry[];
}

export interface WeaponEntry {
  name: string;
  type: string;
  subtype: string;
  ability: string;
  bonus: string;
  damage: string;
  range: string;
  break: number;
}

interface AmmunitionEntry {
  name: string;
  cost: string;
}

interface ArmorData {
  armor: ArmorEntry[];
  shields: ShieldEntry[];
  baseAc: number;
  bodyParts: string[];
}

export interface ArmorEntry {
  name: string;
  bodypart: string;
  type: string;
  hp: number;
  ac: number;
  disadvantage: string | null;
}

export interface ShieldEntry {
  name: string;
  hp: number;
  ac: number;
  damage: string;
  disadvantage: string | null;
}

export interface SpellEntry {
  name: string;
  check: string;
  damage: string;
  arcana: number | null;
  weakened: number | null;
  desc: string;
  gain: string | null;
  dc: number | null;
}

export interface NamedDataCollection {
  names: string[];
  data: Record<string, Record<string, unknown>>;
}

interface AttributesData {
  attributeNames: string[];
  attributes: Record<string, Record<string, unknown>>;
  skillNames: string[];
  skills: Record<string, Record<string, unknown>>;
  freePointsTotal: number;
  maxPointsPerField: number;
  maxThirdEye: number;
}

export type GameDataType =
  | "weapons"
  | "armor"
  | "shields"
  | "spells"
  | "races"
  | "classes"
  | "religions"
  | "attributes";
