import type { EquipmentType, Rarity } from "@/lib/schemas/character";
import type { TranslationKey } from "@/lib/i18n";

export { EQUIPMENT_TYPES, RARITIES, type EquipmentType, type Rarity } from "@/lib/schemas/character";

export const RARITY_LABEL_KEYS: Record<Rarity, TranslationKey> = {
  common: "sessionCard.equipment.rarityCommon",
  enchanted: "sessionCard.equipment.rarityEnchanted",
  rare: "sessionCard.equipment.rarityRare",
  legendary: "sessionCard.equipment.rarityLegendary",
};

export const EQUIPMENT_TYPE_LABEL_KEYS: Record<EquipmentType, TranslationKey> = {
  weapon: "sessionCard.equipment.typeWeapon",
  armor: "sessionCard.equipment.typeArmor",
  shield: "sessionCard.equipment.typeShield",
  misc: "sessionCard.equipment.typeMisc",
};
