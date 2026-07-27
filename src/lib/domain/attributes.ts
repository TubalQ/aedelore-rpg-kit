// ─── Attributes & Skills - sourced from the active system ─
//
// Attribute/skill definitions now live in
// src/systems/<system>/attributes.json. Character data keys
// off display NAMES (z.record(z.enum(ATTRIBUTE_NAMES/SKILL_NAMES))),
// NOT field ids - so swapping systems needs no data migration.
//
// BONUS_NAME_TO_FIELD_ID (display name → field id) was hardcoded;
// it is now DERIVED from the data via the convention
// `${attr}_value` / `${parentAttr}_${skill}` (slug = lowercase,
// spaces → underscores). This produces byte-identical output
// for Aedelore (verified) and stays correct for any system.

import { activeSystem } from "@/systems";
import { getSystem, liveArray, liveRecord } from "@/systems/runtime";
import type { AttributeData, SkillData, AttributesDefinition } from "@/systems/types";

export type { AttributeData, SkillData } from "@/systems/types";

// Names are data now → string rather than a literal union.
export type Attribute = string;
export type Skill = string;

const A = activeSystem.attributes;

// Attribute/skill NAMES + definitions are read LIVE from the active system
// (DB-backed) so an admin can add/edit them in /system-admin without a rebuild.
// Consumers keep importing the same constants; the proxies follow live edits.
// (Renaming an existing attribute is NOT supported from the UI - it would need a
// persisted-data migration; see the plan. Adding/editing is safe.)
export const ATTRIBUTE_NAMES: readonly string[] = liveArray((s) => s.attributes.attributeNames);
export const ATTRIBUTES: Readonly<Record<string, AttributeData>> = liveRecord((s) => s.attributes.attributes);
export const SKILL_NAMES: readonly string[] = liveArray((s) => s.attributes.skillNames);
export const SKILLS: Readonly<Record<string, SkillData>> = liveRecord((s) => s.attributes.skills);

// Rules scalars are read LIVE from the active system (DB-backed) so an admin can
// tune them in /system-admin without a rebuild. The `?? A.*` guards keep old DB
// rows that predate a field working.
export const getFreePointsTotal = (): number =>
  getSystem().attributes.freePointsTotal ?? A.freePointsTotal;
export const getMaxPointsPerField = (): number =>
  getSystem().attributes.maxPointsPerField ?? A.maxPointsPerField;
export const getMaxThirdEye = (): number =>
  getSystem().attributes.maxThirdEye ?? A.maxThirdEye;
export const getXpPerPoint = (): number =>
  getSystem().attributes.xpPerPoint ?? A.xpPerPoint ?? 10;

// ---------------------------------------------------------------------------
// Field-id derivation (display name ↔ DOM/DB field identifier)
// ---------------------------------------------------------------------------

const slug = (s: string): string => s.toLowerCase().replace(/ /g, "_");
const attrFieldId = (a: string): string => `${slug(a)}_value`;
const skillFieldId = (a: string, sk: string): string =>
  `${slug(a)}_${slug(sk)}`;

function deriveBonusMap(a: AttributesDefinition): Record<string, string> {
  const m: Record<string, string> = {};
  for (const n of a.attributeNames) {
    m[n] = attrFieldId(n);
    for (const sk of a.attributes[n].skills) m[sk] = skillFieldId(n, sk);
  }
  // Legacy alias some older bonus data uses; not derivable from the data.
  m["Agility"] = "dexterity_value";
  return m;
}

// BONUS_NAME_TO_FIELD_ID is DERIVED from the live attribute/skill definitions (a
// live proxy over the active system) so it recomputes when they are edited.
// Maps display names (from bonus strings like "+1 Strength") to field ids.
export const BONUS_NAME_TO_FIELD_ID: Readonly<Record<string, string>> = liveRecord((s) =>
  deriveBonusMap(s.attributes),
);

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function getSkillAttribute(skill: string): Attribute {
  return SKILLS[skill].attribute;
}

export function getSkillsForAttribute(attribute: string): readonly string[] {
  return ATTRIBUTES[attribute].skills;
}

export function getMaxValue(attribute: string): number {
  return ATTRIBUTES[attribute].maxValue;
}

/** Calculate the modifier for an attribute value. In Aedelore, modifier = ceil(value / 2). */
export function getModifier(value: number): number {
  return Math.ceil(value / 2);
}

/** Parse bonus strings like "+1 Strength", "+2 Athletics" into attribute + skill bonus maps. */
export function parseBonuses(bonusStrings: readonly string[]): {
  attributes: Record<string, number>;
  skills: Record<string, number>;
} {
  const attributes: Record<string, number> = {};
  const skills: Record<string, number> = {};

  for (const str of bonusStrings) {
    const match = str.match(/^\+(\d+)\s+(.+)$/);
    if (!match) continue;
    const value = parseInt(match[1]);
    const name = match[2];

    if ((ATTRIBUTE_NAMES as readonly string[]).includes(name)) {
      attributes[name] = (attributes[name] ?? 0) + value;
    } else if ((SKILL_NAMES as readonly string[]).includes(name)) {
      skills[name] = (skills[name] ?? 0) + value;
    }
  }

  return { attributes, skills };
}
