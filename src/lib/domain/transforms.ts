// ─── Transforms - sourced from the active game system ───
//
// Class transform definitions (e.g. Druid wildshape) now live
// in src/systems/<system>/transforms.json. Same public API.

import { liveRecord } from "@/systems/runtime";
import type {
  TransformAttack,
  TransformForm,
  TransformDefinition,
} from "@/systems/types";

export type {
  TransformAttack,
  TransformForm,
  TransformDefinition,
} from "@/systems/types";

export const TRANSFORMS: Readonly<Record<string, TransformDefinition>> =
  liveRecord((s) => s.transforms);

export function getTransformsForClass(
  className: string,
): TransformDefinition | undefined {
  return TRANSFORMS[className];
}
