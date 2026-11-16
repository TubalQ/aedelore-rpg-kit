import { z } from "zod";

// ---------------------------------------------------------------------------
// Tolerant read schemas for stored JSONB.
//
// characters.data and game_sessions.data are parsed on EVERY read. One bad
// stored value (a number where a string is expected, a free-text enum value
// from an older writer, a null) must never make the parse throw, because a
// throw 500s the whole read path, and for sessions the whole campaign list.
// Every leaf here degrades to its default instead, and arrays drop only the
// element that is not an object. Writes run the same schemas (see
// sanitizeDataPatch), so what gets stored is already in canonical shape.
// ---------------------------------------------------------------------------

/** String; numbers/booleans are stringified, anything else becomes `fallback`. */
export function tolerantStr(fallback = "") {
  return z
    .union([z.string(), z.number().transform(String), z.boolean().transform(String)])
    .catch(fallback);
}

/** Nullable string (day/time style); numbers are stringified. */
export const tolerantStrNullable = z
  .union([z.null(), z.string(), z.number().transform(String)])
  .catch(null);

/** Boolean; accepts the strings "true"/"false", anything else becomes `fallback`. */
export function tolerantBool(fallback = false) {
  return z
    .union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")])
    .catch(fallback);
}

export const tolerantInt = z.coerce.number().int().catch(0);

/** Reference to a campaign stash entry (campaign_items.id); anything invalid reads as none. */
export const tolerantStashId = z.number().int().positive().nullable().catch(null);
export const tolerantNum = z.coerce.number().catch(0);

/** "all" | "dm" | character names. Anything else becomes `fallback`. */
export function tolerantVisibleTo(fallback: string) {
  return z.union([z.string(), z.array(z.string())]).catch(fallback);
}

/**
 * Names in a list, trimmed, without blanks or duplicates. A single string is
 * a one-name list ("" is none): older rows stored `givenTo` as one name.
 */
export function toNameList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const names: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const name = v.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

// optional(): a row without the key reads as nobody (a bare unknown() with a
// transform is a required key in Zod 4).
export const tolerantNameList = z.unknown().optional().transform(toNameList);

/** Enum value; an unknown stored value becomes `fallback`. */
export function tolerantEnum<const T extends readonly [string, ...string[]]>(
  values: T,
  fallback: T[number],
) {
  return z.enum(values).catch(fallback);
}

/**
 * Array whose elements are parsed one by one. An element that still fails
 * (not an object, or a required field missing) is dropped, so one bad element
 * never blanks the rest of the list. A non-array becomes [].
 */
export function tolerantArray<T extends z.ZodType>(element: T) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items.flatMap((item) => {
        const parsed = element.safeParse(item);
        return parsed.success ? [parsed.data as z.output<T>] : [];
      }),
    );
}

// ---------------------------------------------------------------------------
// Write-side: validate a JSONB patch against the tolerant object schema.
// ---------------------------------------------------------------------------

export type DataPatchResult =
  | { ok: true; patch: Record<string, unknown> }
  | { ok: false; unknownKeys: string[] };

/**
 * Every key must exist in `schema.shape` (unknown keys are rejected so stray
 * or legacy keys never reach storage), and every value is normalised through
 * its field schema, so the stored value is exactly what a later read returns.
 */
export function sanitizeDataPatch(
  schema: z.ZodObject<z.ZodRawShape>,
  patch: Record<string, unknown>,
): DataPatchResult {
  const shape = schema.shape;
  const unknownKeys = Object.keys(patch).filter((k) => !Object.hasOwn(shape, k));
  if (unknownKeys.length > 0) return { ok: false, unknownKeys };

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    out[key] = (shape[key] as z.ZodType).parse(value);
  }
  return { ok: true, patch: out };
}
