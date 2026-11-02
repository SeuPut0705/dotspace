// The plus sign's lit and shaded bevel is adapted from Sprite Fusion's open-source heal (https://www.spritefusion.com/pixel-art-vfx/heal),
// MIT License, Copyright (c) 2026 Hugo Duprez.
// Shared by the holy effects: gold, green and ash ramps, the character's silhouette and recolors, floor ovals,
// feathers of light (drawn, and simulated as they rock and sink) and plus signs.
// Files starting with _ are helpers, not effects.

import { WHITE, TAU, clamp, smooth, luma } from "../../core/index.js";

/** Holy gold, dark to bright: a plum shadow, rust, amber, gold, pale gold, cream, white. */
export const GOLD = ["#3b1d2a", "#7a3a2c", "#c4652e", "#f0a040", "#ffd25e", "#fff0a0", "#fffbe0", "#ffffff"];
/** Healing green, warm: deep pine, leaf, spring green, a yellow-green highlight, cream. */
export const GREEN = ["#0e2a24", "#14472f", "#1d6e3a", "#2f9a45", "#5cc654", "#a0e46c", "#dcffb4", "#ffffff"];
/** Ash: the colour of the fallen, a cool grey-violet, dark to light. */
export const ASH = ["#16131c", "#26222f", "#3a3546", "#524c5e", "#6e6878", "#8c8796"];

// ---- the character

const SHAPES = new WeakMap();
/**
 * The actor's silhouette as local points, cached per mask: edge (its own rim pixels), out (the 1 px ring just
 * outside it), at(x, y) (inside?), top and bottom (y of the first row and one past the last).
 */
export function shapeOf(A) {
  let s = SHAPES.get(A.mask);
  if (s && s.x === A.x && s.y === A.y) return s;
  const m = A.mask, inside = (i, j) => i >= 0 && j >= 0 && i < m.w && j < m.h && m.data[j * m.w + i] > 0;
  const edge = [], out = [];
  for (let j = -1; j <= m.h; j++)
    for (let i = -1; i <= m.w; i++) {
      const nb = inside(i - 1, j) + inside(i + 1, j) + inside(i, j - 1) + inside(i, j + 1);
      if (inside(i, j)) {
        if (nb < 4) edge.push([A.x + i, A.y + j]);
      } else if (nb) out.push([A.x + i, A.y + j]);
    }
  s = { x: A.x, y: A.y, edge, out, top: A.y, bottom: A.y + m.h, at: (x, y) => inside(Math.floor(x) - A.x, Math.floor(y) - A.y) };
  SHAPES.set(A.mask, s);
  return s;
}

/**
 * Draw the actor's own pixels recolored: fn(c, x, y) gives the new color for its pixel c at (x, y), or 0 to
 * leave that pixel alone (the character shows through). a: alpha, or a function of (x, y).
 */
export function recolor(p, A, fn, a = 1) {
  const m = A.mask, P = A.pixels, fa = typeof a === "function";
  if (!P) return;
  for (let j = 0; j < m.h; j++)
    for (let i = 0; i < m.w; i++) {
      const c = P[j * m.w + i];
      if (!c) continue;
      const x = A.x + i, y = A.y + j, n = fn(c, x, y);
      if (n) p.dot(x, y, n, fa ? a(x, y) : a);
    }
}

/** A color mapped onto a ramp by its brightness (a tint that keeps the character's shading). */
export const toneOf = (R, c, lift = 0) => R[clamp(Math.floor((luma(c) * 1.1 + lift) * R.length), 0, R.length - 1)];

// ---- floor and ovals

/**
 * A 1 px oval (a ring on a tilted plane): centre (cx, cy), radii rx, ry. c and a may be functions of the angle
 * g round it (sin(g) > 0 is the near side). keep(g) picks the part to draw.
 */
export function oval(p, cx, cy, rx, ry, c, a = 1, keep = null) {
  if (rx < 0.5) return;
  const n = Math.ceil(Math.max(rx, ry) * TAU * 1.5) + 6, fc = typeof c === "function", fa = typeof a === "function";
  for (let j = 0; j < n; j++) {
    const g = (j / n) * TAU;
    if (keep && !keep(g)) continue;
    p.dot(cx + Math.cos(g) * rx, cy + Math.sin(g) * ry, fc ? c(g) : c, fa ? a(g) : a);
  }
}
export const FAR = (g) => Math.sin(g) < 0;
export const NEAR = (g) => Math.sin(g) >= 0;

// ---- feathers

/**
 * A feather of light from its quill at (x, y) pointing along ang, len px long, with a rounded tip; the
 * trailing vane, wid px wide, falls on side (1: clockwise of the shaft, -1: the other way), the leading vane
 * is under half that. R: a ramp, dark to bright (6+ steps). a: alpha. hot 0..1 whitens it (a flash). A white
 * shaft, a lit leading rim, a warm dark trailing edge that parts it from the next feather, a body that cools
 * from cream at the quill to gold, and a tip that thins into light.
 */
export function feather(p, x, y, ang, len, wid, R, a = 1, side = 1, hot = 0, quill = 0.02) {
  if (len < 1.5 || a <= 0.02) return;
  const n = R.length, ca = Math.cos(ang), sa = Math.sin(ang), x1 = x + ca * len, y1 = y + sa * len, pad = wid + 1.2, h = hot > 0.5;
  const edge = h ? R[n - 3] : R[n - 5], lead = h ? WHITE : R[n - 2], B = h ? [WHITE, WHITE, R[n - 2]] : [R[n - 2], R[n - 3], R[n - 4]];
  p.each(Math.min(x, x1) - pad, Math.min(y, y1) - pad, Math.max(x, x1) + pad, Math.max(y, y1) + pad, (px, py, sx, sy) => {
    const dx = px - x, dy = py - y, u = (dx * ca + dy * sa) / len;
    if (u < 0 || u > 1.05) return;
    const v = (-dx * sa + dy * ca) * side, av = Math.abs(v);
    const w = wid * Math.sqrt(clamp((u - quill) / 0.22)) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (u - 0.55) / 0.47), 2)));
    const lim = v < 0 ? w * 0.42 : w, fade = u < 0.72 ? 1 : 1 - (u - 0.72) * 1.6;
    if (av < 0.5 && u < 0.9) return p.put(sx, sy, u < 0.5 ? WHITE : B[0], a);
    if (av > lim + 0.05 || w < 0.5) return;
    if (lim - av < 1) return v > 0 ? p.put(sx, sy, u > 0.85 ? B[2] : edge, a * fade) : p.put(sx, sy, lead, a);
    if (u < 0.72) return p.put(sx, sy, u < 0.38 ? B[0] : B[1], a);
    p.blendPx(sx, sy, B[2], a * fade);
  });
}

/**
 * Loose feathers that are thrown, brake hard, then rock like a pendulum as they sink, tilting with each swing
 * and sinking fastest through the bottom of it; on the floor they lie flat and fade.
 * add({ x, y (centre), vx, vy, a (angle), len, wid, life, delay, back }); update(dt); draw(p, R, layer).
 */
export class Feathers {
  constructor(rng, floor = 0) {
    this.R = rng;
    this.floor = floor;
    this.list = [];
  }
  add(f) {
    const R = this.R;
    this.list.push({ vx: 0, vy: 0, a: 0, len: 7, wid: 2, delay: 0, back: false, side: R.sign(), ph: R.range(0, TAU), w: R.range(3.2, 4.6), amp: R.range(6, 11), sink: R.range(14, 24), va: R.range(-9, 9), tilt: R.range(-0.35, 0.35), ...f, max: f.life, age: 0, landed: false });
  }
  get count() {
    return this.list.length;
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      if (f.delay > 0) {
        f.delay -= dt;
        continue;
      }
      if ((f.life -= dt) <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      f.age += dt;
      if (f.landed) {
        f.a += (Math.round(f.a / Math.PI) * Math.PI - f.a) * Math.min(1, dt * 10);
        continue;
      }
      // the throw: drag kills it fast while it spins
      f.vx -= f.vx * 3.4 * dt;
      f.vy -= f.vy * 3.4 * dt;
      const s = smooth(0.1, 0.6, f.age), ph = f.age * f.w + f.ph, c = Math.cos(ph);
      // the flutter: a swing across, a sink that's fastest through the bottom of each swing
      f.x += (f.vx + Math.sin(ph) * f.amp * s * 0.9) * dt;
      f.y += (f.vy + f.sink * s * (c * c * 1.5 - 0.2)) * dt;
      // it lies along its swing, tipping up at each end
      const rest = Math.round(f.a / Math.PI) * Math.PI + f.tilt + Math.sin(ph) * 0.6;
      f.a += f.va * dt * (1 - s) + (rest - f.a) * Math.min(1, dt * 5 * s);
      if (f.y >= this.floor - 0.5) {
        f.y = this.floor - 0.5;
        f.landed = true;
        f.life = Math.min(f.life, 0.6);
      }
    }
  }
  draw(p, R, layer) {
    for (const f of this.list) {
      if (f.delay > 0 || (layer && (f.back ? "back" : "front") !== layer)) continue;
      const k = f.life / f.max, a = Math.min(1, f.life / 0.45, f.age / 0.06), ca = Math.cos(f.a), sa = Math.sin(f.a);
      feather(p, f.x - (ca * f.len) / 2, f.y - (sa * f.len) / 2, f.a, f.len, f.wid, R, a, f.side, f.age < 0.06 ? 1 : 0, 0.2);
      p.glow(f.x, f.y, 4 + f.len * 0.5, R[R.length - 3], 0.22 * a * (0.4 + 0.6 * k));
    }
  }
}

// ---- plus signs

/**
 * A plus sign of light centred on (x, y): arm length L (1..4) and thickness th (1 or 3): a white heart and
 * spine, colored arms lit on the top and left, shaded on the bottom and right. R: a ramp, dark to bright.
 */
export function plus(p, x, y, L, th, R, a = 1, glint = false) {
  const n = R.length, X = Math.round(x), Y = Math.round(y), w = th > 1 ? 1 : 0;
  const ins = (i, j) => (Math.abs(i) <= w && Math.abs(j) <= L) || (Math.abs(j) <= w && Math.abs(i) <= L);
  for (let j = -L - 1; j <= L + 1; j++)
    for (let i = -L - 1; i <= L + 1; i++) {
      if (!ins(i, j)) {
        if (w && (ins(i - 1, j) || ins(i + 1, j) || ins(i, j - 1) || ins(i, j + 1))) p.dot(X + i, Y + j, R[Math.max(0, n - 6)], a * 0.9);
        continue;
      }
      let c;
      if (!w) c = i === 0 && j === 0 ? WHITE : Math.abs(i) + Math.abs(j) >= L ? R[n - 3] : R[n - 2];
      else if (i === 0 && j === 0) c = WHITE;
      else if (i === 0 || j === 0) c = Math.abs(i) + Math.abs(j) < L ? R[n - 2] : R[n - 3];
      else c = i < 0 || j < 0 ? R[n - 3] : R[n - 5];
      if (glint && ((i === 0 && j === -L) || (i === -L && j === 0))) c = WHITE;
      p.dot(X + i, Y + j, c, a);
    }
}

// ---- 3D: parts the Space has no call for (src/core/space.js: q.at, q.decal, q.ring, q.beam are used as they are)

const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** The axes (u, v) of the plane with normal n, as q.decal and q.plane lay a drawing on it. */
export function planeAxes(n) {
  const N = unit3(n), e1 = Math.abs(N[1]) > 0.9 ? unit3(cross3(cross3(N, [1, 0, 0]), N)) : unit3(cross3(N, [0, -1, 0]));
  return [e1, cross3(N, e1)];
}

/** How many px nearer the camera a point is than (cx, cy, cz) (negative: behind it). Brighten what is near, dim what is far. */
export const nearer = (q, x, y, z, cx = 0, cy = 0, cz = 0) => q.depth(cx, cy, cz) - q.depth(x, y, z);

const SHADER = { c: 0, a: 1, l: 0, k: 0, blend: true };

/**
 * A tapered rod from (x0, y0, z0), width w0, to (x1, y1, z1), width w1, with flat ends: a ray, a shaft of light.
 * A pixel shader along it: fn(u, v, out), u 0..1 along it, v 0 on the axis to 1 at the edge; return a color or set
 * out.c, out.a, out.l (light color), out.k (light), out.blend (default true: translucent, false: solid).
 * Depth is the axis's, bulged like a tube, so what is solid in front of it hides it.
 */
export function rod(q, x0, y0, z0, x1, y1, z1, w0, w1, fn) {
  if (!q.project(x0, y0, z0)) return;
  const ax = q.x, ay = q.y, ad = q.d, ka = q.k;
  if (!q.project(x1, y1, z1)) return;
  const bx = q.x, by = q.y, bd = q.d, kb = q.k, p = q.p, o = SHADER, zp = p.z;
  // long rods go in pieces, so each one's bounding box stays tight (the pieces tile: flat ends, half open)
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 18));
  for (let i = 0; i < n; i++) {
    const f0 = i / n, f1 = (i + 1) / n, last = i === n - 1;
    const sx0 = ax + (bx - ax) * f0, sy0 = ay + (by - ay) * f0, sx1 = ax + (bx - ax) * f1, sy1 = ay + (by - ay) * f1;
    const r0 = ((w0 + (w1 - w0) * f0) / 2) * (ka + (kb - ka) * f0), r1 = ((w0 + (w1 - w0) * f1) / 2) * (ka + (kb - ka) * f1);
    const dx = sx1 - sx0, dy = sy1 - sy0, L2 = dx * dx + dy * dy, R = Math.max(r0, r1);
    p.each(Math.min(sx0, sx1) - R, Math.min(sy0, sy1) - R, Math.max(sx0, sx1) + R, Math.max(sy0, sy1) + R, (lx, ly, sx, sy) => {
      const t = L2 < 1e-4 ? 0.5 : ((lx - sx0) * dx + (ly - sy0) * dy) / L2;
      if (t < 0 || t > 1 || (t === 1 && !last)) return;
      const rr = r0 + (r1 - r0) * t, ex = sx0 + dx * t - lx, ey = sy0 + dy * t - ly, d = Math.sqrt(ex * ex + ey * ey);
      if (d > rr || rr <= 0) return;
      const v = d / rr, u = f0 + (f1 - f0) * t;
      o.c = 0; o.a = 1; o.l = 0; o.k = 0; o.blend = true;
      const c = fn(u, v, o) || o.c;
      p.z = ad + (bd - ad) * u - Math.sqrt(1 - v * v) * ((w0 + (w1 - w0) * u) / 2);
      if (c) o.blend ? p.blendPx(sx, sy, c, o.a) : p.put(sx, sy, c, o.a);
      if (o.k > 0) p.add(sx, sy, o.l || c, o.k);
    });
  }
  p.z = zp;
}

/**
 * A sphere's skin, both halves: fn(nx, ny, nz, out) for every pixel, (nx, ny) across the disc (screen right, down),
 * nz > 0 on the half facing the camera and < 0 on the far half; set out.c, out.a (translucent), out.l and out.k
 * (light). The far half is drawn first, at its own depth, so a character inside it shows through the near half and
 * hides the far one. Nothing below y = clipY (the floor) is drawn.
 */
export function shell(q, cx, cy, cz, r, fn, clipY = Infinity) {
  if (!q.project(cx, cy, cz)) return;
  const p = q.p, sx0 = q.x, sy0 = q.y, d0 = q.d, R = r * q.k, zp = p.z, cp = q.cp, sp = q.sp, o = SHADER;
  p.each(sx0 - R, sy0 - R, sx0 + R, sy0 + R, (lx, ly, sx, sy) => {
    const nx = (lx - sx0) / R, ny = (ly - sy0) / R, s = nx * nx + ny * ny;
    if (s > 1) return;
    const nz = Math.sqrt(1 - s);
    for (const tw of [-nz, nz]) {
      // the point's height: the screen's down axis and the toward-the-camera axis, back in world y
      if (cy + (ny * cp - tw * sp) * r > clipY) continue;
      o.c = 0; o.a = 1; o.l = 0; o.k = 0;
      fn(nx, ny, tw, o);
      p.z = d0 - tw * r;
      if (o.c) p.blendPx(sx, sy, o.c, o.a);
      if (o.k > 0) p.add(sx, sy, o.l || o.c, o.k);
    }
  });
  p.z = zp;
}

// the normal of a leaf whose tip points along h, rolled by roll about its length (0: lying flat, up facing up)
function leafNormal(h, roll) {
  const d = -h[1];
  let n0 = [-h[0] * d, -1 - h[1] * d, -h[2] * d];
  n0 = Math.hypot(n0[0], n0[1], n0[2]) < 0.05 ? [0, 0, 1] : unit3(n0);
  const s = cross3(h, n0), c = Math.cos(roll), sn = Math.sin(roll);
  return [n0[0] * c + s[0] * sn, n0[1] * c + s[1] * sn, n0[2] * c + s[2] * sn];
}

/**
 * Feathers in the air, as Feathers but with a depth: thrown, braking hard, then rocking as they sink, banking and
 * tipping with each swing, each swinging along its own horizontal line; on the floor they lie flat and fade. Each is
 * a flat leaf with a heading and a facing, drawn with the 2D feather() as a billboard that has the leaf's projected
 * length and width, so it turns edge on to a line and shows its face as the camera goes round.
 * add({ x, y, z, vx, vy, vz, dir: [dx, dy, dz] (where the tip points), len, wid, life, delay }); update(dt); draw(q, R).
 */
export class Feathers3 {
  constructor(rng, floor = 0) {
    this.R = rng;
    this.floor = floor;
    this.list = [];
  }
  add(f) {
    const R = this.R, d = unit3(f.dir ?? [1, 0, 0]), wa = R.range(0, TAU);
    this.list.push({ vx: 0, vy: 0, vz: 0, len: 7, wid: 2, delay: 0, side: R.sign(), ph: R.range(0, TAU), w: R.range(3.2, 4.6), amp: R.range(6, 11), sink: R.range(14, 24), va: R.range(-9, 9), tilt: R.range(-0.35, 0.35), wx: Math.cos(wa), wz: Math.sin(wa), psi: Math.atan2(d[2], d[0]), el: Math.asin(clamp(-d[1], -1, 1)), roll: 0, ...f, max: f.life, age: 0, landed: false });
  }
  get count() {
    return this.list.length;
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      if (f.delay > 0) {
        f.delay -= dt;
        continue;
      }
      if ((f.life -= dt) <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      f.age += dt;
      if (f.landed) {
        const k = Math.min(1, dt * 10);
        f.el -= f.el * k;
        f.roll -= f.roll * k;
        continue;
      }
      f.vx -= f.vx * 3.4 * dt;
      f.vy -= f.vy * 3.4 * dt;
      f.vz -= f.vz * 3.4 * dt;
      const s = smooth(0.1, 0.6, f.age), ph = f.age * f.w + f.ph, c = Math.cos(ph), sw = Math.sin(ph) * f.amp * s * 0.9;
      f.x += (f.vx + f.wx * sw) * dt;
      f.z += (f.vz + f.wz * sw) * dt;
      f.y += (f.vy + f.sink * s * (c * c * 1.5 - 0.2)) * dt;
      f.psi += f.va * dt * (1 - s);
      f.el += (f.tilt + Math.sin(ph) * 0.5 - f.el) * Math.min(1, dt * 5 * s);
      f.roll = Math.sin(ph + 1.2) * 0.9 * s;
      if (f.y >= this.floor - 0.5) {
        f.y = this.floor - 0.5;
        f.landed = true;
        f.life = Math.min(f.life, 0.6);
      }
    }
  }
  draw(q, R) {
    const n = R.length;
    for (const f of this.list) {
      if (f.delay > 0) continue;
      const k = f.life / f.max, a = Math.min(1, f.life / 0.45, f.age / 0.06), ce = Math.cos(f.el);
      const h = [ce * Math.cos(f.psi), -Math.sin(f.el), ce * Math.sin(f.psi)];
      leaf(q, f.x, f.y, f.z, h, leafNormal(h, f.roll), f.len, f.wid, R, a, f.side, f.age < 0.06 ? 1 : 0, 0.2, 0.5);
      q.glow(f.x, f.y, f.z, 4 + f.len * 0.5, R[n - 3], 0.22 * a * (0.4 + 0.6 * k));
    }
  }
}

/**
 * One feather in space: its quill at (x, y, z) (mid: how far along it that point is, 0 the quill, 0.5 the middle),
 * the tip pointing along h, the face turned to n (both unit). It is drawn with the 2D feather() as a billboard with
 * the length and width the leaf has on the screen: seen edge on it is a line, end on a stub, and the vane that
 * trails flips when you see its back.
 */
export function leaf(q, x, y, z, h, n, len, wid, R, a, side, hot, quill = 0.02, mid = 0) {
  const V = q.view(...h), W = q.view(...n), ang = Math.atan2(V[1], V[0]), lp = Math.max(Math.hypot(V[0], V[1]), 0.3), face = Math.abs(W[2]);
  q.at(x, y, z, (p, s) => {
    const L = len * lp * s, ca = Math.cos(ang), sa = Math.sin(ang);
    feather(p, -ca * L * mid, -sa * L * mid, ang, L, wid * (0.45 + 0.55 * face) * s, R, a, W[2] >= 0 ? side : -side, hot, quill);
  });
}
