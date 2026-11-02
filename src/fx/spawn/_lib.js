// Shared by the spawn and death effects: the actor's own body as a list of pixels to break up, burn, freeze or
// copy, and the cells just outside it for outlines. Files starting with _ are helpers, not effects.

import { hex, WHITE } from "../../core/index.js";

/**
 * The actor's body: { list: [{ x, y, mx, my, c, edge }], w, h, x, y, on(mx, my), cell(mx, my) }, local space
 * with the feet at (0, 0). c is the character's own color (o.actor.pixels); an actor without pixels is shaded
 * from the ramp C (lit at the top, darker toward the feet). edge marks pixels on the silhouette's rim.
 */
export function bodyOf(actor, C) {
  const m = actor.mask, px = actor.pixels, list = [], cells = new Array(m.w * m.h).fill(null);
  const on = (mx, my) => mx >= 0 && my >= 0 && mx < m.w && my < m.h && !!m.data[my * m.w + mx];
  for (let my = 0; my < m.h; my++)
    for (let mx = 0; mx < m.w; mx++) {
      if (!on(mx, my)) continue;
      const own = px?.[my * m.w + mx];
      const c = own ? hex(own) : C[Math.max(1, Math.min(C.length - 2, Math.round((C.length - 2) * (0.85 - (my / m.h) * 0.5))))];
      const b = { x: actor.x + mx, y: actor.y + my, mx, my, c, edge: !on(mx - 1, my) || !on(mx + 1, my) || !on(mx, my - 1) || !on(mx, my + 1) };
      list.push(b);
      cells[my * m.w + mx] = b;
    }
  return { list, w: m.w, h: m.h, x: actor.x, y: actor.y, on, cell: (mx, my) => (on(mx, my) ? cells[my * m.w + mx] : null) };
}

/** Cells just outside the body (4-neighbours of its rim), local space: [{ x, y, mx, my }]. */
export function rimOf(body) {
  const out = [];
  for (let my = -1; my <= body.h; my++)
    for (let mx = -1; mx <= body.w; mx++)
      if (!body.on(mx, my) && (body.on(mx - 1, my) || body.on(mx + 1, my) || body.on(mx, my - 1) || body.on(mx, my + 1)))
        out.push({ x: body.x + mx, y: body.y + my, mx, my });
  return out;
}

// ---- the 3D variants: small helpers over the Space (src/core/space.js)

/**
 * band() in the Space: a true ring on the floor (or at height y) from radius r - th to r, thickness th inward,
 * alpha k, coloured by depth through the band with ramp (dark to bright), the outer rim white-hot when hot.
 */
export function floorBand(q, r, th, k, ramp, hot = false, y = 0) {
  if (r <= 0 || k <= 0) return;
  const R = ramp.map(hex), n = R.length;
  q.ring(0, y, 0, r, Math.max(1, th), (v) => (v > 0.85 ? (hot ? WHITE : R[n - 1]) : v > 0.6 ? R[n - 2] : v > 0.3 ? R[n - 3] : R[n - 4]), (v) => k * (v > 0.6 ? 1.2 : 0.15 + v * 1.0));
}

/** A world offset of d px straight toward the camera: put a billboard there and it draws in front of (d > 0) or behind (d < 0) whatever stands at the origin. */
export const toward = (q, d) => [d * q.sy * q.cp, -d * q.sp, d * q.cy * q.cp];

/** The i-th of n directions spread evenly over a sphere, y up positive, as [x, up, z]; squash < 1 flattens it toward the horizon. */
export function sphere(i, n, squash = 1, turn = 0) {
  const u = (1 - (2 * (i + 0.5)) / n) * squash, r = Math.sqrt(1 - u * u), a = i * 2.399963 + turn;
  return [Math.cos(a) * r, u, Math.sin(a) * r];
}

/** Screen-right component of a world direction under the camera of q (so a billboard can lean the way a real thing would). */
export const rightOf = (q, x, z) => x * q.cy - z * q.sy;
