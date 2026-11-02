// Preview backdrops: what the tools and the gallery draw behind an effect. Sprite sheets stay transparent.

import { hex, mix } from "./color.js";
import { rand } from "./math.js";

const SKY = hex("#15131d"), SKY_TOP = hex("#0d0b14"), SKY_LOW = hex("#221d33");
const FLOOR_EDGE = hex("#4a4263"), FLOOR = hex("#2b2639"), FLOOR_DARK = hex("#211d2d"), MORTAR = hex("#1a1724");
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export const BACKDROPS = ["dark", "ground", "sky", "light", "black"];

/**
 * A backdrop as a Uint32Array of w x h colors. kind: "dark" | "ground" (a stone floor from groundY down)
 * | "sky" (night gradient with stars) | "light" | "black".
 */
export function backdrop(kind, w, h, groundY = h) {
  const out = new Uint32Array(w * h);
  if (kind === "light") return out.fill(hex("#ebe8f0"));
  if (kind === "black") return out.fill(hex("#000000"));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let c = SKY;
      if (kind === "sky") {
        const t = y / Math.max(1, h - 1), step = (t * 5 + BAYER[((y & 3) << 2) | (x & 3)] / 16) | 0;
        c = mix(SKY_TOP, SKY_LOW, Math.min(1, step / 4));
        const r = rand(x, y, 77);
        if (r > 0.994) c = mix(c, hex("#cfc8ff"), 0.35 + (r - 0.994) * 90);
      }
      if (kind === "ground" && y >= groundY) {
        const gy = y - groundY;
        if (gy === 0) c = FLOOR_EDGE;
        else {
          const row = Math.floor((gy - 1) / 5), off = row % 2 ? 6 : 0;
          const mortar = (gy - 1) % 5 === 4 || (x + off) % 12 === 0;
          c = mortar ? MORTAR : gy < 3 ? FLOOR : FLOOR_DARK;
        }
      }
      out[y * w + x] = c;
    }
  return out;
}

/**
 * The floor for a 3D effect's preview, drawn through a Space (src/core/space.js): stone tiles on the plane y = 0
 * that turn and tilt with the camera and fade out at radius R, with depth, so things below the floor hide.
 * Its depth is pushed back by about a pixel's worth of floor, so whatever lies on it (cracks, embers, settled
 * debris) never sinks into it.
 */
export function floorGrid(q, R = 120) {
  // a pixel's worth of floor in depth, at the smallest scale the floor is drawn at (its far edge, in perspective)
  const kmin = q.zoom * (q.dist === Infinity ? 1 : q.dist / (q.dist + R));
  const bias = 1 + Math.min(40, 0.75 / (Math.max(0.02, Math.tan(Math.abs(q.camera.pitch))) * kmin));
  q.plane(0, 0, 0, null, R, (u, v, out) => {
    const tx = Math.floor(u / 12), tz = Math.floor(v / 12), fu = u - tx * 12, fv = v - tz * 12;
    const d = Math.hypot(u, v) / R;
    out.c = fu < 1 || fv < 1 ? MORTAR : (tx + tz) & 1 ? FLOOR : FLOOR_DARK;
    out.a = d < 0.55 ? 1 : 1 - (d - 0.55) / 0.45;
  }, bias);
}
