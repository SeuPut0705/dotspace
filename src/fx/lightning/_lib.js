// The bolt shape and the way a bolt is inked (a deep halo, a pale body, a white core, light along it) are
// adapted from Sprite Fusion's open-source lightning (https://www.spritefusion.com/pixel-art-vfx/lightning),
// MIT License, Copyright (c) 2026 Hugo Duprez.
//
// Shared by the lightning effects: bolts that fork and thin as they split, inked at the 2x character scale,
// thin crackles, bowed arcs, heat scorch, and trajectories for pure loops.

import { clamp, rand, rng, hash, Rng, GRAVITY, FIRE_RAMP, SMOKE_RAMP, hex, mix, TAU } from "../../core/index.js";

/** Default palette, dark to bright: deep violet shadow, electric blue, icy white. */
export const VOLT = ["#120a33", "#2a1b78", "#4630c0", "#5a62f0", "#58a6ff", "#9ed8ff", "#e4f6ff", "#ffffff"];
/** Plasma sparks, head to tail: cyan that reads apart from the violet bolt. */
export const PLASMA = ["#ffffff", "#c8f8ff", "#7ff3ff", "#1ab8e6"];
export const SOOT = hex("#110c16"), SOOT2 = hex("#1c1522");

/**
 * A bolt from (x0, y0) to (x1, y1): midpoint displacement down to ~3 px segments (jag: how far the first
 * midpoint may swing, as a share of the length), with forks that split off along the way, each thinner (w)
 * and forking again up to two levels. Returns { paths: [{ pts: [[x, y], ...], w }] }, the trunk first.
 */
export function zigzag(R, x0, y0, x1, y1, jag = 0.32, forks = 0.35, w = 1, depth = 0) {
  const out = { paths: [] }, L = Math.hypot(x1 - x0, y1 - y0);
  let pts = [[x0, y0], [x1, y1]], off = L * jag;
  while (pts.length < 2 + L / 3) {
    const nxt = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], l = Math.hypot(bx - ax, by - ay) || 1, o = R.range(-off, off);
      nxt.push([(ax + bx) / 2 + (-(by - ay) / l) * o, (ay + by) / 2 + ((bx - ax) / l) * o], [bx, by]);
    }
    pts = nxt;
    off *= 0.52;
  }
  out.paths.push({ pts, w });
  if (depth < 2)
    for (let i = 2; i < pts.length - 3; i++)
      if (R.chance(forks / (1 + depth) / Math.max(4, pts.length / 6))) {
        const [ax, ay] = pts[i], [bx, by] = pts[Math.min(pts.length - 1, i + 3)];
        const a = Math.atan2(by - ay, bx - ax) + R.sign() * R.range(0.35, 0.9), l = (L - (i / pts.length) * L) * R.range(0.25, 0.55);
        out.paths.push(...zigzag(R, ax, ay, ax + Math.cos(a) * l, ay + Math.sin(a) * l, jag * 1.1, forks, w * 0.55, depth + 1).paths);
      }
  return out;
}

/** A bolt bowed off the straight line by `bow` px at its middle (negative: up for a left-to-right arc). */
export function bowed(R, x0, y0, x1, y1, bow, jag = 0.22, forks = 0.4) {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
  const mx = (x0 + x1) / 2 + nx * bow + R.range(-2, 2), my = (y0 + y1) / 2 + ny * bow;
  const a = zigzag(R, x0, y0, mx, my, jag, forks), b = zigzag(R, mx, my, x1, y1, jag, forks);
  return { paths: [{ pts: [...a.paths[0].pts, ...b.paths[0].pts.slice(1)], w: 1 }, ...a.paths.slice(1), ...b.paths.slice(1)] };
}

/** Move every point of a bolt: fn(x, y) => [x, y]. */
export function bend(b, fn) {
  return { paths: b.paths.map((q) => ({ w: q.w, pts: q.pts.map(([x, y]) => fn(x, y)) })) };
}

// ---- inking. Pixels are gathered in a grid at a level (higher wins), then drawn once each, so a fork's
// halo never covers the trunk's body and overlapping passes cost nothing extra.
const N = 1024, HALF = 512, GRID = new Uint8Array(N * N), HIT = [];
function mark(x, y, lvl) {
  const X = Math.floor(x) + HALF, Y = Math.floor(y) + HALF;
  if (X < 0 || Y < 0 || X >= N || Y >= N) return;
  const i = Y * N + X, v = GRID[i];
  if (!v) HIT.push(i);
  if (lvl > v) GRID[i] = lvl;
}
function stamp(x, y, r, lvl) {
  if (r <= 0.5) return mark(Math.round(x), Math.round(y), lvl);
  const r2 = r * r;
  for (let py = Math.floor(y - r); py <= Math.ceil(y + r); py++) {
    const dy = py + 0.5 - y;
    for (let px = Math.floor(x - r); px <= Math.ceil(x + r); px++) {
      const dx = px + 0.5 - x;
      if (dx * dx + dy * dy <= r2) mark(px, py, lvl);
    }
  }
}
/** Draw what was gathered: level n in cols[n - 1] at alpha alphas[n - 1] (dithered below 1). */
function flush(p, cols, alphas) {
  for (const i of HIT) {
    const v = GRID[i];
    GRID[i] = 0;
    const x = (i % N) - HALF, y = ((i / N) | 0) - HALF, a = alphas ? alphas[v - 1] : 1;
    if (a >= 1) p.px(x, y, cols[v - 1]);
    else if (a > 0) p.dot(x, y, cols[v - 1], a);
  }
  HIT.length = 0;
}
const walk = (pts, fn) => {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], l = Math.max(1, Math.hypot(bx - ax, by - ay));
    for (let d = 0; d <= l; d += 0.5) fn(ax + ((bx - ax) * d) / l, ay + ((by - ay) * d) / l, i);
  }
};

/**
 * A bolt at full power: a deep halo, a pale body, a white core on the trunk, light every few points. k is the
 * stroke's brightness (forks drop out below 0.5, the trunk thins below 0.6), s scales the thickness.
 * o: { hero (a white frame: the body goes white), light (glow strength), a (alpha), upTo (draw the trunk only
 * to this share of its length), core (radius of a thicker white core), minY (no glow above this y) }.
 */
export function stroke(p, b, k, C, s = 1, o = {}) {
  if (k <= 0.02) return;
  const lk = o.light ?? 0.5;
  for (const q of b.paths) {
    const trunk = q.w >= 1;
    if (!trunk && k < 0.5) continue;
    const rh = (trunk ? (k > 0.6 ? 2.1 : 1.6) : 1.1) * s, rb = (trunk ? (k > 0.6 ? 1.3 : 0.8) : 0.5) * s;
    const pts = o.upTo !== undefined && trunk ? q.pts.slice(0, Math.max(2, Math.ceil(q.pts.length * o.upTo))) : q.pts;
    walk(pts, (x, y) => {
      stamp(x, y, rh, 1);
      stamp(x, y, rb, trunk ? 3 : 2);
      if (trunk && k > 0.3) o.core ? stamp(x, y, o.core, 4) : mark(x, y, 4);
    });
    for (let i = 0; i < pts.length - 1; i += 3) if (o.minY === undefined || pts[i][1] > o.minY) p.glow(pts[i][0], pts[i][1], (trunk ? 14 : 7) * s, C[4], lk * k * q.w);
  }
  const a = o.a ?? 1;
  flush(p, o.hero ? [C[3], C[6], C[7], C[7]] : [C[2], C[4], C[5], C[7]], [a, a, a, a]);
}

/**
 * A thin crackle: a 1 px core (white on the trunk while bright), a 2 px pale body, a dithered halo while k is
 * high, light along it. For short arcs that live a frame or two.
 */
export function crackle(p, b, k, C, glowK = 0.5, a = 1) {
  if (k <= 0.02) return;
  for (const q of b.paths) {
    const thick = q.w >= 1;
    walk(q.pts, (x, y) => {
      if (k > 0.45 && thick) for (const [dx, dy] of CROSS) mark(x + dx * 1.5, y + dy * 1.5, 1);
      if (k > 0.25 && (thick || q.w > 0.4)) (mark(x + 1, y, 2), mark(x, y + 1, 2));
      mark(x, y, thick && k > 0.3 ? 4 : 3);
    });
    for (let i = 0; i < q.pts.length - 1; i += 3) p.glow(q.pts[i][0], q.pts[i][1], (thick ? 9 : 5) * (0.5 + k * 0.5), C[4], glowK * k * q.w);
  }
  flush(p, [C[3], C[5], C[5], C[7]], [Math.min(1, (k - 0.45) * 1.6) * a, a, a, a]);
}
const CROSS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** A bolt's trunk as a 1 px line in one color (leaders, afterimages, cooling channels). */
export function trace(p, pts, c, a = 1, from = 0, to = pts.length - 1) {
  for (let i = Math.max(0, from); i < Math.min(to, pts.length - 1); i++) p.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c, a);
}

/**
 * Heat left on the floor: a flat ellipse, white-hot in the middle cooling through the fire ramp to soot.
 * T0 is the heat (1 fresh, 0 cold), fade takes the soot away.
 */
export function scorch(p, cx, cy, rx, T0, fade = 1, ry = Math.max(2.5, rx * 0.12)) {
  if (fade <= 0) return;
  for (let y = Math.floor(cy); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) continue;
      const n = rand(x, y, 41), T = T0 * (1.25 - d) - n * 0.35;
      if (T > 0.06) {
        const c = FIRE_RAMP[Math.min(FIRE_RAMP.length - 1, Math.floor((1 - Math.min(1, T)) * (FIRE_RAMP.length - 1)))];
        p.dot(x, y, c, fade);
        if ((x & 3) === 0) p.glow(x + 0.5, y, 6, c, 0.18 * T * fade);
      } else p.dot(x, y, d < 0.5 ? SOOT : SOOT2, (d < 0.95 - n * 0.3 ? 1 : 1 - d) * fade);
    }
}

/** A heat-ramp color for T (1 white-hot .. 0 cold), or 0 when it's cold. */
export const heat = (T) => (T > 0.06 ? FIRE_RAMP[Math.min(FIRE_RAMP.length - 1, Math.floor((1 - Math.min(1, T)) * (FIRE_RAMP.length - 1)))] : 0);

/**
 * Where a spark launched at (x, y, vx, vy) is after `age` seconds, stepped like the simulation's SPARK (gravity,
 * drag, bouncing on a floor at `floor`), so pure loops get the same physics. Returns [x, y, vx, vy].
 */
export function flight(x, y, vx, vy, age, { g = 0.45, drag = 2.2, floor = Infinity, bounce = 0.45 } = {}) {
  const dt = 1 / 120;
  for (let s = 0; s < age; s += dt) {
    const h = Math.min(dt, age - s);
    vy += GRAVITY * g * h;
    vx -= vx * drag * h;
    vy -= vy * drag * h;
    const ny = y + vy * h;
    x += vx * h;
    if (vy > 0 && y <= floor && ny >= floor) (vy = -vy * bounce), (vx *= 0.7), (y = floor - 0.25);
    else y = ny;
  }
  return [x, y, vx, vy];
}

/** A spark drawn the way the simulation draws one (a streak stretched by speed, a hot head, light), for pure loops. */
export function spark(p, x, y, vx, vy, k, S) {
  const sp = Math.hypot(vx, vy) || 1, ux = vx / sp, uy = vy / sp, head = k > 0.6 ? S[0] : k > 0.3 ? S[1] : S[2], len = Math.min(9, 1 + sp * 0.022);
  p.line(x - ux * len, y - uy * len, x - ux * len * 0.4, y - uy * len * 0.4, k > 0.5 ? head : S[S.length - 1]);
  p.line(x - ux * len * 0.45, y - uy * len * 0.45, x, y, head);
  p.glow(x, y, 3, head, 0.45 * k);
}

/** A soft smoke puff at age u (0..1) of its life, drawn like the simulation's SMOKE, for pure loops. */
export function puff(p, x, y, size, u, c) {
  const k = 1 - u, r = size * (0.65 + Math.min(1, u * 2.5) * 0.45 + u * 0.4), a = Math.min(1, u * 12) * Math.min(1, k * 2.4) * 0.58;
  if (a <= 0.01) return;
  const col = mix(c, SMOKE_RAMP[Math.min(SMOKE_RAMP.length - 1, Math.floor(u * SMOKE_RAMP.length))], u);
  p.disc(x, y, r, col, a * 0.45);
  p.disc(x + r * 0.05, y + r * 0.06, r * 0.74, col, a * 0.62);
  if (u < 0.5) p.disc(x - r * 0.22, y - r * 0.3, r * 0.5, mix(col, hex("#ffffff"), 0.12), a * 0.4 * (1 - u * 2));
}

/** A seeded generator for frame f of a loop (new shapes every frame, the same shapes every time). */
export const frameRng = (seed, f, salt = 0) => rng(seed, salt, f);
export { rand, rng, hash, Rng, clamp };

// ---------------------------------------------------------------------------------------------------------------
// 3D. The same bolts, in space: points are [x, y, z], inked with beams (a depth for every pixel) instead of the
// 2D grid, so a bolt passes behind and in front of things and reads from every side.

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit3 = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
// a direction and two unit vectors across it
export function across(d) {
  const n = unit3(d), h = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = unit3([n[1] * h[2] - n[2] * h[1], n[2] * h[0] - n[0] * h[2], n[0] * h[1] - n[1] * h[0]]);
  return [n, e1, [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]]];
}

/**
 * zigzag in space: a bolt from a to b ([x, y, z]), midpoints pushed off the line in any direction across it, forks
 * leaving at any angle round it. Returns { paths: [{ pts: [[x, y, z], ...], w }] }, the trunk first.
 */
export function zigzag3(R, a, b, jag = 0.32, forks = 0.35, w = 1, depth = 0) {
  const out = { paths: [] }, d = sub3(b, a), L = Math.hypot(d[0], d[1], d[2]), [, e1, e2] = across(d);
  let pts = [a, b], off = L * jag * 0.8;
  while (pts.length < 2 + L / 3) {
    const nxt = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i], B = pts[i + 1], o1 = R.range(-off, off), o2 = R.range(-off, off);
      nxt.push([(A[0] + B[0]) / 2 + e1[0] * o1 + e2[0] * o2, (A[1] + B[1]) / 2 + e1[1] * o1 + e2[1] * o2, (A[2] + B[2]) / 2 + e1[2] * o1 + e2[2] * o2], B);
    }
    pts = nxt;
    off *= 0.52;
  }
  out.paths.push({ pts, w });
  if (depth < 2)
    for (let i = 2; i < pts.length - 3; i++)
      if (R.chance(forks / (1 + depth) / Math.max(4, pts.length / 6))) {
        const A = pts[i], [t, f1, f2] = across(sub3(pts[Math.min(pts.length - 1, i + 3)], A));
        const ang = R.range(0.35, 0.9), phi = R.range(0, TAU), ca = Math.cos(ang), sa = Math.sin(ang), l = (L - (i / pts.length) * L) * R.range(0.25, 0.55);
        const m = [f1[0] * Math.cos(phi) + f2[0] * Math.sin(phi), f1[1] * Math.cos(phi) + f2[1] * Math.sin(phi), f1[2] * Math.cos(phi) + f2[2] * Math.sin(phi)];
        const end = [A[0] + (t[0] * ca + m[0] * sa) * l, A[1] + (t[1] * ca + m[1] * sa) * l, A[2] + (t[2] * ca + m[2] * sa) * l];
        out.paths.push(...zigzag3(R, A, end, jag * 1.1, forks, w * 0.55, depth + 1).paths);
      }
  return out;
}

/** A bolt bowed `bow` px off the straight line at its middle, towards `dir` (default up); negative bows away from it. */
export function bowed3(R, a, b, bow, jag = 0.22, forks = 0.4, dir = [0, -1, 0]) {
  const d = sub3(b, a), [n, e1] = across(d);
  let s = [dir[0] - dot3(dir, n) * n[0], dir[1] - dot3(dir, n) * n[1], dir[2] - dot3(dir, n) * n[2]];
  if (Math.hypot(s[0], s[1], s[2]) < 0.2) s = e1;
  s = unit3(s);
  const m = [(a[0] + b[0]) / 2 + s[0] * bow + e1[0] * R.range(-2, 2), (a[1] + b[1]) / 2 + s[1] * bow + e1[1] * R.range(-2, 2), (a[2] + b[2]) / 2 + s[2] * bow + e1[2] * R.range(-2, 2)];
  const p = zigzag3(R, a, m, jag, forks), q = zigzag3(R, m, b, jag, forks);
  return { paths: [{ pts: [...p.paths[0].pts, ...q.paths[0].pts.slice(1)], w: 1 }, ...p.paths.slice(1), ...q.paths.slice(1)] };
}

/** Move every point of a bolt: fn(x, y, z) => [x, y, z]. */
export function bend3(b, fn) {
  return { paths: b.paths.map((q) => ({ w: q.w, pts: q.pts.map(([x, y, z]) => fn(x, y, z)) })) };
}

// one bolt path as beams: the ink is chosen by how far a pixel is from the axis, so it reads as a lit tube
function tube(q, pts, w, ink, a) {
  for (let i = 0; i < pts.length - 1; i++) q.beam(...pts[i], ...pts[i + 1], w, ink, a);
}

/**
 * stroke in space: a deep halo, a pale body, a white core on the trunk, light along it. Same arguments as stroke
 * (k brightness, s thickness, o: { hero, light, a, upTo, core, minY }); draw solid things first, light goes on last.
 */
export function stroke3(q, b, k, C, s = 1, o = {}) {
  if (k <= 0.02) return;
  const lk = o.light ?? 0.5, a = o.a ?? 1, halo = o.hero ? C[3] : C[2];
  for (const br of b.paths) {
    const trunk = br.w >= 1;
    if (!trunk && k < 0.5) continue;
    const rh = (trunk ? (k > 0.6 ? 2.1 : 1.6) : 1.1) * s, rb = (trunk ? (k > 0.6 ? 1.3 : 0.8) : 0.5) * s, rc = trunk && k > 0.3 ? o.core ?? 0.5 : 0;
    const body = o.hero ? (trunk ? C[7] : C[6]) : trunk ? C[5] : C[4], pts = o.upTo !== undefined && trunk ? br.pts.slice(0, Math.max(2, Math.ceil(br.pts.length * o.upTo))) : br.pts;
    tube(q, pts, rh * 2, (u, v) => (v * rh <= rc ? C[7] : v * rh <= rb ? body : halo), a);
  }
  for (const br of b.paths) {
    const trunk = br.w >= 1;
    if (!trunk && k < 0.5) continue;
    const pts = o.upTo !== undefined && trunk ? br.pts.slice(0, Math.max(2, Math.ceil(br.pts.length * o.upTo))) : br.pts;
    for (let i = 0; i < pts.length - 1; i += 3) if (o.minY === undefined || pts[i][1] > o.minY) q.glow(pts[i][0], pts[i][1], pts[i][2], (trunk ? 14 : 7) * s, C[4], lk * k * br.w);
  }
}

/** crackle in space: a thin bolt, a 1 px core, a 2 px pale body, a dithered halo while k is high, light along it. */
export function crackle3(q, b, k, C, glowK = 0.5, a = 1) {
  if (k <= 0.02) return;
  const halo = k > 0.45, ha = Math.min(1, (k - 0.45) * 1.6) * a;
  for (const br of b.paths) {
    const thick = br.w >= 1, core = thick && k > 0.3, w = halo && thick ? 3.4 : k > 0.25 && (thick || br.w > 0.4) ? 2.2 : 1.1;
    tube(q, br.pts, w, (u, v) => (v * w <= 0.55 ? (core ? C[7] : C[5]) : v * w <= 1.2 ? C[5] : C[3]), (u, v) => (v * w <= 1.2 ? a : ha));
  }
  for (const br of b.paths) for (let i = 0; i < br.pts.length - 1; i += 3) q.glow(br.pts[i][0], br.pts[i][1], br.pts[i][2], (br.w >= 1 ? 9 : 5) * (0.5 + k * 0.5), C[4], glowK * k * br.w);
}

/** A bolt's trunk as a 1 px line in one color, in space (leaders, afterimages, cooling channels). */
export function trace3(q, pts, c, a = 1, from = 0, to = pts.length - 1) {
  for (let i = Math.max(0, from); i < Math.min(to, pts.length - 1); i++) q.line(...pts[i], ...pts[i + 1], c, a);
}

/** flight in space: like flight, with z drifting and dragging like x. Returns [x, y, z, vx, vy, vz]. */
export function flight3(x, y, z, vx, vy, vz, age, { g = 0.45, drag = 2.2, floor = Infinity, bounce = 0.45 } = {}) {
  const dt = 1 / 120;
  for (let s = 0; s < age; s += dt) {
    const h = Math.min(dt, age - s);
    vy += GRAVITY * g * h;
    vx -= vx * drag * h;
    vy -= vy * drag * h;
    vz -= vz * drag * h;
    const ny = y + vy * h;
    x += vx * h;
    z += vz * h;
    if (vy > 0 && y <= floor && ny >= floor) (vy = -vy * bounce), (vx *= 0.7), (vz *= 0.7), (y = floor - 0.25);
    else y = ny;
  }
  return [x, y, z, vx, vy, vz];
}

/** spark in space: a streak stretched by speed, a hot head, light. */
export function spark3(q, x, y, z, vx, vy, vz, k, S) {
  const sp = Math.hypot(vx, vy, vz) || 1, ux = vx / sp, uy = vy / sp, uz = vz / sp, head = k > 0.6 ? S[0] : k > 0.3 ? S[1] : S[2], len = Math.min(9, 1 + sp * 0.022);
  q.line(x - ux * len, y - uy * len, z - uz * len, x - ux * len * 0.4, y - uy * len * 0.4, z - uz * len * 0.4, k > 0.5 ? head : S[S.length - 1]);
  q.line(x - ux * len * 0.45, y - uy * len * 0.45, z - uz * len * 0.45, x, y, z, head);
  q.glow(x, y, z, 3, head, 0.45 * k);
}

/** puff in space: a soft smoke puff (as puff) standing up as a billboard at a point. */
export function puff3(q, x, y, z, size, u, c) {
  q.at(x, y, z, (p, k) => puff(p, 0, 0, size * k, u, c));
}

/**
 * Where a point of the 2D painter's screen lies in world space: on the plane through the origin that faces the
 * camera, then `dz` towards the camera. A character drawn by the tools is a billboard on that plane, so what rides
 * on its hand, or on a target standing beside it, is placed with this. Returns (sx, sy, dz = 0) => [x, y, z].
 */
export function screenAt(q) {
  return screenAtCam(q.camera);
}
/** screenAt for a camera { yaw, pitch } (a simulation reads o.camera to place what it spawns on the body). */
export function screenAtCam({ yaw = 0, pitch = 0.3 }) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return (sx, sy0, dz = 0) => {
    const y = sy0 * cp, vz = sy0 * sp;
    return [sx * cy + vz * sy + dz * sy * cp, y - dz * sp, -sx * sy + vz * cy + dz * cy * cp];
  };
}

/** Heat left on the floor, drawn flat for q.decal: a disc of radius r, white-hot in the middle cooling to soot. */
export function scorchDisc(p, r, T0, fade = 1) {
  if (fade <= 0) return;
  for (let y = Math.floor(-r); y <= Math.ceil(r); y++)
    for (let x = Math.floor(-r); x <= Math.ceil(r); x++) {
      const dx = (x + 0.5) / r, dy = (y + 0.5) / r, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) continue;
      const n = rand(x, y, 41), T = T0 * (1.25 - d) - n * 0.35;
      if (T > 0.06) {
        const c = FIRE_RAMP[Math.min(FIRE_RAMP.length - 1, Math.floor((1 - Math.min(1, T)) * (FIRE_RAMP.length - 1)))];
        p.dot(x, y, c, fade);
        if ((x & 3) === 0 && (y & 3) === 0) p.glow(x + 0.5, y + 0.5, 6, c, 0.3 * T * fade);
      } else p.dot(x, y, d < 0.5 ? SOOT : SOOT2, (d < 0.95 - n * 0.3 ? 1 : 1 - d) * fade);
    }
}

/** A pool of light on the floor round (x, z), strongest at the middle. */
export function pool(q, x, z, r, c, k) {
  if (k <= 0) return;
  q.plane(x, 0, z, null, r, (u, v, out) => {
    const f = 1 - Math.hypot(u, v) / r;
    if (f <= 0) return;
    out.l = c;
    out.k = f * f * k;
  });
}

/** A point moved d px towards the camera, so it lands on the same screen pixel but in front of whatever hugs it. */
export function nearer(q, x, y, z, d) {
  const { yaw, pitch } = q.camera, cp = Math.cos(pitch);
  return [x + Math.sin(yaw) * cp * d, y - Math.sin(pitch) * d, z + Math.cos(yaw) * cp * d];
}

/**
 * An energy orb as a ball: a halo rim, a body, a highlight and a white heart (colors halo, body, hi, spec), the
 * layers of the 2D orbs (circle, circle, circle) read off the sphere's normal. R0 is the body's radius, the halo
 * adds 1.3 px.
 */
export function orb(q, cx, cy, cz, R0, halo, body, hi, spec) {
  const R = R0 + 1.3, k = R / R0;
  q.ball(cx, cy, cz, R, (nx, ny) => {
    const sx = nx * k, sy = ny * k;
    if (sx * sx + sy * sy > 1) return halo;
    const d = Math.hypot(sx + 0.08, sy + 0.08);
    return d < 0.32 ? spec : d < 0.72 ? hi : body;
  });
}
