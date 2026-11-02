// Shared by the scifi effects. Ghosts: the toolkit's simulated particles for loops (sparks that fall and bounce,
// smoke that rises and thins) worked out from their birth each frame, so a loop is a function of t alone and has
// no seam. Also lights that flare in loops, and electric arcs stroked the way Hugo strokes his bolts. Their motion is the toolkit's (src/core/sim.js), which is adapted from Sprite Fusion's open-source
// pixel art VFX (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.

import { Particles, P, PF, GRAVITY, hex, rand, WHITE, TAU } from "../../core/index.js";

const SOFT = new Set([P.VAPOUR, P.DUST, P.SMOKE]);
const STEP = 1 / 240;

// one toolkit step for one particle, with its own age standing in for the system clock (so it repeats)
function move(q, dt, age, ground) {
  switch (q.k) {
    case P.FIRE:
      q.vy -= 95 * dt;
      q.vx += Math.sin(age * 17 + q.seed) * 30 * dt;
      q.vx -= q.vx * 5 * dt;
      q.vy -= q.vy * 3.2 * dt;
      break;
    case P.GRIT: {
      q.vy += GRAVITY * dt;
      q.vx -= q.vx * 0.8 * dt;
      const g = ground(q.x), ny = q.y + q.vy * dt;
      q.x += q.vx * dt;
      if (q.vy > 0 && q.y <= g && ny >= g) {
        q.y = g - 0.25;
        if (q.vy > 130 && rand(q.seed * 1000, q.hops++) < 0.4) (q.vy = -q.vy * 0.25), (q.vx = q.vx * 0.5);
        else (q.vx = q.vy = 0), (q.life = Math.min(q.life, 0.5));
      } else q.y = ny;
      return;
    }
    case P.SPARK: {
      q.vy += GRAVITY * 0.45 * dt;
      q.vx -= q.vx * 2.2 * dt;
      q.vy -= q.vy * 2.2 * dt;
      const g = ground(q.x), ny = q.y + q.vy * dt;
      q.x += q.vx * dt;
      if (q.vy > 0 && q.y <= g && ny >= g) (q.vy = -q.vy * 0.45), (q.vx *= 0.7), (q.y = g - 0.25);
      else q.y = ny;
      return;
    }
    case P.STREAK: (q.vx += q.vx * 3 * dt), (q.vy += q.vy * 3 * dt); break;
    case P.FLAKE:
      q.vx -= q.vx * 2.2 * dt;
      q.vy -= q.vy * 2.2 * dt - 35 * dt;
      q.x += Math.sin(age * 2.5 + q.seed) * 7 * dt;
      break;
    case P.EMBER:
      q.vy += (-30 + Math.sin(age * 3 + q.seed) * 20) * dt;
      q.vx += Math.cos(age * 2.3 + q.seed) * 45 * dt;
      q.vx -= q.vx * 1.6 * dt;
      q.vy -= q.vy * 1.6 * dt;
      break;
    case P.SMOKE: {
      const big = q.flag & PF.BIG;
      q.vy -= (big ? 23 : 16) * dt;
      q.vx += Math.sin(age * 1.3 + q.seed) * 8 * dt;
      q.vx -= q.vx * 1.6 * dt;
      q.vy -= q.vy * 1.2 * dt;
      break;
    }
    case P.MOTE: q.vx -= q.vx * 0.6 * dt; q.vy -= q.vy * 0.6 * dt; break;
    default: {
      const drag = SOFT.has(q.k) ? 4 : 1.6;
      q.vx -= q.vx * drag * dt;
      q.vy -= q.vy * drag * dt + 5 * dt;
    }
  }
  q.x += q.vx * dt;
  q.y += q.vy * dt;
}

/**
 * Simulated particles for loops. add(born, ...Particles.spawn arguments) once, at build time, for each particle
 * born `born` seconds into the period; at(t) returns a Particles holding every particle alive at t, each moved
 * there from its birth by the toolkit's physics, ready for draw(p, layer). A particle born late in the period
 * carries on into the next one, so the loop has no seam. opts: the Particles options (ground, sparks, haze) and
 * box: [x0, y0, x1, y1], outside which particles are dropped (keeps sparks on the canvas).
 */
export class Ghosts {
  constructor(period, opts = {}) {
    this.D = period;
    this.ground = opts.ground ?? (() => Infinity);
    this.box = opts.box ?? null;
    this.ps = new Particles({ ground: this.ground, sparks: opts.sparks, haze: opts.haze });
    this.specs = [];
  }
  /**
   * One particle born at `born`. In 3D (at3) its x, y, vx, vy are worked out in a vertical plane: x is the distance
   * from the vertical axis through (ox, oz) along the direction phi (an angle round y, from +x towards +z), so a
   * burst out in a full circle is the same sim given a phi each.
   */
  add(born, k, x, y, vx, vy, life, col = WHITE, size = 1, flag = 0, phi = 0, ox = 0, oz = 0) {
    const n = this.specs.length, D = this.D;
    // a star's twinkle runs on the clock: pick its seed so the twinkle repeats with the period too
    let seed = rand(n, 41) * 100;
    if (k === P.STAR) {
      const m = Math.ceil((8 * D) / TAU), f = (TAU * m) / D - 8;
      if (f < 5) seed = f + 5 * Math.floor(rand(n, 43) * 19);
    }
    this.specs.push({ born: ((born % D) + D) % D, k, x, y, vx, vy, life, col: col ? hex(col) : 0, size, flag, seed, phi, ox, oz });
  }
  get count() {
    return this.specs.length;
  }
  /** The state of one particle `age` seconds after its birth, or null if it's gone. */
  state(s, age) {
    const q = { k: s.k, x: s.x, y: s.y, vx: s.vx, vy: s.vy, life: s.life, max: s.life, col: s.col, size: s.size, seed: s.seed, delay: 0, flag: s.flag, hops: 0 };
    let a = 0;
    while (a < age - 1e-9) {
      const dt = Math.min(STEP, age - a);
      move(q, dt, a, this.ground);
      a += dt;
      q.life -= dt;
      if (q.life <= 0) {
        // a fire puff with SMOKES turns into smoke when it dies, as in the toolkit
        if (q.k !== P.FIRE || !(q.flag & PF.SMOKES)) return null;
        const big = q.flag & PF.BIG, L = big ? 1.3 + rand(s.seed * 7, 1) : 0.8 + rand(s.seed * 7, 1) * 0.6;
        Object.assign(q, { k: P.SMOKE, vx: q.vx * 0.6, vy: q.vy * 0.6 - 6, life: L, max: L, col: 0, size: q.size * (big ? 0.85 : 0.7), flag: big ? PF.BIG : 0 });
      }
    }
    if (this.box) {
      const [x0, y0, x1, y1] = this.box;
      if (q.x < x0 || q.x > x1 || q.y < y0 || q.y > y1) return null;
    }
    return q;
  }
  at(t, three = false) {
    const D = this.D, list = [];
    for (const s of this.specs) {
      // its age now, and in each earlier period it may still be alive from (smoke from fire lives longer)
      const span = s.k === P.FIRE && s.flag & PF.SMOKES ? s.life + 2.4 : s.life;
      for (let age = (((t - s.born) % D) + D) % D; age < span; age += D) {
        const q = this.state(s, age);
        if (!q) continue;
        if (three) {
          // lay the flat sim down in its vertical plane
          const c = Math.cos(s.phi), n = Math.sin(s.phi), h = q.x, vh = q.vx;
          Object.assign(q, { x: s.ox + h * c, z: s.oz + h * n, vx: vh * c, vz: vh * n });
        }
        list.push(q);
      }
    }
    this.ps.list = list;
    this.ps.t = t;
    return this.ps;
  }
  /** The particles alive at t, laid in 3D: draw them with ps.draw(space). */
  at3(t) {
    return this.at(t, true);
  }
}

/** A light that flares in 3D (see flash). */
export function flash3(q, t, t0, x, y, z, r, c, k, life) {
  const a = t - t0;
  if (a < 0 || a >= life) return;
  const f = 1 - a / life;
  q.glow(x, y, z, r * (0.55 + 0.45 * f), c, k * f * f);
}

/** A light that flares at t0 and dies over life, as the toolkit's Lights do, for loops: k falls with life². */
export function flash(p, t, t0, x, y, r, c, k, life) {
  const a = t - t0;
  if (a < 0 || a >= life) return;
  const q = 1 - a / life;
  p.glow(x, y, r * (0.55 + 0.45 * q), c, k * q * q);
}

/** Smallest positive age of an event at t0 in a loop of period D, seen at t. */
export const since = (t, t0, D) => (((t - t0) % D) + D) % D;

/**
 * An electric arc along a path [[x, y], ...], drawn the way Hugo strokes his bolts: a dark halo, a bright body,
 * a white-hot core while it's fresh, light along it. C: [halo, body, glow]; k: 1 fresh, falling to 0; w: weight.
 */
export function strokeArc(p, pts, C, k = 1, w = 1) {
  const [halo, body, glow] = C;
  for (const pass of [0, 1, 2])
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.max(1, Math.hypot(bx - ax, by - ay));
      for (let d = 0; d <= L; d += 0.5) {
        const x = ax + ((bx - ax) * d) / L, y = ay + ((by - ay) * d) / L;
        if (pass === 0) p.circle(x, y, (k > 0.6 ? 1.6 : 1.1) * w, halo);
        else if (pass === 1) p.circle(x, y, (k > 0.6 ? 0.9 : 0.6) * w, body);
        else if (k > 0.3) p.px(x, y, WHITE);
      }
      if (pass === 0 && i % 3 === 0) p.glow(ax, ay, 9 * w, glow, 0.45 * k);
    }
}

// ---- 3D: shared by the scifi variants (`three` in each file)

/** A 2D path [[x, y], ...] stood up in the vertical plane at azimuth phi (x becomes the distance out along phi), about (ox, oz). */
export const upright = (pts, phi, ox = 0, oz = 0) => pts.map(([x, y]) => [ox + x * Math.cos(phi), y, oz + x * Math.sin(phi)]);

// 1 px line whose pixels sit `bias` nearer the camera than the line itself, to lie on top of a beam round it
export function coreLine(q, a, b, c, bias) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * 1.5));
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    q.pixel(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, (p, sx, sy) => {
      p.z -= bias;
      p.px(sx, sy, c);
    });
  }
}

/**
 * strokeArc in space: pts [[x, y, z], ...]. A dark halo, a bright body, a white-hot core while it is fresh and light
 * along it. C: [halo, body, glow]; k: 1 fresh, falling to 0; w: weight.
 */
export function strokeArc3(q, pts, C, k = 1, w = 1) {
  const [halo, body, glow] = C, hw = (k > 0.6 ? 3.2 : 2.2) * w, bw = (k > 0.6 ? 1.8 : 1.2) * w;
  for (let i = 1; i < pts.length; i++) {
    q.beam(...pts[i - 1], ...pts[i], hw, halo);
    q.beam(...pts[i - 1], ...pts[i], bw, body);
  }
  for (let i = 1; i < pts.length; i++) {
    if (k > 0.3) coreLine(q, pts[i - 1], pts[i], WHITE, bw / 2 + 0.4);
    if (i % 3 === 0) q.glow(...pts[i - 1], 9 * w, glow, 0.45 * k);
  }
}

// the world-space ray under the screen point (lx, ly): origin O, direction D, parameter s = how far toward the camera
const O = [0, 0, 0], Dv = [0, 0, 0];
function ray(q, lx, ly) {
  const z = q.zoom, f = q.dist === Infinity ? 0 : 1 / (z * q.dist);
  const vx = lx / z, vy = ly / z, dx = -lx * f, dy = -ly * f, { cy, sy, cp, sp } = q;
  O[0] = cy * vx + sy * sp * vy - q.ax;
  O[1] = cp * vy - q.ay;
  O[2] = -sy * vx + cy * sp * vy - q.az;
  Dv[0] = cy * dx + sy * sp * dy + sy * cp;
  Dv[1] = cp * dy - sp;
  Dv[2] = -sy * dx + cy * sp * dy + cy * cp;
}

const HIT = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, rim: 0, front: true, v: 0 };
const OUT = { c: 0, a: 1, l: 0, k: 0, blend: false };

// shade one ray hit: fn(h, out) with h = { x, y, z (from the centre), nx, ny, nz (outward normal), rim (0 face on, 1 edge on),
// front (the near wall) }, out as in Space.plane
function shadeHit(q, sx, sy, s, front, fn) {
  const h = HIT, o = OUT, p = q.p, z0 = p.z;
  h.front = front;
  // the normal as the camera sees it (vx right, vy down, vz towards us), and how edge-on the wall is
  h.vx = q.cy * h.nx - q.sy * h.nz;
  h.vy = q.sy * q.sp * h.nx + q.cp * h.ny + q.cy * q.sp * h.nz;
  h.vz = q.sy * q.cp * h.nx - q.sp * h.ny + q.cy * q.cp * h.nz;
  h.rim = 1 - Math.abs(h.vz);
  o.c = 0; o.a = 1; o.l = 0; o.k = 0; o.blend = false;
  const c = fn(h, o) || o.c;
  p.z = -s;
  if (c) o.blend ? p.blendPx(sx, sy, c, o.a) : p.put(sx, sy, c, o.a);
  if (o.k > 0) p.add(sx, sy, o.l || c, o.k);
  p.z = z0;
}

// the screen box of a world box
function screenBox(q, x0, y0, z0, x1, y1, z1) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (let i = 0; i < 8; i++) {
    if (!q.project(i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0)) return null;
    a = Math.min(a, q.x); c = Math.max(c, q.x); b = Math.min(b, q.y); d = Math.max(d, q.y);
  }
  return [a - 1, b - 1, c + 1, d + 1];
}

/**
 * A wall of revolution about the vertical axis through (cx, cz): radius r0 at height y0 (the upper end, smaller y) to r1
 * at y1, open at both ends. Every pixel is shaded where the camera's ray meets it, the far wall first and then the near
 * one, with a depth each: a translucent beam, a cage drum, a cone of light with real inside and outside.
 * fn(h, out): h.x, h.y, h.z are world offsets from (cx, 0, cz), h.nx..nz the outward normal, h.rim, h.front.
 */
export function cone(q, cx, cz, y0, y1, r0, r1, fn) {
  const R = Math.max(r0, r1), b = (r1 - r0) / (y1 - y0), a = r0 - b * y0, p = q.p;
  const box = screenBox(q, cx - R, y0, cz - R, cx + R, y1, cz + R);
  if (!box) return;
  p.each(box[0], box[1], box[2], box[3], (lx, ly, sx, sy) => {
    ray(q, lx, ly);
    const ox = O[0] - cx, oz = O[2] - cz, A = Dv[0] * Dv[0] + Dv[2] * Dv[2] - b * b * Dv[1] * Dv[1];
    const B = 2 * (ox * Dv[0] + oz * Dv[2] - b * Dv[1] * (a + b * O[1])), Cc = ox * ox + oz * oz - (a + b * O[1]) ** 2;
    let s0, s1;
    if (Math.abs(A) < 1e-9) {
      if (Math.abs(B) < 1e-12) return;
      s0 = s1 = -Cc / B;
    } else {
      const disc = B * B - 4 * A * Cc;
      if (disc < 0) return;
      const sq = Math.sqrt(disc);
      s0 = (-B - sq) / (2 * A); s1 = (-B + sq) / (2 * A);
      if (s0 > s1) [s0, s1] = [s1, s0];
    }
    // the far wall first (smaller s), then the near
    for (const [s, front] of [[s0, false], [s1, true]]) {
      const x = ox + s * Dv[0], y = O[1] + s * Dv[1], z = oz + s * Dv[2];
      if (y < y0 || y > y1 || a + b * y < 0) continue;
      HIT.x = x; HIT.y = y; HIT.z = z;
      const r = Math.hypot(x, z) || 1, n = Math.hypot(r, b * r) || 1;
      HIT.nx = x / n; HIT.ny = -b * r / n; HIT.nz = z / n;
      shadeHit(q, sx, sy, s, front, fn);
      if (s0 === s1) break;
    }
  });
}

/**
 * A sphere about (cx, cy, cz), shaded the same way, the far side first. Only the part with y <= yMax (relative to cy)
 * is kept: a dome standing on the floor.
 */
export function sphere(q, cx, cy, cz, R, fn, yMax = Infinity) {
  const box = screenBox(q, cx - R, cy - R, cz - R, cx + R, cy + Math.min(R, yMax), cz + R), p = q.p;
  if (!box) return;
  p.each(box[0], box[1], box[2], box[3], (lx, ly, sx, sy) => {
    ray(q, lx, ly);
    const ox = O[0] - cx, oy = O[1] - cy, oz = O[2] - cz, A = Dv[0] ** 2 + Dv[1] ** 2 + Dv[2] ** 2;
    const B = 2 * (ox * Dv[0] + oy * Dv[1] + oz * Dv[2]), disc = B * B - 4 * A * (ox * ox + oy * oy + oz * oz - R * R);
    if (disc < 0) return;
    const sq = Math.sqrt(disc);
    for (const [s, front] of [[(-B - sq) / (2 * A), false], [(-B + sq) / (2 * A), true]]) {
      const x = ox + s * Dv[0], y = oy + s * Dv[1], z = oz + s * Dv[2];
      if (y > yMax) continue;
      HIT.x = x; HIT.y = y; HIT.z = z;
      HIT.nx = x / R; HIT.ny = y / R; HIT.nz = z / R;
      shadeHit(q, sx, sy, s, front, fn);
    }
  });
}
