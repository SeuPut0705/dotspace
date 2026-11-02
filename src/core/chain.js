// Moves: several effects played as one. A cue says which effect, when, where and for how long; a projectile is just an
// effect whose x is a function of time. It's an ordinary effect from the outside: it plays, recolors and exports.

import { createFx } from "./fx.js";
import { space } from "./space.js";

/**
 * create(o) for a list of cues: { fx (an effect module), t (when it starts), until (cut it off here), x, y, z
 * (numbers, or functions of the move's time, local space), flip, ...any of that effect's options }.
 * A 3D move (its meta has a camera) shares that camera with every cue: a 3D cue sits at (x, y, z) in the move's
 * own space, depth and perspective included, and a 2D cue stands upright at that point and its depth, like a billboard.
 */
export function chain(cues) {
  return (o) => {
    const list = cues.map(({ fx, t, until, x, y, z, flip, ...opts }, i) => {
      const d3 = !!(o.camera && fx.meta?.camera);
      return { fx, d3, t: t ?? 0, until: until ?? Infinity, x: x ?? 0, y: y ?? 0, z: z ?? 0, flip: !!flip, opts: { ...opts, ...(d3 ? { camera: { ...o.camera } } : {}), seed: (o.seed ?? 1) + i }, inst: null, over: false };
    });
    let t = 0;
    const at = (v) => (typeof v === "function" ? v(t) : v);
    const each = (p, layer) => {
      const placed = { tx: p.tx, ty: p.ty, fx: p.fx, cs: p.cs, sn: p.sn, fade: p.fade, lightK: p.lightK, z: p.z };
      const { tx, ty, fx: sign } = placed;
      for (const c of list) {
        if (!c.inst || c.over) continue;
        // each one places the painter for itself: start every cue from the move's placing
        Object.assign(p, placed);
        const co = c.inst.options, x = at(c.x), y = at(c.y), z = at(c.z);
        if (c.d3) {
          // a 3D cue: the move's camera, its origin moved to its place in the move's space
          const [ax, ay, az] = o.camera.at ?? [0, 0, 0];
          Object.assign(co.camera, o.camera, { at: [ax + x, ay + y, az + z] });
          co.x = tx;
          co.y = ty;
        } else if (o.camera) {
          // a 2D cue: upright at its point, at that point's depth
          const q = space(p, o);
          if (!q.project(x, y, z)) continue;
          co.x = p.toX(q.x, q.y);
          co.y = p.toY(q.x, q.y);
          co.depth = q.d;
        } else {
          co.x = tx + sign * x;
          co.y = ty + y;
        }
        co.flip = sign < 0 !== c.flip;
        c.inst.draw(p.frame, layer);
      }
      // put it back for whoever draws next
      Object.assign(p, placed);
    };
    return {
      update(dt) {
        t += dt;
        for (const c of list) {
          if (c.over || t < c.t) continue;
          if (!c.inst) c.inst = createFx(c.fx, c.opts);
          else c.inst.update(dt);
          if (t >= c.until || (c.inst.done() && !c.fx.meta?.loop)) c.over = true;
        }
      },
      drawBack: (p) => each(p, "back"),
      draw: (p) => each(p, "front"),
    };
  };
}

/** Reuse an act's keys in a longer move: later by dt, moved along by dx, with anything else laid over each pose. */
export const shiftKeys = (keys, dt, { dx = 0, ...over } = {}) => keys.map(([t, pose, how]) => [t + dt, { ...pose, ...over, x: (pose.x ?? 0) + dx }, how]);
/** The same for hits. */
export const shiftHits = (hits, dt) => hits.map((h) => ({ ...h, t: h.t + dt }));
