// Shared by the projectile effects: a steady emitter for loops, motion in a projectile's own frame, soft smoke
// puffs, speed-stretched sparks, muzzle-flash lobes, brass casings that bounce, and outlined pixel shapes.
// The smoke puff, spark streak, flash lobe and casing recipes are adapted from Sprite Fusion's open-source
// muzzle-flash and explosion (https://www.spritefusion.com/pixel-art-vfx/muzzle-flash),
// MIT License, Copyright (c) 2026 Hugo Duprez. Files starting with _ are helpers, not effects.

import { clamp, hex, mix, rand, rng, wrap, WHITE } from "../../core/index.js";

/**
 * Like cycle(), but particle i is born exactly at i * period / n: an emitter with a steady beat, so a trail
 * has no clumps or gaps. Loops seamlessly over period. fn(age, life, r, i), r the same rng every period.
 */
export function beat(t, period, n, seed, life, fn) {
  for (let i = 0; i < n; i++) {
    const L = typeof life === "function" ? life(rng(seed, i, 911)) : life;
    for (let age = wrap(t - (i * period) / n + 1e-7, period); age < L; age += period) fn(age, L, rng(seed, i), i);
  }
}

/**
 * Where something is after `age` seconds in the frame of a projectile that flies right at V px/s: launched
 * from (x, y) at (vx, vy) relative to the still air, slowed toward the air by drag k (1/s), pulled by g.
 * The air streams left at V, so whatever it carries streams left too. Returns [x, y, vx, vy] (screen motion).
 */
export function wake(x, y, vx, vy, age, V, k, g = 0) {
  const e = Math.exp(-k * age), f = (1 - e) / k, vt = g / k;
  return [x + vx * f - V * age, y + vt * age + (vy - vt) * f, vx * e - V, vt + (vy - vt) * e];
}

/**
 * A soft smoke puff: a body, a denser core sitting low, a lit cap on top while it's young (cap 0..1), and
 * light from a fire on one side (warm 0..1 of color wc, coming from angle wa).
 */
export function puff(p, x, y, r, a, c, cap = 1, warm = 0, wc = 0, wa = 0) {
  if (a <= 0.01 || r < 0.5) return;
  p.disc(x, y, r, c, a * 0.45);
  p.disc(x + r * 0.05, y + r * 0.06, r * 0.74, c, a * 0.62);
  if (cap > 0.02) p.disc(x - r * 0.22, y - r * 0.3, r * 0.5, mix(c, WHITE, 0.14), a * 0.42 * cap);
  if (warm > 0.02) p.disc(x + Math.cos(wa) * r * 0.32, y + Math.sin(wa) * r * 0.32, r * 0.55, wc, a * 0.7 * warm);
}

/**
 * Puffs [{ x, y, r, a, b (brightness 0..1), w (fire light 0..1) }] merged into one translucent volume: each
 * puff is lit on top and shaded underneath, densities add up, and tone and density come out in clean steps, so
 * a trail reads as one billowing cloud with lit crowns instead of a string of beads. R: smoke ramp, dark to
 * bright; WR: the same smoke lit by fire (a ramp as long as R), which young puffs (w) lean to. clip(x, y) can
 * keep it off part of the canvas.
 */
export function cloud(p, list, R, WR, { dens = 1.5, max = 0.86, clip, lit = 1 } = {}) {
  if (!list.length) return;
  // puffs that carry a depth d (cloud3) make the merged volume sit at its density-weighted depth
  const deep = list[0].d !== undefined, z0 = p.z;
  let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
  for (const q of list) {
    X0 = Math.min(X0, Math.floor(q.x - q.r)); X1 = Math.max(X1, Math.ceil(q.x + q.r));
    Y0 = Math.min(Y0, Math.floor(q.y - q.r)); Y1 = Math.max(Y1, Math.ceil(q.y + q.r));
  }
  const W = X1 - X0 + 3, H = Y1 - Y0 + 3, D = new Float32Array(W * H), L = new Float32Array(W * H), F = new Float32Array(W * H), Z = deep ? new Float32Array(W * H) : null;
  X0--, Y0--;
  for (const q of list) {
    const r = q.r, r2 = r * r;
    for (let y = Math.floor(q.y - r); y <= Math.ceil(q.y + r); y++) {
      const dy = y + 0.5 - q.y;
      for (let x = Math.floor(q.x - r); x <= Math.ceil(q.x + r); x++) {
        const dx = x + 0.5 - q.x, d2 = (dx * dx + dy * dy) / r2;
        if (d2 >= 1) continue;
        // a ball's thickness: flat in the middle, steep at the rim, so every lump keeps its own crown
        const k = Math.sqrt(1 - d2) * q.a, i = (y - Y0) * W + (x - X0);
        D[i] += k;
        L[i] += k * q.b;
        F[i] += k * q.w * (0.5 + 0.5 * clamp(0.5 + dx / r));
        if (deep) Z[i] += k * q.d;
      }
    }
  }
  // light the merged surface: where density climbs downward the cloud faces up and catches the light. The
  // gradient comes off a blurred copy, so only lump-sized features catch it, never the crossing rims
  const B = blur(blur(D, W, H, 1, 2), W, H, W, 2), n = R.length;
  p.each(X0 + 1, Y0 + 1, X1 + 1, Y1 + 1, (lx, ly, sx, sy) => {
    const cx = Math.floor(lx) - X0, cy = Math.floor(ly) - Y0;
    if (cx < 1 || cy < 1 || cx >= W - 1 || cy >= H - 1) return;
    const i = cy * W + cx, d = D[i];
    if (d < 0.05 || (clip && !clip(lx, ly))) return;
    const a = Math.min(max, Math.ceil((1 - Math.exp(-d * dens)) * 6) / 6);
    if (a < 0.15) return;
    const gy = B[i + W] - B[i - W], gx = B[i + 1] - B[i - 1], up = clamp(0.5 + Math.atan((gy * 0.9 + gx * 0.35) / (B[i] * 0.16 + 0.03)) * 0.42 * lit);
    const w = F[i] / d, j = clamp(Math.round((L[i] / d) * (0.3 + 0.7 * up) * (n - 1) + 0.25 + w * 1.5), 0, n - 1);
    if (deep) p.z = Z[i] / d;
    p.blendPx(sx, sy, w > 0.03 ? mix(R[j], WR[j], Math.min(0.9, Math.ceil(w * 10) / 10)) : R[j], a);
  });
  if (deep) p.z = z0;
}

/**
 * Simulated smoke for one-shots, drawn with cloud(): add({ x, y, vx, vy, r0, r1, life, a, b, warm, drag, rise,
 * grow, curl, delay }). Puffs push out, slow (drag, 1/s), lift (rise, px/s²), sway, swell from r0 to r1, thin away
 * and darken as they age; warm (fire light) fades fast; curl (rad/s) keeps turning a puff's heading, so a chain of
 * them hooks round into a curl. puffs() gives the live list for cloud().
 */
export class Smoke {
  constructor(rng) {
    this.R = rng;
    this.list = [];
    this.t = 0;
  }
  add(q) {
    this.list.push({ vx: 0, vy: 0, drag: 2.5, rise: 12, grow: 2, curl: 0, a: 0.6, b: 0.85, warm: 0, delay: 0, age: 0, seed: this.R.next() * 100, ...q });
  }
  get count() {
    return this.list.length;
  }
  update(dt) {
    this.t += dt;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const q = this.list[i];
      if (q.delay > 0) {
        q.delay -= dt;
        continue;
      }
      if ((q.age += dt) >= q.life) {
        this.list.splice(i, 1);
        continue;
      }
      if (q.curl) {
        const c = Math.cos(q.curl * dt), s = Math.sin(q.curl * dt), vx = q.vx;
        q.vx = vx * c - q.vy * s;
        q.vy = vx * s + q.vy * c;
      }
      q.vy -= q.rise * dt;
      q.vx += Math.sin(this.t * 1.3 + q.seed) * 8 * dt;
      q.vx -= q.vx * q.drag * dt;
      q.vy -= q.vy * q.drag * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
  }
  puffs() {
    const out = [];
    for (const q of this.list) {
      if (q.delay > 0) continue;
      const k = q.age / q.life;
      out.push({ x: q.x, y: q.y, r: q.r0 + (q.r1 - q.r0) * (1 - Math.exp(-q.grow * q.age)), a: q.a * Math.min(1, q.age * 30) * Math.pow(1 - k, 1.3), b: q.b * (1 - k * 0.5), w: q.warm * Math.exp(-q.age * 5) });
    }
    return out;
  }
}

// a box blur of radius r along one axis of a w x h field (step 1 for rows, w for columns)
function blur(src, w, h, step, r) {
  const out = new Float32Array(src.length), n = step === 1 ? w : h, lines = step === 1 ? h : w, k = 1 / (2 * r + 1);
  for (let l = 0; l < lines; l++) {
    const base = step === 1 ? l * w : l;
    let acc = 0;
    for (let j = -r; j <= r; j++) acc += j >= 0 && j < n ? src[base + j * step] : 0;
    for (let j = 0; j < n; j++) {
      out[base + j * step] = acc * k;
      const a = j - r, b = j + r + 1;
      if (a >= 0) acc -= src[base + a * step];
      if (b < n) acc += src[base + b * step];
    }
  }
  return out;
}

/**
 * A spark: a two-tone streak stretched along its screen velocity, its head cooling down S (hot, warm, cool,
 * tail colors) as k (life left, 1..0) falls, with a point of light.
 */
export function spark(p, x, y, vx, vy, k, S, glow = 0.45, stretch = 0.022, max = 9) {
  const sp = Math.hypot(vx, vy) || 1, ux = vx / sp, uy = vy / sp, len = Math.min(max, 1 + sp * stretch);
  const head = k > 0.6 ? S[0] : k > 0.3 ? S[1] : S[2];
  p.line(x - ux * len, y - uy * len, x - ux * len * 0.4, y - uy * len * 0.4, k > 0.5 ? head : S[3]);
  p.line(x - ux * len * 0.45, y - uy * len * 0.45, x, y, head);
  p.glow(x, y, 3, head, glow * k);
}

/**
 * The lobes of one muzzle flash, drawn from rng r: a fat fireball at the muzzle, a spike forward, and a burst of
 * rays round it, longest forward, shortest blown back, each side on its own (diagonals, crossways, back),
 * so every shot is a different spiky star. Frame f 2 is the same shape cooled, shorter and thinner; the same r
 * sequence gives the same shape, so a shot keeps its shape across its frames.
 */
export function flashShape(r, f, { size = 1, spike = [12, 20], diag = [5, 10], cross = [3, 6], back = [2, 4.5], core = 0.7 } = {}) {
  const k = f === 1 ? 1 : 0.6, w = f === 1 ? 1 : 0.72, S = size;
  const L = [
    { off: 0.5, a: r.range(-0.08, 0.08), len: r.range(5.5, 8) * S * k, wid: r.range(2.1, 2.6) * S * w, core: 0.5 * core },
    { off: 2, a: r.range(-0.07, 0.07), len: r.range(spike[0], spike[1]) * S * k, wid: r.range(1, 1.3) * S * w, core: 0.35 * core },
  ];
  const ray = (a, len, wid, on) => on && L.push({ off: r.range(0.5, 2), a, len: len * S * k, wid: wid * S * w, core: 0.25 * core });
  for (const s of [-1, 1]) {
    ray(s * r.range(0.3, 0.8), r.range(diag[0], diag[1]), r.range(1.1, 1.5), r.chance(0.85));
    ray(s * r.range(1.15, 1.7), r.range(cross[0], cross[1]), r.range(1, 1.3), r.chance(0.6));
    ray(s * r.range(2, 2.7), r.range(back[0], back[1]), 1, r.chance(0.7) && f === 1);
  }
  return L;
}
const profile = (l, u) => {
  const k = u / l.len;
  return l.wid * Math.pow(Math.max(0, 1 - k), 0.8) * Math.min(1, 0.45 + k * 3);
};

/**
 * Draw flash lobes L at (x, y) pointing along angle a: a white (or hot) core, a hot inner flame, a body and
 * a ragged rim, chosen by how deep a pixel sits inside its lobe. C: [core, inner, body, rim]. seed varies the
 * ragged edge. Returns the flash's reach.
 */
export function flash(p, x, y, a, L, C, seed) {
  const c = Math.cos(a), s = Math.sin(a);
  let ext = 2;
  for (const l of L) ext = Math.max(ext, l.off + l.len + 2);
  p.shade(x - ext, y - ext, x + ext, y + ext, (px, py) => {
    const dx = px - x, dy = py - y, along = dx * c + dy * s, across = -dx * s + dy * c;
    let m = -9, hot = false, warm = false;
    for (const l of L) {
      const ca = Math.cos(l.a), sa = Math.sin(l.a), lu = (along - l.off) * ca + across * sa, lv = -(along - l.off) * sa + across * ca;
      if (lu < -1.5 || lu > l.len + 1) continue;
      const r = profile(l, Math.max(0, lu)), mm = r - Math.abs(lv);
      if (mm > m) m = mm;
      if (lu < l.len * l.core && Math.abs(lv) <= r * 0.5) hot = true;
      if (mm > r * 0.4) warm = true;
    }
    const dm = 1.6 - Math.hypot(along - 0.5, across);
    if (dm > m) m = dm;
    if (dm > 0.6) hot = true;
    m += (rand(Math.floor(px) * 73 + Math.floor(py) * 151, seed) - 0.5) * 0.5 * Math.min(1, ext / 14);
    if (m < -0.85) return;
    return m < 0 ? C[3] : hot ? C[0] : warm ? C[1] : C[2];
  });
  return ext;
}

/**
 * A brass casing thrown from (x, y) at (vx, vy) with spin va, falling under g onto a floor at y = floor:
 * it bounces (keeping `bounce` of its speed) until it's too slow, then slides to a stop. Closed form, so a
 * loop can draw it at any age. Returns { x, y, a (angle), rest, hit (seconds since the last bounce, or -1) }.
 */
export function casing(x, y, vx, vy, va, age, g, floor, bounce = 0.42, a0 = 0) {
  let t0 = 0, a = a0, hit = -1;
  for (let n = 0; n < 6; n++) {
    // time to reach the floor from (x, y) moving (vx, vy)
    const d = floor - y, T = (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * d))) / g;
    if (age - t0 < T) {
      const u = age - t0;
      return { x: x + vx * u, y: y + vy * u + 0.5 * g * u * u, a: a + va * u, rest: false, hit };
    }
    x += vx * T;
    a += va * T;
    t0 += T;
    hit = age - t0;
    const vin = vy + g * T;
    y = floor;
    if (vin * bounce < 45) {
      // too slow to hop again: slide to a stop, settling flat
      const u = age - t0, k = 7, s = (1 - Math.exp(-k * u)) / k;
      return { x: x + vx * 0.6 * s, y: floor, a: Math.round(a / Math.PI) * Math.PI, rest: true, hit };
    }
    vy = -vin * bounce;
    vx *= 0.55;
    va *= 0.6;
  }
  return { x, y: floor, a: Math.round(a / Math.PI) * Math.PI, rest: true, hit };
}

/** Draw a casing: a 3 px brass slug turned by its angle, lit on one end; a glint when it has just hit. */
export function drawCasing(p, k, B, fade = 1) {
  const ca = Math.cos(k.a), sa = Math.sin(k.a), x = k.x, y = k.y - 0.5;
  p.dot(x - ca, y - sa, B[1], fade);
  p.dot(x, y, B[2], fade);
  p.dot(x + ca, y + sa, B[3], fade);
  if (k.hit >= 0 && k.hit < 0.07) {
    p.px(x + ca * 0.5, y - 1, WHITE);
    p.glow(x, y, 5, B[3], 0.55 * (1 - k.hit / 0.07));
  }
}

/**
 * A little sprite (rows of characters, pal mapping them to colors, "." empty) turned by ang about its pivot
 * (px, py in sprite pixels) placed at (x, y), sampled nearest-pixel so it stays hard-edged at any angle.
 */
export function turnSprite(p, rows, pal, x, y, ang, px, py, a = 1) {
  const H = rows.length, W = rows[0].length, cs = Math.cos(ang), sn = Math.sin(ang), R = Math.hypot(Math.max(px, W - px), Math.max(py, H - py)) + 1;
  p.shade(x - R, y - R, x + R, y + R, (lx, ly, out) => {
    const dx = lx - x, dy = ly - y, i = Math.floor(dx * cs + dy * sn + px), j = Math.floor(-dx * sn + dy * cs + py);
    if (i < 0 || j < 0 || i >= W || j >= H) return;
    const c = pal[rows[j][i]];
    if (!c) return;
    out.c = c;
    out.a = a;
  });
}

/**
 * A pixel shape from a builder: build(set) calls set(px, py, ch) for every interior pixel; an outline ('o')
 * is added round it. Returns { rows, x0, y0 } ready for p.sprite at (x0, y0).
 */
export function pixelShape(x0, y0, w, h, build) {
  const g = Array.from({ length: h }, () => Array(w).fill("."));
  const set = (px, py, ch) => {
    const i = px - x0, j = py - y0;
    if (i >= 0 && j >= 0 && i < w && j < h) g[j][i] = ch;
  };
  build(set);
  const solid = (i, j) => i >= 0 && j >= 0 && i < w && j < h && g[j][i] !== "." && g[j][i] !== "o";
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      if (g[j][i] === "." && (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1))) g[j][i] = "o";
  return { rows: g.map((r) => r.join("")), x0, y0 };
}


// ---------------------------------------------------------------------------------------------------------------
// 3D: the same recipes with a z. Everything below draws through a Space (src/core/space.js); the 2D helpers above are
// untouched.

/** A velocity of speed sp in a cone about +x (tilted up by `tilt` about z): th off the axis, round it by the azimuth ph. */
export function cone3(th, ph, sp, tilt = 0) {
  const s = Math.sin(th), c = Math.cos(th), ca = Math.cos(tilt), sa = Math.sin(tilt);
  return [(ca * c - sa * s * Math.cos(ph)) * sp, (sa * c + ca * s * Math.cos(ph)) * sp, Math.sin(ph) * s * sp];
}

/** Two unit vectors perpendicular to the unit direction (dx, dy, dz) and to each other. */
export function frame3(dx, dy, dz) {
  const a = Math.abs(dx) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let ux = dy * a[2] - dz * a[1], uy = dz * a[0] - dx * a[2], uz = dx * a[1] - dy * a[0];
  const l = Math.hypot(ux, uy, uz) || 1;
  ux /= l; uy /= l; uz /= l;
  return [[ux, uy, uz], [dy * uz - dz * uy, dz * ux - dx * uz, dx * uy - dy * ux]];
}

/** wake() with a z: returns [x, y, z, vx, vy, vz]. */
export function wake3(x, y, z, vx, vy, vz, age, V, k, g = 0) {
  const e = Math.exp(-k * age), f = (1 - e) / k, vt = g / k;
  return [x + vx * f - V * age, y + vt * age + (vy - vt) * f, z + vz * f, vx * e - V, vt + (vy - vt) * e, vz * e];
}

/** spark() in space: a two-tone streak stretched along its velocity (world units), cooling with k, a point of light. */
export function spark3(q, x, y, z, vx, vy, vz, k, S, glow = 0.45, stretch = 0.022, max = 9) {
  const sp = Math.hypot(vx, vy, vz) || 1, ux = vx / sp, uy = vy / sp, uz = vz / sp, len = Math.min(max, 1 + sp * stretch);
  const head = k > 0.6 ? S[0] : k > 0.3 ? S[1] : S[2];
  q.line(x - ux * len, y - uy * len, z - uz * len, x - ux * len * 0.4, y - uy * len * 0.4, z - uz * len * 0.4, k > 0.5 ? head : S[3]);
  q.line(x - ux * len * 0.45, y - uy * len * 0.45, z - uz * len * 0.45, x, y, z, head);
  q.glow(x, y, z, 3, head, glow * k);
}

/** Smoke with a z: add({ ..., z, vz }) as Smoke does; puffs() carries z for cloud3(). */
export class Smoke3 extends Smoke {
  add(q) {
    super.add({ z: 0, vz: 0, ...q });
  }
  update(dt) {
    this.t += dt;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const q = this.list[i];
      if (q.delay > 0) {
        q.delay -= dt;
        continue;
      }
      if ((q.age += dt) >= q.life) {
        this.list.splice(i, 1);
        continue;
      }
      if (q.curl) {
        const c = Math.cos(q.curl * dt), s = Math.sin(q.curl * dt), vx = q.vx;
        q.vx = vx * c - q.vy * s;
        q.vy = vx * s + q.vy * c;
      }
      q.vy -= q.rise * dt;
      q.vx += Math.sin(this.t * 1.3 + q.seed) * 8 * dt;
      q.vz += Math.cos(this.t * 1.1 + q.seed) * 8 * dt;
      q.vx -= q.vx * q.drag * dt;
      q.vy -= q.vy * q.drag * dt;
      q.vz -= q.vz * q.drag * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
    }
  }
  puffs() {
    const out = super.puffs(), live = this.list.filter((q) => q.delay <= 0);
    out.forEach((o, i) => (o.z = live[i].z));
    return out;
  }
}

/** cloud() in space: puffs { x, y, z, r, a, b, w } are projected and merged into one translucent volume. */
export function cloud3(q, list, R, WR, opts) {
  const flat = [];
  for (const s of list) if (q.project(s.x, s.y, s.z)) flat.push({ x: q.x, y: q.y, r: s.r * q.k, a: s.a, b: s.b, w: s.w, d: q.d });
  cloud(q.p, flat, R, WR, opts);
}

/** A filled triangle in space with a depth per pixel. fn(wa, wb, wc) (barycentric weights) returns a color, or 0 to skip. */
export function tri3(q, A, B, C, fn, a = 1) {
  const P = [A, B, C], S = [];
  for (const v of P) {
    if (!q.project(v[0], v[1], v[2])) return;
    S.push([q.x, q.y, q.d]);
  }
  const [[ax, ay, ad], [bx, by, bd], [cx, cy, cd]] = S, area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (Math.abs(area) < 1e-4) return;
  const p = q.p, z0 = p.z, e = -0.02;
  p.each(Math.min(ax, bx, cx) - 1, Math.min(ay, by, cy) - 1, Math.max(ax, bx, cx) + 1, Math.max(ay, by, cy) + 1, (lx, ly, sx, sy) => {
    const wa = ((bx - lx) * (cy - ly) - (by - ly) * (cx - lx)) / area, wb = ((cx - lx) * (ay - ly) - (cy - ly) * (ax - lx)) / area, wc = 1 - wa - wb;
    if (wa < e || wb < e || wc < e) return;
    const c = fn(wa, wb, wc);
    if (!c) return;
    p.z = wa * ad + wb * bd + wc * cd;
    p.put(sx, sy, c, a);
  });
  p.z = z0;
}

/** A quad (a, b, c, d in order round it) as two triangles. fn(u, v): u from edge ab to dc... u along a to b, v along a to d. */
export function quad3(q, A, B, C, D, fn, a = 1) {
  tri3(q, A, B, C, (wa, wb, wc) => fn(wb + wc, wc), a);
  tri3(q, A, C, D, (wa, wb, wc) => fn(wb, wb + wc), a);
}

/**
 * A rounded tube or cone from (x0, y0, z0) to (x1, y1, z1), radius r0 to r1, shaded as a solid: c(nx, ny, nz, u) takes
 * the surface normal as the screen sees it (lit(ramp) works) and u (0..1 along it), a depth per pixel.
 */
export function tube(q, x0, y0, z0, x1, y1, z1, r0, r1, c, a = 1) {
  if (!q.project(x0, y0, z0)) return;
  const ax = q.x, ay = q.y, ad = q.d, ka = q.k;
  if (!q.project(x1, y1, z1)) return;
  const bx = q.x, by = q.y, bd = q.d, kb = q.k, ra = r0 * ka, rb = r1 * kb, R = Math.max(ra, rb), p = q.p, zp = p.z;
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, flat = L2 < 1e-6;
  p.each(Math.min(ax, bx) - R, Math.min(ay, by) - R, Math.max(ax, bx) + R, Math.max(ay, by) + R, (lx, ly, sx, sy) => {
    const f = flat ? 0.5 : clamp(((lx - ax) * dx + (ly - ay) * dy) / L2), ex = lx - (ax + dx * f), ey = ly - (ay + dy * f);
    const rr = ra + (rb - ra) * f, e2 = ex * ex + ey * ey;
    if (rr <= 0 || e2 > rr * rr) return;
    const nx = ex / rr, ny = ey / rr, nz = Math.sqrt(1 - e2 / (rr * rr)), col = c(nx, ny, nz, f);
    if (!col) return;
    p.z = ad + (bd - ad) * f - nz * (r0 + (r1 - r0) * f);
    p.put(sx, sy, col, a);
  });
  p.z = zp;
}

/** A soft blob shadow on the floor (y = 0) centered on (cx, cz), hx wide along x and hz along z. */
export function shadow3(q, cx, cz, hx, hz, a = 0.3) {
  const R = Math.max(hx, hz), K = hex("#0a0812");
  q.plane(cx, 0, cz, null, R, (u, v, out) => {
    const e = Math.hypot(u / hx, v / hz);
    if (e >= 1) return;
    out.c = K;
    out.a = a * (1 - e * e);
    out.blend = true;
  });
}

/**
 * One lobe of a muzzle flash in space: a spike from (x, y, z) along the unit direction d, wid the half width at its
 * root, tapering to a point. cf(u, v) colors it (u along it, v 0 on the axis to 1 at the rim).
 */
export function spike3(q, x, y, z, dx, dy, dz, len, wid, cf) {
  const n = Math.max(3, Math.ceil(len / 2.5));
  for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = (i + 1) / n, um = (u0 + u1) / 2, w = 2 * profile({ len: 1, wid }, um);
    q.beam(x + dx * len * u0, y + dy * len * u0, z + dz * len * u0, x + dx * len * u1, y + dy * len * u1, z + dz * len * u1, Math.max(0.9, w), (u, v) => cf(u0 + (u1 - u0) * u, v));
  }
}

/**
 * flash() in space: the lobes L of flashShape(), each turned about the muzzle's axis to its own azimuth (golden
 * angle), so the star bursts out in every direction. The muzzle points along +x, tilted by a about z. C: [core, inner,
 * body, rim]. ball is the radius of the fireball at its heart (0 for none).
 */
export function flash3(q, x, y, z, a, L, C, seed = 0, ball = 3.4) {
  const ca = Math.cos(a), sa = Math.sin(a);
  L.forEach((l, i) => {
    const th = Math.abs(l.a), ph = i * 2.39996 + seed * 0.9, rx = Math.cos(th), ry = Math.sin(th) * Math.cos(ph), rz = Math.sin(th) * Math.sin(ph);
    const dx = rx * ca - ry * sa, dy = rx * sa + ry * ca, dz = rz;
    spike3(q, x + dx * l.off, y + dy * l.off, z + dz * l.off, dx, dy, dz, l.len, l.wid * 1.3, (u, v) => (v > 0.82 ? C[3] : v < 0.5 && u < l.core ? C[0] : v < 0.7 ? C[1] : C[2]));
  });
  if (ball > 0) q.ball(x + 0.8 * ca, y + 0.8 * sa, z, ball, (nx, ny, nz) => (nz > 0.6 ? C[0] : nz > 0.32 ? C[1] : nz > 0.12 ? C[2] : C[3]));
}

/** casing() in space: it leaves (x, y, z) at (vx, vy, vz); returns { x, y, z, a, ux, uz, rest, hit }. */
export function casing3(x, y, z, vx, vy, vz, va, age, g, floor, bounce = 0.42, a0 = 0) {
  const vh = Math.hypot(vx, vz) || 1e-6, ux = vx / vh, uz = vz / vh, k = casing(0, y, vh, vy, va, age, g, floor, bounce, a0);
  return { x: x + ux * k.x, y: k.y, z: z + uz * k.x, a: k.a, ux, uz, rest: k.rest, hit: k.hit };
}

/** A casing from casing3(): a 3 px brass slug tumbling in the vertical plane of its flight, lit on one end. */
export function drawCasing3(q, k, B, fade = 1) {
  const ca = Math.cos(k.a), sa = Math.sin(k.a), dx = k.ux * ca, dy = sa, dz = k.uz * ca, y = k.y - 0.5;
  q.dot(k.x - dx, y - dy, k.z - dz, B[1], fade);
  q.dot(k.x, y, k.z, B[2], fade);
  q.dot(k.x + dx, y + dy, k.z + dz, B[3], fade);
  if (k.hit >= 0 && k.hit < 0.07) {
    q.px(k.x + dx * 0.5, y - 1, k.z + dz * 0.5, WHITE);
    q.glow(k.x, y, k.z, 5, B[3], 0.55 * (1 - k.hit / 0.07));
  }
}
