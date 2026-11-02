// Shared by the moves. Files starting with _ are helpers, not effects.

import { shiftKeys } from "../../core/index.js";

/**
 * A move's act with the caster and the target both moved back by `mid` px. A 3D move turns about its origin, so putting
 * the origin between them keeps the whole move near it from every side and the canvas small.
 */
export function recenter(act, mid) {
  const back = (g) => ({ ...g, x: (g.x ?? 66) - mid });
  return {
    ...act,
    poses: shiftKeys(act.poses, 0, { dx: -mid }),
    ...(act.target && { target: back(act.target) }),
    ...(act.targets && { targets: act.targets.map(back) }),
    ...(act.dust && { dust: act.dust.map((d) => ({ ...d, x: (d.x ?? 0) - mid })) }),
  };
}
