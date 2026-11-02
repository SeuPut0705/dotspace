// Shared by the nature effects: faceted stones that tumble and break, the stone spike they break from, leaves,
// droplets, bubbles and gas. The gas (puffs that drift off their push, rise, swell and thin, a lit cap) is adapted
// from Sprite Fusion's open-source poison (https://www.spritefusion.com/pixel-art-vfx/poison), MIT License, Copyright (c) 2026 Hugo Duprez.
import { TAU, WHITE, GRAVITY, rand, clamp } from "../../core/index.js";

/** Corners of an irregular stone, unit size, in angular order. */
export function stoneShape(R, n = R.int(5, 7)) {
  const pts = [], a0 = R.range(0, TAU), squash = R.range(0.7, 1);
  for (let i = 0; i < n; i++) {
    const a = a0 + ((i + R.range(-0.28, 0.28)) * TAU) / n, r = R.range(0.72, 1.12);
    pts.push([Math.cos(a) * r, Math.sin(a) * r * squash]);
  }
  return pts;
}

const LX = -0.6, LY = -0.8;
const inPoly = (V, x, y) => {
  let inside = false;
  for (let i = 0, j = V.length - 1; i < V.length; j = i++) {
    const [xi, yi] = V[i], [xj, yj] = V[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const MASK = new Uint8Array(64 * 64), FACE = new Int8Array(64 * 64), ROWS = 400, RL = new Float32Array(ROWS), RR = new Float32Array(ROWS), RU = new Float32Array(ROWS);

/**
 * A faceted stone at (x, y): corners pts (from stoneShape) scaled by s and turned by a. Each wedge between
 * neighbouring corners is a facet, lit by how squarely it faces the top left; edges facing the light catch a
 * bright rim, a dark rim goes round the rest. S: stone ramp, dark to bright (7+ steps). alpha dithers it out.
 */
export function drawRock(p, x, y, s, a, pts, S, alpha = 1, white = false) {
  const n = S.length, top = n - 2, ca = Math.cos(a), sa = Math.sin(a);
  if (s < 1.4) {
    p.dot(x, y, S[top - 1], alpha);
    p.dot(x + 1, y, S[top - 3], alpha);
    return;
  }
  const V = pts.map(([u, v]) => [(u * ca - v * sa) * s, (u * sa + v * ca) * s]);
  const ang = V.map(([vx, vy]) => Math.atan2(vy, vx));
  // each facet's light: its edge's outward normal against the light
  const lit = V.map(([ax, ay], i) => {
    const [bx, by] = V[(i + 1) % V.length], ex = bx - ax, ey = by - ay, l = Math.hypot(ex, ey) || 1;
    let nx = ey / l, ny = -ex / l;
    if (nx * (ax + bx) + ny * (ay + by) < 0) (nx = -nx), (ny = -ny);
    return nx * LX + ny * LY;
  });
  const X0 = Math.floor(x) - Math.ceil(s * 1.25) - 1, Y0 = Math.floor(y) - Math.ceil(s * 1.25) - 1, N = Math.min(62, 2 * Math.ceil(s * 1.25) + 3);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const dx = X0 + i + 0.5 - x, dy = Y0 + j + 0.5 - y, k = j * 64 + i;
      MASK[k] = inPoly(V, dx, dy) ? 1 : 0;
      if (!MASK[k]) continue;
      const g = Math.atan2(dy, dx);
      let f = 0;
      for (let q = 0; q < ang.length; q++) {
        const a0 = ang[q], a1 = ang[(q + 1) % ang.length];
        let d = (g - a0) % TAU, span = (a1 - a0) % TAU;
        if (d < 0) d += TAU;
        if (span < 0) span += TAU;
        if (d <= span) {
          f = q;
          break;
        }
      }
      FACE[k] = f;
    }
  const at = (i, j) => i >= 0 && j >= 0 && i < N && j < N && MASK[j * 64 + i] === 1;
  for (let j = -1; j <= N; j++)
    for (let i = -1; i <= N; i++) {
      const X = X0 + i, Y = Y0 + j;
      if (!at(i, j)) {
        if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) p.dot(X, Y, S[0], alpha);
        continue;
      }
      if (white) {
        p.dot(X, Y, WHITE, alpha);
        continue;
      }
      const L = lit[FACE[j * 64 + i]], edge = !at(i - 1, j) || !at(i + 1, j) || !at(i, j - 1) || !at(i, j + 1);
      let c = L > 0.55 ? S[top] : L > 0.15 ? S[top - 1] : L > -0.3 ? S[top - 2] : S[top - 3];
      if (edge) c = L > 0.3 ? S[top + 1] : L < -0.2 ? S[Math.max(1, top - 4)] : c;
      p.dot(X, Y, c, alpha);
    }
}

/**
 * A faceted stone spike standing on (x, base): h tall, w wide at the base, its tip `lean` px over. A ridge
 * splits a lit left face from a shaded right face; strata step across both; notches chip the edges; a dark
 * rim goes round it. sp: { notches: [{ u, side, d }], strata: [u], slope } from spikeLook(). S: stone ramp
 * (8 steps). opts: { a, white, glint (0..1 height of a sweeping highlight, or -1), clip (draw only u < clip, with a
 * ragged edge), half (-1 or 1: only the part left or right of the ridge), floor (draw nothing below this y),
 * cracks: [[[u, v], ...], ...] with crack (0..1 of each drawn), heat (0..1: cracks glow) and glowRamp }.
 */
export function drawSpike(p, x, base, h, w, lean, sp, S, opts = {}) {
  if (h < 1.5) return;
  const a = opts.a ?? 1, white = opts.white, glint = opts.glint ?? -1, clip = opts.clip ?? 1, floorY = opts.floor ?? Infinity;
  const hw = (u, side) => {
    let v = (w / 2) * Math.pow(Math.max(0, 1 - u), 0.85) + 0.3;
    for (const n of sp.notches) if (n.side === side && u > n.u && u < n.u + 0.07) v -= n.d * (1 - u * 0.5);
    return Math.max(0, v);
  };
  const half = opts.half ?? 0, Y0 = Math.floor(base - h) - 2, NR = Math.min(ROWS, Math.ceil(base) - Y0 + 2);
  // each row's edges, once
  for (let k = 0; k < NR; k++) {
    const u = (base - (Y0 + k + 0.5)) / h;
    RU[k] = u;
    if (u < 0 || u > 1 || Y0 + k + 0.5 > floorY) (RL[k] = Infinity), (RR[k] = -Infinity);
    else (RL[k] = x + lean * u - hw(u, -1)), (RR[k] = x + lean * u + hw(u, 1));
  }
  const inside = (px, py) => {
    const k = py - Y0, fx = px + 0.5;
    if (k < 0 || k >= NR || fx < RL[k] || fx > RR[k]) return false;
    if (clip < 1 && RU[k] > clip + (rand(px, 77) - 0.5) * 0.07) return false;
    if (!half) return true;
    const q = ((fx - RL[k]) / Math.max(0.5, RR[k] - RL[k])) * 2 - 1;
    return half < 0 ? q < -0.18 : q >= -0.18;
  };
  const X0 = Math.floor(x - w / 2 - Math.abs(lean) - 2), X1 = Math.ceil(x + w / 2 + Math.abs(lean) + 2);
  for (let py = Math.floor(base - h) - 1; py < Math.ceil(base); py++)
    for (let px = X0; px <= X1; px++) {
      if (!inside(px, py)) {
        if (py + 0.5 <= floorY && (inside(px - 1, py) || inside(px + 1, py) || inside(px, py + 1) || (inside(px, py - 1) && py < base - 1))) p.dot(px, py, S[0], a);
        continue;
      }
      if (white) {
        p.dot(px, py, WHITE, a);
        continue;
      }
      const k0 = py - Y0, u = RU[k0], c = x + lean * u, l = RL[k0], r = RR[k0], fx = px + 0.5;
      // which stratum this row sits in: facets jog sideways at each bedding plane, like stacked rock
      let band = 0, st = false;
      for (const s of sp.strata) {
        const d = u * h - s * h - sp.slope * (fx - c);
        if (d > 0) band++;
        if (Math.abs(d) < 0.5) st = true;
      }
      const jog = (rand(band, sp.seed) - 0.5) * 0.3, q = ((fx - l) / Math.max(0.5, r - l)) * 2 - 1, qr = -0.18 + jog;
      let i;
      if (u > 0.93) i = q < qr + 0.3 ? 7 : 5;
      else if (Math.abs(q - qr) < Math.max(0.09, 0.55 / Math.max(1, r - l))) i = 7;
      else if (q < qr) i = fx - l < 1 ? 7 : q < -0.5 + jog ? 6 : 5;
      else i = r - fx < 1 ? 3 : q < 0.38 + jog ? 4 : 2;
      if (st && i < 7) i -= 1;
      const fleck = rand(px * 7 + 3, py * 13 + 5);
      if (fleck < 0.035) i = q < qr ? 7 : i - 1;
      else if (fleck > 0.965) i -= 1;
      if (glint >= 0 && q < qr + 0.1) {
        const g = Math.abs(u - glint);
        if (g < 0.035) i = 8;
        else if (g < 0.07) i = Math.max(i, 7);
      }
      p.dot(px, py, i >= 8 ? WHITE : S[clamp(i, 0, S.length - 1)], a);
    }
  // cracks spreading over it, a lit lip on one side of each
  if (opts.cracks && opts.crack > 0)
    for (const path of opts.cracks) {
      const m = Math.max(1, Math.floor(path.length * opts.crack));
      for (let k = 1; k < m; k++) {
        const [u0, v0] = path[k - 1], [u1, v1] = path[k];
        const P = ([u, v]) => [x + lean * u + v * hw(u, v < 0 ? -1 : 1), base - u * h];
        const [ax, ay] = P([u0, v0]), [bx, by] = P([u1, v1]);
        if (u1 > clip) break;
        if (!inside(Math.floor(ax), Math.floor(ay)) || !inside(Math.floor(bx), Math.floor(by))) continue;
        const hot = opts.heat ?? 0, Gl = opts.glowRamp;
        if (hot > 0.05 && Gl) {
          // a seam of light inside the crack, a dark lip below it
          p.line(ax + 1, ay, bx + 1, by, S[0], a);
          p.line(ax, ay, bx, by, hot > 0.7 ? Gl[4] : hot > 0.4 ? Gl[3] : hot > 0.2 ? Gl[2] : Gl[1], a);
          if (k % 2 === 0) p.glow(bx, by, 7, Gl[2], 0.35 * hot);
        } else {
          p.line(ax, ay, bx, by, S[0], a);
          p.dot(bx + 1, by - 1, S[6], a * 0.7);
        }
      }
    }
}

/** The random look of one spike: notches on its edges, strata across it. */
export function spikeLook(R) {
  const notches = [], strata = [];
  for (let i = 0, n = R.int(3, 5); i < n; i++) notches.push({ u: R.range(0.1, 0.8), side: R.sign(), d: R.range(0.8, 1.8) });
  for (let i = 0, n = R.int(2, 4); i < n; i++) strata.push(R.range(0.12, 0.8));
  return { notches, strata, slope: R.range(-0.25, 0.25), seed: R.int(1, 9999) };
}

/** A crack that branches up a spike: points [u (height 0..1), v (-1 left edge..1 right edge)]. */
export function spikeCrack(R, u0, v0, dir) {
  const pts = [[u0, v0]];
  let u = u0, v = v0;
  for (let i = 0; i < 9; i++) {
    u += R.range(0.03, 0.08);
    v += dir * R.range(0.05, 0.28) + R.range(-0.12, 0.12);
    if (u > 0.95 || Math.abs(v) > 1) break;
    pts.push([u, v]);
  }
  return pts;
}

/** A jagged floor crack from x = 0 out to side * len: points [x, y], y 0..3 into the floor. */
export function floorCrack(R, side, len) {
  const pts = [[0, 0]];
  for (let x = 0; Math.abs(x) < len; ) {
    x += side * R.range(2, 5);
    pts.push([x, R.int(0, 2)]);
  }
  return pts;
}

/**
 * A leaf len px long and wid px across at its widest, centered on (x, y), turned by ang and flipping about its
 * midrib by fl (radians: edge on at pi/2, its paler underside showing past it). A pointed blade, lit along its
 * upper half and shaded along the lower, a darker midrib, a stem, a dark rim. pal: [dark, shade, body, light]
 * (dark to bright). alpha dithers it out.
 */
export function drawLeaf(p, x, y, len, wid, ang, fl, pal, alpha = 1) {
  const ca = Math.cos(ang), sa = Math.sin(ang), sq = Math.cos(fl), w = Math.max(0.55, Math.abs(sq) * wid), under = sq < 0;
  const R = Math.ceil(len / 2 + 2), X = Math.round(x), Y = Math.round(y);
  const inside = (i, j) => {
    const u = (i + 0.5) * ca + (j + 0.5) * sa + len / 2, v = -(i + 0.5) * sa + (j + 0.5) * ca;
    if (u < 0 || u > len) return 0;
    const half = w * Math.pow(Math.sin((Math.PI * u) / len), 0.75);
    return Math.abs(v) <= half ? (v < 0 ? 1 : 2) : 0;
  };
  for (let j = -R; j <= R; j++)
    for (let i = -R; i <= R; i++) {
      const s = inside(i, j);
      if (!s) {
        if (inside(i - 1, j) || inside(i + 1, j) || inside(i, j - 1) || inside(i, j + 1)) p.dot(X + i, Y + j, pal[0], alpha);
        continue;
      }
      const u = (i + 0.5) * ca + (j + 0.5) * sa + len / 2, v = -(i + 0.5) * sa + (j + 0.5) * ca;
      const rib = Math.abs(v) < 0.5 && u > len * 0.12 && u < len * 0.88 && w > 1.2;
      p.dot(X + i, Y + j, rib ? pal[1] : (s === 1) !== under ? pal[3] : pal[2], alpha);
    }
  // the stem trails off the base
  p.dot(X - ca * (len / 2 + 1), Y - sa * (len / 2 + 1), pal[1], alpha);
}

/**
 * Droplets of liquid: arc under gravity with a little drag, drawn as a bright bead with a short tail along
 * their motion, and land on the floor (onLand(d, y) in update, then they're gone). add(x, y, vx, vy, s, delay).
 */
export class Drops {
  constructor(ground = () => 0) {
    this.list = [];
    this.ground = ground;
  }
  add(x, y, vx, vy, s = 1, delay = 0, z = 0, vz = 0) {
    this.list.push({ x, y, z, vx, vy, vz, s, delay });
  }
  update(dt, onLand) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      if (d.delay > 0) {
        d.delay -= dt;
        continue;
      }
      const drag = 0.6 / d.s, py = d.y;
      d.vy += GRAVITY * dt;
      d.vx -= d.vx * drag * dt;
      d.vz -= d.vz * drag * dt;
      d.vy -= d.vy * drag * 0.5 * dt;
      d.x += d.vx * dt;
      d.z += d.vz * dt;
      d.y += d.vy * dt;
      const g = this.ground(d.x, d.z);
      if (d.vy > 0 && py <= g && d.y >= g) {
        onLand?.(d, g);
        this.list.splice(i, 1);
      }
    }
  }
  /** C: the liquid's ramp, dark to bright (5+ steps). */
  draw(p, C) {
    const n = C.length;
    for (const d of this.list) {
      if (d.delay > 0) continue;
      const sp = Math.hypot(d.vx, d.vy) || 1, ux = d.vx / sp, uy = d.vy / sp, len = Math.min(5, 0.5 + sp * 0.012);
      p.line(d.x - ux * len, d.y - uy * len, d.x - ux, d.y - uy, C[n - 4]);
      p.px(d.x, d.y, C[n - 1]);
      if (d.s > 1) p.px(d.x - ux, d.y - uy, C[n - 2]), p.px(d.x + 1, d.y, C[n - 3]);
      p.glow(d.x, d.y, 3 + d.s * 1.5, C[n - 2], 0.3);
    }
  }
  /** The same through a Space q: each bead trails a short streak back along its path in the world. */
  draw3(q, C) {
    const n = C.length;
    for (const d of this.list) {
      if (d.delay > 0) continue;
      const sp = Math.hypot(d.vx, d.vy, d.vz) || 1, len = Math.min(5, 0.5 + sp * 0.012) / sp;
      q.line(d.x - d.vx * len, d.y - d.vy * len, d.z - d.vz * len, d.x - d.vx / sp, d.y - d.vy / sp, d.z - d.vz / sp, C[n - 4]);
      q.px(d.x, d.y, d.z, C[n - 1]);
      if (d.s > 1) q.px(d.x - d.vx / sp, d.y - d.vy / sp, d.z - d.vz / sp, C[n - 2]), q.px(d.x + 1, d.y, d.z, C[n - 3]);
      q.glow(d.x, d.y, d.z, 3 + d.s * 1.5, C[n - 2], 0.3);
    }
  }
}

/** A puff of gas: a darker belly hanging low, a body, a denser core, a lit cap up and to the left (hi: a rim). */
export function gasPuff(p, x, y, r, a, belly, body, cap, hi = 0) {
  if (a < 0.02 || r < 0.6) return;
  p.disc(x + r * 0.06, y + r * 0.28, r * 0.9, belly, a * 0.55);
  p.disc(x, y, r, body, a * 0.45);
  p.disc(x + r * 0.03, y - r * 0.02, r * 0.76, body, a * 0.5);
  p.disc(x - r * 0.2, y - r * 0.34, r * 0.52, cap, a * 0.45);
  if (hi) p.disc(x - r * 0.3, y - r * 0.55, r * 0.26, hi, a * 0.32);
}

/**
 * A bubble of radius r centered at (x, y): a 1 px skin (lit c1 on its upper left, c2 elsewhere), a
 * translucent belly, a white glint. dome: only the part above y (a bubble swelling on a surface).
 */
export function bubble(p, x, y, r, c1, c2, fill, a = 1, dome = false) {
  const R = Math.ceil(r) + 1, X = Math.round(x), Y = Math.round(y);
  for (let j = -R; j <= (dome ? 0 : R); j++)
    for (let i = -R; i <= R; i++) {
      const d = Math.hypot(i, j);
      if (d > r + 0.45) continue;
      if (d > r - 0.6) p.dot(X + i, Y + j, i < 0 && j < -r * 0.2 ? c1 : c2, a);
      else p.blend(X + i, Y + j, fill, 0.3 * a);
    }
  if (r >= 1.5) p.dot(X - Math.round(r * 0.45), Y - Math.round(r * 0.5), WHITE, a);
}

/**
 * Puffs of gas with their own clock: add(t, x, y, vx, vy, r0, r1, end, rise) launches one at time t that drifts
 * off its push (fading drag), rises at `rise` px/s, sways, swells from r0 to r1 and thins out by `end`. Draw
 * them with draw(p, t, belly, body, cap, hi, k): layered translucent puffs, a little light on the big ones.
 */
export class Gas {
  constructor() {
    this.list = [];
    this.n = 0;
  }
  add(t, x, y, vx, vy, r0, r1, end, rise = 0) {
    this.list.push({ x, y, vx, vy, r0, r1, t0: t, end, rise, seed: (this.n++ * 37.7) % 100 });
  }
  prune(t) {
    for (let i = this.list.length - 1; i >= 0; i--) if (t > this.list[i].end) this.list.splice(i, 1);
  }
  at(q, t) {
    const age = t - q.t0, e = 1 - Math.exp(-age * 2.2), sw = Math.min(1, age);
    const x = q.x + (q.vx / 2.2) * e + Math.sin(t * 1.7 + q.seed) * 2.5 * sw, y = q.y + (q.vy / 2.2) * e - q.rise * age + Math.sin(t * 1.3 + q.seed * 2) * 1.5 * sw;
    const u = clamp(age / Math.max(0.01, q.end - q.t0)), r = q.r0 + (q.r1 - q.r0) * (1 - Math.pow(1 - Math.min(1, age / 1.2), 3));
    return { x, y, r, a: clamp(age / 0.15) * (1 - clamp((u - 0.4) / 0.6)), u };
  }
  draw(p, t, belly, body, cap, hi = 0, k = 1, glow = 0) {
    for (const q of this.list) {
      const g = this.at(q, t);
      if (g.a <= 0.02) continue;
      gasPuff(p, g.x, g.y, g.r, g.a * k, belly, body, cap, g.u < 0.5 ? hi : 0);
      if (glow && g.r > 4) p.glow(g.x, g.y, g.r * 1.6, glow, 0.07 * g.a * k);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 3D: solids with a depth for every pixel, laid out in world space (x right, y down, z towards the viewer).
// Everything here draws through a Space `q` and only needs the same hex ramps (dark to bright) as the 2D parts.

const QX = -0.45, QY = -0.6, QZ = 0.66; // the light, in view space: top left and in front (as lit() in the Space)
const PN = new Float64Array(4 * 48), PM = new Int32Array(48), MAXPX = 1 << 16;
const mB = new Int16Array(MAXPX), mW = new Float32Array(MAXPX), mS = new Float32Array(MAXPX), mA = new Float32Array(MAXPX), mV = new Float32Array(MAXPX);
let hHi = 0, hSec = 0, hBest = -1, hN = 0;

// the front-most surface of the convex solid in PN along the view ray through (a, b) (view px / k from its centre)
function hullHit(a, b) {
  let hi = Infinity, sec = Infinity, lo = -Infinity, best = -1;
  for (let i = 0; i < hN; i++) {
    const nz = PN[i * 4 + 2], s = PN[i * 4 + 3] - PN[i * 4] * a - PN[i * 4 + 1] * b;
    if (nz > 1e-6) {
      const w = s / nz;
      if (w < hi) (sec = hi), (hi = w), (best = i);
      else if (w < sec) sec = w;
    } else if (nz < -1e-6) {
      const w = s / nz;
      if (w > lo) lo = w;
    } else if (s < 0) return false;
  }
  if (best < 0 || hi < lo) return false;
  hHi = hi; hSec = sec; hBest = best;
  return true;
}

/**
 * A convex solid made of planes, drawn with a depth for every pixel: planes are [nx, ny, nz, d, material?] (unit
 * normal in the world, the solid is n . p <= d about its centre (cx, cy, cz)). ramps: one ramp of colors (dark to
 * bright) or a list of them, indexed by each plane's material. Facets are lit from the top left and in front in
 * hard steps, where two facets meet there is a lit or a dark crease, and a dark rim goes round the silhouette.
 * o: { R: radius bound in px, off: [x, y, z] the middle of that bound from the centre, a: alpha, white, rim: color,
 * floor: world y of a floor it is cut by, paint(c, x, y, z, plane, light) -> color or 0 (x, y, z are world offsets
 * from the centre) }.
 */
export function hull(q, cx, cy, cz, planes, ramps, o = {}) {
  if (!q.project(cx, cy, cz)) return;
  const RS = typeof ramps[0] === "number" ? [ramps] : ramps, k = q.k, sx = q.x, sy = q.y, d0 = q.d, p = q.p, z0 = p.z;
  const alpha = o.a ?? 1, rad = (o.R ?? 8) * k + 2, paint = o.paint, white = o.white;
  const ncy = q.cy, nsy = q.sy, ncp = q.cp, nsp = q.sp;
  // the middle of its bound on screen
  let bx = sx, by = sy;
  if (o.off) {
    const [ox, oy, oz] = o.off, vz0 = ox * nsy + oz * ncy;
    bx += (ox * ncy - oz * nsy) * k;
    by += (oy * ncp + vz0 * nsp) * k;
  }
  hN = 0;
  const put = (nx, ny, nz, d, m) => {
    const vz0 = nx * nsy + nz * ncy, i = hN++ * 4;
    PN[i] = nx * ncy - nz * nsy;
    PN[i + 1] = ny * ncp + vz0 * nsp;
    PN[i + 2] = vz0 * ncp - ny * nsp;
    PN[i + 3] = d;
    PM[i >> 2] = m;
  };
  for (const pl of planes) put(pl[0], pl[1], pl[2], pl[3], pl[4] ?? 0);
  if (o.floor !== undefined) put(0, 1, 0, o.floor - cy, 0);
  // its box in whole screen pixels, kept inside the frame
  let X0 = Infinity, X1 = -Infinity, Y0 = Infinity, Y1 = -Infinity;
  for (let c = 0; c < 4; c++) {
    const lx = bx + (c & 1 ? rad : -rad), ly = by + (c & 2 ? rad : -rad), tx = p.toX(lx, ly), ty = p.toY(lx, ly);
    X0 = Math.min(X0, tx); X1 = Math.max(X1, tx); Y0 = Math.min(Y0, ty); Y1 = Math.max(Y1, ty);
  }
  X0 = Math.max(Math.floor(X0), p.ox) - 1; X1 = Math.min(Math.ceil(X1), p.ox + p.w - 1) + 1; Y0 = Math.max(Math.floor(Y0), p.oy) - 1; Y1 = Math.min(Math.ceil(Y1), p.oy + p.h - 1) + 1;
  const W = X1 - X0 + 1, H = Y1 - Y0 + 1;
  if (W <= 2 || H <= 2 || W * H > MAXPX) return;
  mB.fill(-1, 0, W * H);
  p.each(bx - rad, by - rad, bx + rad, by + rad, (lx, ly, px, py) => {
    const a = (lx - sx) / k, b = (ly - sy) / k, m = (py - Y0) * W + (px - X0);
    if (m < 0 || m >= W * H || px < X0 || px > X1 || !hullHit(a, b)) return;
    mB[m] = hBest; mW[m] = hHi; mS[m] = hSec; mA[m] = a; mV[m] = b;
  });
  const rim = o.rim ?? RS[0][0], edgeW = 0.7 / k, gain = o.gain ?? 1, bias = o.bias ?? 0.1;
  for (let y = Y0 + 1; y < Y1; y++)
    for (let x = X0 + 1; x < X1; x++) {
      const m = (y - Y0) * W + (x - X0), i = mB[m];
      if (i < 0) continue;
      p.z = d0 - mW[m];
      if (mB[m - 1] < 0 || mB[m + 1] < 0 || mB[m - W] < 0 || mB[m + W] < 0) {
        p.put(x, y, rim, alpha);
        continue;
      }
      const nvx = PN[i * 4], nvy = PN[i * 4 + 1], nvz = PN[i * 4 + 2], L = nvx * QX + nvy * QY + nvz * QZ, R = RS[PM[i]] ?? RS[0], n = R.length;
      let j = 1 + Math.floor(clamp(bias + gain * L, 0, 0.999) * (n - 1));
      if (mS[m] - mW[m] < edgeW) j = L > 0.1 ? Math.min(n - 1, j + 1) : Math.max(1, j - 1);
      let c = white ? WHITE : R[j];
      if (paint && !white) {
        const a = mA[m], b = mV[m], vz = mW[m], vz0 = vz * ncp + b * nsp;
        c = paint(c, a * ncy + vz0 * nsy, b * ncp - vz * nsp, -a * nsy + vz0 * ncy, i, L) || c;
      }
      p.put(x, y, c, alpha);
    }
  p.z = z0;
}

/**
 * The planes of an irregular stone: n facets (unit normals spread round the sphere, jittered), r wide, squashed to
 * sq tall; the planes carry material 0. Turn it with turn().
 */
export function stone3(R, n = 11, sq = 0.8) {
  const out = [], a0 = R.range(0, TAU);
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(Math.max(0, 1 - y * y)), g = a0 + i * 2.399963 + R.range(-0.35, 0.35);
    let nx = Math.cos(g) * r + R.range(-0.12, 0.12), ny = y + R.range(-0.1, 0.1), nz = Math.sin(g) * r + R.range(-0.12, 0.12);
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    out.push([nx, ny, nz, Math.sqrt(nx * nx + nz * nz + ny * ny * sq * sq) * R.range(0.74, 1.04), 0]);
  }
  return out;
}

/** A random unit axis. */
export function axis3(R) {
  const z = R.range(-1, 1), a = R.range(0, TAU), r = Math.sqrt(1 - z * z);
  return [Math.cos(a) * r, z, Math.sin(a) * r];
}

/** planes turned by ang about the unit axis ax (Rodrigues) and their distances scaled by s. */
export function turn(planes, ax, ang, s = 1) {
  const c = Math.cos(ang), sn = Math.sin(ang), [kx, ky, kz] = ax;
  return planes.map(([x, y, z, d, m]) => {
    const dot = (kx * x + ky * y + kz * z) * (1 - c);
    return [x * c + (ky * z - kz * y) * sn + kx * dot, y * c + (kz * x - kx * z) * sn + ky * dot, z * c + (kx * y - ky * x) * sn + kz * dot, d * s, m ?? 0];
  });
}

/**
 * The planes of a pyramid standing on the floor y = 0 about the origin: n sides, r wide at the base, h tall, its tip
 * `lean` over in x and `leanZ` in z. rot turns the base; only the sides and the base are planes (cut it with more).
 */
export function pyramid(n, h, r, lean = 0, rot = 0, leanZ = 0) {
  const out = [], ap = [lean, -h, leanZ], V = Array.from({ length: n }, (_, i) => [Math.cos(rot + (i / n) * TAU) * r, 0, Math.sin(rot + (i / n) * TAU) * r]);
  for (let i = 0; i < n; i++) {
    const A = V[i], B = V[(i + 1) % n], e = [B[0] - A[0], 0, B[2] - A[2]], f = [ap[0] - A[0], ap[1], ap[2] - A[2]];
    let nx = e[1] * f[2] - e[2] * f[1], ny = e[2] * f[0] - e[0] * f[2], nz = e[0] * f[1] - e[1] * f[0];
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const mx = (A[0] + B[0]) / 2, mz = (A[2] + B[2]) / 2;
    if (nx * mx + nz * mz < 0) (nx = -nx), (ny = -ny), (nz = -nz);
    out.push([nx, ny, nz, nx * A[0] + ny * A[1] + nz * A[2], 0]);
  }
  out.push([0, 1, 0, 0, 0]);
  return out;
}

/**
 * An ellipsoid (rx wide, ry tall, rz deep, about the world axes) with a depth for every pixel. fn(nx, ny, nz, x, y, z)
 * gets the surface normal in view space (right, down, towards the viewer) and the world offset of the point from
 * the centre, and returns a color (0: leave it). o: { a, clipY (drop what lies below this y offset, a dome on the
 * floor), floor (drop what lies below this world y), alpha as a function: a(nx, ny, nz, x, y, z) }.
 */
export function ellipsoid(q, cx, cy, cz, rx, ry, rz, fn, o = {}) {
  if (!q.project(cx, cy, cz)) return;
  const k = q.k, sx = q.x, sy = q.y, d0 = q.d, p = q.p, z0 = p.z, R = Math.max(rx, ry, rz) * k + 2;
  const ncy = q.cy, nsy = q.sy, ncp = q.cp, nsp = q.sp, clipY = o.clipY ?? Infinity, fa = typeof o.a === "function";
  const Dx = ncp * nsy, Dy = -nsp, Dz = ncp * ncy, Q = (Dx / rx) ** 2 + (Dy / ry) ** 2 + (Dz / rz) ** 2;
  p.each(sx - R, sy - R, sx + R, sy + R, (lx, ly, px, py) => {
    const a = (lx - sx) / k, b = (ly - sy) / k, vz0 = b * nsp, Px = a * ncy + vz0 * nsy, Py = b * ncp, Pz = -a * nsy + vz0 * ncy;
    const B = (Px * Dx) / (rx * rx) + (Py * Dy) / (ry * ry) + (Pz * Dz) / (rz * rz), C = (Px / rx) ** 2 + (Py / ry) ** 2 + (Pz / rz) ** 2 - 1, disc = B * B - Q * C;
    if (disc < 0) return;
    const w = (-B + Math.sqrt(disc)) / Q, X = Px + w * Dx, Y = Py + w * Dy, Z = Pz + w * Dz;
    if (Y > clipY || (o.floor !== undefined && cy + Y > o.floor)) return;
    let gx = X / (rx * rx), gy = Y / (ry * ry), gz = Z / (rz * rz);
    const gl = Math.hypot(gx, gy, gz) || 1;
    gx /= gl; gy /= gl; gz /= gl;
    const vy0 = gx * nsy + gz * ncy, nvx = gx * ncy - gz * nsy, nvy = gy * ncp + vy0 * nsp, nvz = vy0 * ncp - gy * nsp;
    const c = fn(nvx, nvy, nvz, X, Y, Z);
    if (!c) return;
    p.z = d0 - w;
    p.put(px, py, c, fa ? o.a(nvx, nvy, nvz, X, Y, Z) : (o.a ?? 1));
  });
  p.z = z0;
}

/** Shade a normal (view space) in hard steps of ramp (dark to bright), from the same light as lit(); gain widens or narrows the light. */
export function shade3(ramp, nx, ny, nz, gain = 1, bias = 0.1) {
  const n = ramp.length;
  return ramp[1 + Math.floor(clamp(bias + gain * (nx * QX + ny * QY + nz * QZ), 0, 0.999) * (n - 1))];
}

/** How squarely a normal (view space) faces the light, -1 to 1. */
export const facing3 = (nx, ny, nz) => nx * QX + ny * QY + nz * QZ;

/**
 * A tube along points [[x, y, z], ...] as a chain of shaded balls: rad(u) its radius from the start (u = 0) to the end
 * (u = 1), colour(nx, ny, nz, u) the colour of the normal at u (view space). Round, lit, with a depth per pixel. floor: a
 * world y it is cut at (what lies below it is left out, pixel by pixel).
 */
export function tube(q, pts, rad, colour, floor = Infinity) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  const L = cum[cum.length - 1];
  if (L < 0.01) return;
  let s = 0, j = 1;
  while (s <= L) {
    while (j < pts.length - 1 && cum[j] < s) j++;
    const f = clamp((s - cum[j - 1]) / (cum[j] - cum[j - 1] || 1)), u = s / L, r = rad(u), A = pts[j - 1], B = pts[j];
    const y = A[1] + (B[1] - A[1]) * f, x = A[0] + (B[0] - A[0]) * f, z = A[2] + (B[2] - A[2]) * f;
    if (r > 0.05 && y - r <= floor) {
      if (floor === Infinity) q.ball(x, y, z, r, (nx, ny, nz) => colour(nx, ny, nz, u));
      else ellipsoid(q, x, y, z, r, r, r, (nx, ny, nz) => colour(nx, ny, nz, u), { floor });
    }
    s += Math.max(0.4, r * 0.45);
  }
}

// the axes of a plane, as the Space's own (floor: u is x, v is z)
function basis3(n) {
  const l = Math.hypot(...n), N = [n[0] / l, n[1] / l, n[2] / l], c = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nm = (v) => { const m = Math.hypot(...v) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
  const e1 = Math.abs(N[1]) > 0.9 ? nm(c(c(N, [1, 0, 0]), N)) : nm(c(N, [0, -1, 0]));
  return [e1, c(N, e1)];
}

/**
 * A leaf lying in 3D: its stem end at (x, y, z), pointing along dir (unit), len long, wid wide at the widest, its
 * flat face turned by roll about dir (0: facing up, as a leaf lies on a stem). A pointed blade lit along one half,
 * a darker midrib, a dark rim, its paler underside showing when it faces away. pal: [dark, shade, body, light].
 */
export function leaf3(q, x, y, z, dir, len, wid, roll, pal, alpha = 1) {
  // the face normal: the world up (-y) turned about dir by roll
  const [dx, dy, dz] = dir, up = Math.abs(dy) > 0.95 ? [1, 0, 0] : [0, -1, 0];
  let sx = dy * up[2] - dz * up[1], sy = dz * up[0] - dx * up[2], sz = dx * up[1] - dy * up[0];
  const sl = Math.hypot(sx, sy, sz) || 1;
  sx /= sl; sy /= sl; sz /= sl; // side
  let nx = sy * dz - sz * dy, ny = sz * dx - sx * dz, nz = sx * dy - sy * dx; // face normal
  const c = Math.cos(roll), s = Math.sin(roll), Sx = sx * c + nx * s, Sy = sy * c + ny * s, Sz = sz * c + nz * s;
  nx = dy * Sz - dz * Sy; ny = dz * Sx - dx * Sz; nz = dx * Sy - dy * Sx;
  const mx = x + dx * len / 2, my = y + dy * len / 2, mz = z + dz * len / 2, [e1, e2] = basis3([nx, ny, nz]), under = q.view(nx, ny, nz)[2] < 0;
  if (Math.abs(q.view(nx, ny, nz)[2]) < 0.14) {
    // edge on: a leaf is thin, not gone
    q.line(x, y, z, x + dx * len, y + dy * len, z + dz * len, pal[2], alpha);
    return;
  }
  const half = len / 2, ke = 0.9 / Math.max(0.5, q.k);
  q.plane(mx, my, mz, [nx, ny, nz], half + 1, (u, v, out) => {
    const wx = e1[0] * u + e2[0] * v, wy = e1[1] * u + e2[1] * v, wz = e1[2] * u + e2[2] * v;
    const along = wx * dx + wy * dy + wz * dz + half, across = wx * Sx + wy * Sy + wz * Sz;
    if (along < 0 || along > len) return;
    const hw = Math.max(0.45, wid * Math.pow(Math.sin((Math.PI * along) / len), 0.75));
    const ac = Math.abs(across);
    if (ac > hw) return;
    out.a = alpha;
    if (ac > hw - ke) return (out.c = pal[0]);
    if (ac < 0.5 * ke && along > len * 0.12 && along < len * 0.88 && hw > 1.2) return (out.c = pal[1]);
    out.c = across < 0 !== under ? pal[3] : pal[2];
  });
}

/** One soft puff of gas through a Space: a darker belly, a body, a lit cap up and to the left, in one translucent disc. */
export function puff3(q, x, y, z, r, a, belly, body, cap, hi = 0) {
  if (a < 0.02 || r < 0.6) return;
  q.disc(x, y, z, r, (d, ang) => {
    const lit = (-Math.cos(ang) * 0.55 - Math.sin(ang) * 0.83) * (1 - d * 0.55) * (1.1 - d * 0.4);
    return hi && lit > 0.62 ? hi : lit > 0.3 ? cap : lit < -0.35 ? belly : body;
  }, (d) => a * (0.34 + 0.4 * (1 - d * d)));
}

/**
 * Puffs of gas in space: add(t, x, y, z, vx, vy, vz, r0, r1, end, rise) launches one at time t that drifts off its
 * push (fading drag), rises at `rise` px/s, sways, swells from r0 to r1 and thins out by `end`. draw() sorts them far
 * to near through a Space.
 */
export class Gas3 {
  constructor() {
    this.list = [];
    this.n = 0;
  }
  add(t, x, y, z, vx, vy, vz, r0, r1, end, rise = 0) {
    this.list.push({ x, y, z, vx, vy, vz, r0, r1, t0: t, end, rise, seed: (this.n++ * 37.7) % 100 });
  }
  prune(t) {
    for (let i = this.list.length - 1; i >= 0; i--) if (t > this.list[i].end) this.list.splice(i, 1);
  }
  at(g, t) {
    const age = t - g.t0, e = 1 - Math.exp(-age * 2.2), sw = Math.min(1, age);
    const x = g.x + (g.vx / 2.2) * e + Math.sin(t * 1.7 + g.seed) * 2.5 * sw;
    const y = g.y + (g.vy / 2.2) * e - g.rise * age + Math.sin(t * 1.3 + g.seed * 2) * 1.5 * sw;
    const z = g.z + (g.vz / 2.2) * e + Math.cos(t * 1.5 + g.seed * 1.3) * 2.5 * sw;
    const u = clamp(age / Math.max(0.01, g.end - g.t0)), r = g.r0 + (g.r1 - g.r0) * (1 - Math.pow(1 - Math.min(1, age / 1.2), 3));
    return { x, y, z, r, a: clamp(age / 0.15) * (1 - clamp((u - 0.4) / 0.6)), u };
  }
  draw(q, t, belly, body, cap, hi = 0, k = 1, glow = 0) {
    const live = this.list.map((g) => ({ ...this.at(g, t), g })).filter((g) => g.a > 0.02);
    for (const g of q.sort(live, (v) => [v.x, v.y, v.z])) {
      puff3(q, g.x, g.y, g.z, g.r, g.a * k, belly, body, cap, g.u < 0.5 ? hi : 0);
      if (glow && g.r > 4) q.glow(g.x, g.y, g.z, g.r * 1.6, glow, 0.07 * g.a * k);
    }
  }
}

/** Rock debris (Bits with `pl` planes and `ax` an axis, made by rock3()) drawn as turning faceted stones through a Space. */
export function bits3(q, bits, ramp) {
  for (const b of bits.list) {
    const a = Math.min(1, b.life / 0.4);
    if (b.s < 1.4) q.dot(b.x, b.y, b.z, ramp[ramp.length - 3], a);
    else hull(q, b.x, b.y, b.z, turn(b.pl, b.ax, b.a, b.s), ramp, { R: b.s * 1.3, a });
  }
}

/** The extra fields rock debris needs for bits3: add them to a Bits entry with `{ ...b, ...rock3(R) }`. */
export function rock3(R, n = 9) {
  return { pl: stone3(R, n), ax: axis3(R) };
}
