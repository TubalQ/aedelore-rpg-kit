// ─── Transforms - sourced from the active game system ───
//
// Class transform definitions (e.g. Druid wildshape) now live
// in src/systems/<system>/transforms.json. Same public API.

import { liveRecord } from "@/systems/runtime";
import { CLASSES } from "@/lib/domain/classes";
import type {
  TransformAttack,
  TransformDefinition } from "@/systems/types";

export type {
  TransformAttack,
  TransformForm,
  TransformDefinition,
} from "@/systems/types";

export const TRANSFORMS: Readonly<Record<string, TransformDefinition>> =
  liveRecord((s) => s.transforms);

/**
 * The class's transforms, or undefined when the class has none or no longer
 * exists in the game system (renamed or removed in the editor): a missing class
 * shows no abilities and no Arcana, and no forms either (#83).
 */
export function getTransformsForClass(
  className: string,
): TransformDefinition | undefined {
  if (!CLASSES[className]) return undefined;
  return TRANSFORMS[className];
}
