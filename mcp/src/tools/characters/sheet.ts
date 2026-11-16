import { getGameData } from "../../game-data/loader.js";
import type {
  EquippedWeapon,
  EquippedArmor,
  EquippedShield,
  SpellSlot,
  Relationship,
  QuestItem,
  DmEquipment,
} from "../../types.js";

// The sheet's Willpower/Weakened caps are fixed game constants (the stored
// maxWillpower/maxWeakened fields are unused and always 0).
const WILLPOWER_MAX = 3;
const WEAKENED_MAX = 6;

const lock = (locked: unknown): string => (locked ? "LOCKED" : "unlocked");
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Live armor body parts in game-data order (head, shoulders, ...). */
export function bodyParts(): string[] {
  return getGameData().armor.bodyParts ?? [];
}

/**
 * One readable character sheet for both the player (get_my_character) and the
 * DM (get_character_build), so the two views can never drift apart.
 */
export function renderCharacterSheet(char: Record<string, unknown>): string {
  const d = (char.data ?? {}) as Record<string, unknown>;
  const lines: string[] = [];

  lines.push(`# ${char.name || "Unnamed"} (ID: ${char.id})`);
  let identity = `**Race:** ${d.race || "Not set"} | **Class:** ${d.class || "Not set"}`;
  if (d.religion) identity += ` | **Religion:** ${d.religion}`;
  lines.push(identity, "");
  lines.push(
    `**Locks:** Race/Class: ${lock(char.raceClassLocked)} | Attributes: ${lock(char.attributesLocked)} | Abilities: ${lock(char.abilitiesLocked)}`,
  );
  lines.push(`**XP:** ${char.xp ?? 0} (spent ${char.xpSpent ?? 0})`, "");
  lines.push(
    `**HP:** ${d.hp ?? 0}/${d.maxHp ?? 0} | **Arcana:** ${d.arcana ?? 0}/${d.maxArcana ?? 0} | **Willpower:** ${d.willpower ?? 0}/${WILLPOWER_MAX} | **Worthiness:** ${d.worthiness ?? 0} | **Bleed:** ${d.bleed ?? 0} | **Weakened:** ${d.weakened ?? 0}/${WEAKENED_MAX}`,
  );

  const attrs = (d.attributes ?? {}) as Record<string, number>;
  if (Object.keys(attrs).length > 0) {
    lines.push("", `**Attributes:** ${Object.entries(attrs).map(([k, v]) => `${k}:${v}`).join(" ")}`);
  }
  const skills = (d.skills ?? {}) as Record<string, number>;
  const usedSkills = Object.entries(skills).filter(([, v]) => v > 0);
  if (usedSkills.length > 0) {
    lines.push(`**Skills:** ${usedSkills.map(([k, v]) => `${k}:${v}`).join(" ")}`);
  }

  const weapons = (d.equippedWeapons ?? []) as EquippedWeapon[];
  weapons.forEach((w, i) =>
    lines.push(
      `**Weapon ${i + 1}:** ${w.name} (ATK:${w.bonus || "?"} DMG:${w.damage || "?"} RNG:${w.range || "?"} BRK:${w.break ?? "?"})`,
    ),
  );
  for (const a of (d.equippedArmor ?? []) as EquippedArmor[]) {
    lines.push(
      `**Armor (${capitalize(a.bodypart)}):** ${a.name} (HP:${a.hp}/${a.maxHp} AC:${a.ac}${a.disadvantage ? ` Disadv:${a.disadvantage}` : ""})`,
    );
  }
  const shield = d.equippedShield as EquippedShield | null | undefined;
  if (shield) {
    lines.push(
      `**Shield:** ${shield.name} (HP:${shield.hp}/${shield.maxHp} AC:${shield.ac}${shield.disadvantage ? ` Disadv:${shield.disadvantage}` : ""})`,
    );
  }
  ((d.spells ?? []) as SpellSlot[]).forEach((s, i) =>
    lines.push(`**Ability ${i + 1}:** ${s.name}${s.selected ? "" : " (unselected)"}`),
  );

  lines.push("", `**Gold:** ${d.gold ?? 0} | **Food:** ${d.food ?? 0}`);

  const rels = ((d.relationships ?? []) as Relationship[]).filter((r) => !r.archived);
  if (rels.length > 0) {
    lines.push("", "**Relationships:**");
    for (const r of rels) {
      lines.push(`- **${r.name}**${r.relation ? ` (${r.relation})` : ""}${r.notes ? `: ${r.notes}` : ""}`);
    }
  }
  const questItems = (d.questItems ?? []) as QuestItem[];
  if (questItems.length > 0) {
    lines.push("", "**Quest Items:**");
    for (const item of questItems) {
      lines.push(
        `- ${item.name}${item.description ? `: ${item.description}` : ""}${item.sessionName ? ` (${item.sessionName})` : ""}`,
      );
    }
  }
  const dmEquip = (d.dmEquipment ?? []) as DmEquipment[];
  if (dmEquip.length > 0) {
    lines.push("", "**DM Equipment:**");
    for (const eq of dmEquip) lines.push(`- ${eq.name}${eq.type ? ` (${eq.type})` : ""}`);
  }
  if (typeof d.background === "string" && d.background.trim()) {
    lines.push("", "**Background / notes:**", d.background.trim());
  }

  const campaign = char.campaign as Record<string, unknown> | undefined;
  if (campaign) {
    lines.push(
      "",
      `**Campaign:** ${campaign.name}${campaign.id ? ` (campaign_id: ${campaign.id})` : ""}${campaign.dmName ? ` (DM: ${campaign.dmName})` : ""}`,
    );
  } else if (char.campaignId) {
    lines.push("", `**Campaign ID:** ${char.campaignId}`);
  }

  return lines.join("\n");
}
