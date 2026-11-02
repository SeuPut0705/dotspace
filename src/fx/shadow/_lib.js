// The flame puff (after sim.js's FIRE) and the swirling pull (attract) are adapted from Sprite Fusion's
// open-source black-hole (https://www.spritefusion.com/pixel-art-vfx/black-hole),
// MIT License, Copyright (c) 2026 Hugo Duprez.
//
// Shared bits for the shadow effects (files starting with _ are helpers, not effects): the void palette,
// light that black shapes cut, smoke lit from one side, violet flame, obsidian slivers, ink drops.

import { hex, mix, ramp, clamp, noise, WHITE, GRAVITY } from "../../core/index.js";

/** Dark magic, dark to bright: void black, deep violet, a white-lilac edge. */
export const VOID = ["#06040b", "#150c26", "#2a1150", "#461a84", "#6f2cc0", "#9d5cec", "#cfa6ff", "#f6eaff"];

/**
 * Take the light back off every pixel in a local box where dark(x, y) is true, keeping a share keep (0..1):
 * call it last, so black shapes stay black under every glow, spark and ring drawn before.
 */
export function unlight(p, x0, y0, x1, y1, dark, keep = 0) {
  const L = p.L, w = p.w, ox = p.ox, oy = p.oy;
  p.each(x0, y0, x1, y1, (x, y, sx, sy) => {
    if (!dark(x, y)) return;
    const i = (sy - oy) * w + (sx - ox), d = L[i];
    if (!d) return;
    if (keep <= 0) L[i] = 0;
    else L[i] = (255 << 24) | ((((d >>> 16) & 255) * keep) << 16) | ((((d >>> 8) & 255) * keep) << 8) | ((d & 255) * keep);
  });
}

// the pixel cells of the annulus r0 <= d < r1 round (x, y), row by row, jumping the hole: fn(cx, cy, d)
function annulus(x, y, r0, r1, fn) {
  const r02 = r0 > 0 ? r0 * r0 : -1, r12 = r1 * r1;
  for (let py = Math.floor(y - r1); py <= Math.ceil(y + r1); py++) {
    const cy = py + 0.5, dy = cy - y, dy2 = dy * dy;
    if (dy2 >= r12) continue;
    const xo = Math.sqrt(r12 - dy2), xi = dy2 < r02 ? Math.sqrt(r02 - dy2) : 0;
    for (let px = Math.floor(x - xo), x1 = Math.ceil(x + xo); px <= x1; px++) {
      const cx = px + 0.5, dx = cx - x;
      if (xi > 0 && dx > -xi && dx < xi) {
        px = Math.max(px, Math.floor(x + xi) - 1);
        continue;
      }
      const d2 = dx * dx + dy2;
      if (d2 < r12 && d2 >= r02) fn(cx, cy, Math.sqrt(d2));
    }
  }
}

/**
 * A ring from radius r - w out to r round (x, y), like p.ring (c and a may be functions of v: 0 inner to 1
 * outer, and angle) but visiting only the band's own pixels, so a big thin shock ring stays cheap.
 */
export function ringFast(p, x, y, r, w, c, a = 1) {
  if (r <= 0) return;
  const r0 = Math.max(0, r - w), fc = typeof c === "function", fa = typeof a === "function";
  annulus(x, y, r0, r, (cx, cy, d) => {
    const v = (d - r0) / (r - r0 || 1), ang = fc || fa ? Math.atan2(cy - y, cx - x) : 0;
    p.dot(cx, cy, fc ? c(v, ang) : c, fa ? a(v, ang) : a);
  });
}

/** Light hugging a circle of radius R at (x, y), falling off over w either side, only where keep(x, y). */
export function ringLight(p, x, y, R, w, c, k, keep = null) {
  if (w < 1 || k <= 0.004) return;
  const col = hex(c);
  annulus(x, y, Math.max(0, R - w), R + w, (cx, cy, d) => {
    if (keep && !keep(cx, cy)) return;
    const f = 1 - Math.abs(d - R) / w;
    p.light(cx, cy, col, f * f * k);
  });
}

/** A ring of light hugging a black disc: k at radius r0, falling to nothing at r1, and none inside r0. */
export function halo(p, x, y, r0, r1, c, k) {
  if (r1 <= r0 || k <= 0.004) return;
  const col = hex(c), w = r1 - r0;
  annulus(x, y, Math.max(0, r0), r1, (cx, cy, d) => {
    const f = 1 - (d - r0) / w;
    p.light(cx, cy, col, f * f * k);
  });
}

/**
 * A black star rasterized once: four long arms (L) and four short ones, turned rot, at (0, cy), its cells
 * in a grid. { at(x, y) } says if a local point is black; draw(p, c, rim, skip) fills it and burns a rim on
 * the cells just outside it (except where skip(x, y)). The arms keep a 1 px black spine to their tips.
 */
export function blackStar(cy, L, rot, short = 0.46, q = 0.32) {
  const R0 = Math.ceil(L) + 2, n = R0 * 2 + 1, data = new Uint8Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = i - R0 + 0.5, y = cy + j - R0 + 0.5;
      if (inStar(x, y, 0, cy, L, rot, q) || inStar(x, y, 0, cy, L * short, rot + Math.PI / 4, q)) data[j * n + i] = 1;
    }
  for (let a = 0; a < 4; a++)
    for (let d = 0, ca = Math.cos(rot + (a * Math.PI) / 2), sa = Math.sin(rot + (a * Math.PI) / 2); d < L - 1; d += 0.5) {
      const i = Math.floor(ca * d) + R0, j = Math.floor(sa * d) + R0;
      data[j * n + i] = 1;
    }
  const at = (x, y) => {
    const i = Math.floor(x) + R0, j = Math.floor(y - cy) + R0;
    return i >= 0 && j >= 0 && i < n && j < n && data[j * n + i] === 1;
  };
  return {
    R0,
    at,
    /** take the light off its black cells (call last, like unlight) */
    unlight(p) {
      const Lb = p.L, w = p.w, h = p.h, ox = p.ox, oy = p.oy;
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          if (!data[j * n + i]) continue;
          const x = i - R0 + 0.5, y = cy + j - R0 + 0.5, sx = p.cellX(x, y) - ox, sy = p.cellY(x, y) - oy;
          if (sx >= 0 && sy >= 0 && sx < w && sy < h) Lb[sy * w + sx] = 0;
        }
    },
    draw(p, c, rim, skip) {
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          const x = i - R0 + 0.5, y = cy + j - R0 + 0.5;
          if (data[j * n + i]) p.px(x, y, c);
          else if (rim && !skip(x, y) && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) p.px(x, y, rim);
        }
    },
  };
}

/** Is (x, y) inside a four-point star at (cx, cy), arms L long, turned rot? q < 1 hollows the sides into thin spikes. */
export function inStar(x, y, cx, cy, L, rot, q = 0.42) {
  if (L <= 0) return false;
  const c = Math.cos(rot), s = Math.sin(rot), dx = x - cx, dy = y - cy;
  const u = Math.abs(dx * c + dy * s) / L, v = Math.abs(-dx * s + dy * c) / L;
  // inside needs the smaller of u, v under 0.5^(1/q): most points fail that before any pow
  return u < 1 && v < 1 && Math.min(u, v) <= Math.pow(0.5, 1 / q) && Math.pow(u, q) + Math.pow(v, q) <= 1;
}

/**
 * Pull particles (anything with x, y, vx, vy) toward (x, y): gravity softened at r0, a swirl round it, drag
 * that grows inside reach. Those that reach r0 are eaten (removed); returns how many. w(q) weighs each one
 * (0 leaves it alone).
 */
export function attract(list, x, y, G, reach, swirl, r0, dt, w = () => 1, vmax = Infinity) {
  let eaten = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i], wt = w(q);
    if (!wt || q.delay > 0) continue;
    const dx = x - q.x, dy = y - q.y, d2 = dx * dx + dy * dy;
    if (d2 > reach * reach) continue;
    const d = Math.sqrt(d2) || 1;
    if (d < r0) {
      list.splice(i, 1);
      eaten++;
      continue;
    }
    const a = (G / (d2 + r0 * r0)) * Math.min(1, (reach - d) / (reach * 0.25)) * wt * dt, ux = dx / d, uy = dy / d;
    q.vx += (ux - uy * swirl) * a;
    q.vy += (uy + ux * swirl) * a;
    const drag = Math.min(0.2, (1 - d / reach) * 1.6 * dt);
    q.vx -= q.vx * drag;
    q.vy -= q.vy * drag;
    const v = Math.hypot(q.vx, q.vy);
    if (v > vmax) (q.vx *= vmax / v), (q.vy *= vmax / v);
  }
  return eaten;
}

/** Puff kinds: FLAME (a ball of flame cooling down a ramp), SOOT (dark smoke lit on the side facing a light). */
export const PK = { FLAME: 0, SOOT: 1 };

/**
 * Violet flame and dark smoke. opts: { rng, flame: ramp white-hot to burnt out, soot: [fresh, old] smoke
 * colours, cap: the soot's dim lit top, rim: [hot, warm, dim] colours of its lit side, floor: (x, z) => y }.
 * spawn(kind, x, y, vx, vy, life, size, delay, smokes, z, vz): smokes turns a dying flame into soot; z, vz
 * (towards the viewer) are for 3D and drift, sway and drag like x.
 * draw(p, kind, light): light = { x, y, z, k, reach } is what the soot's rims face (k 0 leaves them dark). Given a
 * Space it draws each puff as a billboard at its depth (soot far to near, flame near to far); light is then 3D.
 */
export class Puffs {
  constructor(o) {
    this.R = o.rng;
    this.list = [];
    this.t = 0;
    this.F = ramp(o.flame);
    this.soot = ramp(o.soot);
    this.cap = hex(o.cap);
    this.rim = ramp(o.rim);
    this.floor = o.floor ?? null;
  }
  spawn(k, x, y, vx, vy, life, size, delay = 0, smokes = false, z = 0, vz = 0) {
    this.list.push({ k, x, y, z, vx, vy, vz, life, max: life, size, delay, smokes, seed: this.R.next() * 100 });
  }
  get count() {
    return this.list.length;
  }
  update(dt) {
    this.t += dt;
    const t = this.t;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const q = this.list[i];
      if (q.delay > 0) {
        q.delay -= dt;
        continue;
      }
      if ((q.life -= dt) <= 0) {
        if (q.k === PK.FLAME && q.smokes) this.spawn(PK.SOOT, q.x, q.y - 1, q.vx * 0.5, q.vy * 0.5 - 6, this.R.range(0.9, 1.6), q.size * 1.25, 0, false, q.z, q.vz * 0.5);
        this.list.splice(i, 1);
        continue;
      }
      if (q.k === PK.FLAME) {
        q.vy -= 95 * dt;
        q.vx += Math.sin(t * 17 + q.seed) * 30 * dt;
        q.vz += Math.cos(t * 13 + q.seed) * 30 * dt;
        q.vx -= q.vx * 5 * dt;
        q.vz -= q.vz * 5 * dt;
        q.vy -= q.vy * 3.2 * dt;
      } else {
        q.vy -= 18 * dt;
        q.vx += Math.sin(t * 1.3 + q.seed) * 8 * dt;
        q.vz += Math.cos(t * 1.1 + q.seed) * 8 * dt;
        q.vx -= q.vx * 1.6 * dt;
        q.vz -= q.vz * 1.6 * dt;
        q.vy -= q.vy * 1.3 * dt;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      // smoke rolls along the floor rather than through it
      if (this.floor && q.k === PK.SOOT) {
        const f = this.floor(q.x, q.z) - q.size * 0.6;
        if (q.y > f) (q.y = f), (q.vy = Math.min(0, q.vy)), (q.vx *= 1 - 2 * dt), (q.vz *= 1 - 2 * dt);
      }
    }
  }
  draw(p, kind, light = null) {
    if (p.project) return this.draw3(p, kind, light);
    for (const q of this.list) {
      if (q.delay > 0 || q.k !== kind) continue;
      this.drawOne(p, q, q.x, q.y, q.size, light);
    }
  }
  // through a Space: soot far to near (translucent), flame near to far, each puff a billboard at its depth. The
  // light's direction is read off the screen, its distance in the world, both scaled to this puff's px per unit.
  draw3(s, kind, light) {
    const items = [];
    for (const q of this.list) if (q.delay <= 0 && q.k === kind && s.project(q.x, q.y, q.z)) items.push({ q, d: s.d, sx: s.x, sy: s.y, k: s.k });
    items.sort((a, b) => (kind === PK.SOOT ? b.d - a.d : a.d - b.d));
    let lx = 0, ly = 0, lit = false;
    if (light && light.k > 0.02 && s.project(light.x, light.y, light.z ?? 0)) (lx = s.x), (ly = s.y), (lit = true);
    for (const it of items) {
      const q = it.q;
      let l = null;
      if (lit) l = { x: lx - it.sx, y: ly - it.sy, k: light.k, reach: light.reach * it.k, dist: Math.hypot(light.x - q.x, light.y - q.y, (light.z ?? 0) - q.z) * it.k };
      s.at(q.x, q.y, q.z, (pp, k) => this.drawOne(pp, q, 0, 0, q.size * k, l));
    }
  }
  // one puff of size `size` px at (x, y); light = { x, y, k, reach, dist? } as in draw, dist overriding the distance
  drawOne(p, q, x, y, size, light) {
    const F = this.F, n = F.length, k = q.life / q.max, age = 1 - k;
    if (q.k === PK.FLAME) {
      // a ball of flame: a darker rim, a lit core up and left, a tongue on top, a hot heart while young
      const heat = Math.min(0.999, Math.pow(age, 0.62) + (q.seed % 1) * 0.1), idx = Math.min(n - 2, Math.floor(heat * (n - 1)));
      const r = size * (0.55 + 0.45 * Math.min(1, age * 7)) * (1 - age * 0.55), c = F[idx];
      if (idx >= n - 3) p.disc(x, y, r, c, Math.min(1, k * 3) * 0.8);
      else {
        p.circle(x, y, r, F[Math.min(n - 1, idx + 2)]);
        p.circle(x - r * 0.16, y - r * 0.22, r * 0.78, c);
        if (r > 1.6) p.circle(x, y - r * 0.9, r * 0.42, c);
        if (idx <= 3 && r > 1.8) p.circle(x - r * 0.28, y - r * 0.34, r * 0.36, F[Math.max(0, idx - 1)]);
        if (idx < 6) p.glow(x, y, r * 2.4 + 2, c, 0.2 * k);
      }
      return;
    }
    // soot: a soft body and a denser core, a dim cap on top, and lit from the side facing the light by two
    // discs pushed toward it (a soft wash over the near half, a brighter lip at its edge)
    const r = size * (0.65 + Math.min(1, age * 2.5) * 0.45 + age * 0.45);
    const a = Math.min(1, age * 10) * Math.min(1, k * 2.2) * 0.72, body = mix(this.soot[0], this.soot[1], age);
    // one pass for the body: thinner at the edge, denser in the core (two layers' worth)
    const edge = a * 0.5, core = 1 - (1 - a * 0.5) * (1 - a * 0.62);
    p.disc(x, y + r * 0.06, r, body, (d) => (d < 0.72 ? core : edge));
    const lk = light ? light.k : 0;
    if (lk < 0.5) p.disc(x - r * 0.2, y - r * 0.32, r * 0.48, this.cap, a * 0.32 * (1 - age * 0.7) * (1 - lk * 2));
    if (lk <= 0.02) return;
    const lx = light.x - x, ly = light.y - y, dl = Math.sqrt(lx * lx + ly * ly) || 1, ux = lx / dl, uy = ly / dl;
    const lit = Math.min(1, light.k * clamp(1.3 - (light.dist ?? dl) / light.reach)) * a;
    if (lit <= 0.02) return;
    const [hot, warm, dim] = this.rim;
    p.disc(x + ux * r * 0.26, y + uy * r * 0.26, r * 0.72, dim, lit * 0.55);
    p.disc(x + ux * r * 0.5, y + uy * r * 0.5, r * 0.46, warm, lit * 0.5);
    if (r > 3) p.disc(x + ux * r * 0.68, y + uy * r * 0.68, r * 0.24, hot, lit * 0.4);
  }
}

/**
 * attract() in 3D: pull anything with x, y, z, vx, vy, vz toward (x, y, z). The swirl turns round the vertical
 * axis through the point, in the floor plane. Eaten ones are removed; returns how many.
 */
export function attract3(list, x, y, z, G, reach, swirl, r0, dt, w = () => 1, vmax = Infinity) {
  let eaten = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i], wt = w(q);
    if (!wt || q.delay > 0) continue;
    const dx = x - q.x, dy = y - q.y, dz = z - q.z, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > reach * reach) continue;
    const d = Math.sqrt(d2) || 1;
    if (d < r0) {
      list.splice(i, 1);
      eaten++;
      continue;
    }
    const a = (G / (d2 + r0 * r0)) * Math.min(1, (reach - d) / (reach * 0.25)) * wt * dt, ux = dx / d, uy = dy / d, uz = dz / d;
    q.vx += (ux - uz * swirl) * a;
    q.vz += (uz + ux * swirl) * a;
    q.vy += uy * a;
    const drag = Math.min(0.2, (1 - d / reach) * 1.6 * dt);
    q.vx -= q.vx * drag;
    q.vy -= q.vy * drag;
    q.vz -= q.vz * drag;
    const v = Math.hypot(q.vx, q.vy, q.vz);
    if (v > vmax) (q.vx *= vmax / v), (q.vy *= vmax / v), (q.vz *= vmax / v);
  }
  return eaten;
}

/**
 * unlight() for a ball in a Space: take the light (down to the share keep) off the pixels of the ball at (x, y, z),
 * radius r, leaving its outer `inset` px (a lit rim), and only the pixels whose depth is the ball's own, so what
 * drifts in front of it keeps its glow. Call it after the glows that wash over the ball.
 */
export function unlit3(q, x, y, z, r, inset = 0, keep = 0) {
  if (!q.project(x, y, z)) return;
  const p = q.p, D = p.D, L = p.L, w = p.w, h = p.h, ox = p.ox, oy = p.oy, cx = q.x, cy = q.y, d0 = q.d, R = r * q.k, lim = ((r - inset) / r) ** 2;
  p.each(cx - R, cy - R, cx + R, cy + R, (lx, ly, sx, sy) => {
    const nx = (lx - cx) / R, ny = (ly - cy) / R, s = nx * nx + ny * ny;
    if (s >= lim) return;
    const ix = sx - ox, iy = sy - oy;
    if (ix < 0 || iy < 0 || ix >= w || iy >= h) return;
    const i = iy * w + ix, d = L[i];
    if (!d || Math.abs(D[i] - (d0 - Math.sqrt(1 - s) * r)) > 0.75) return;
    L[i] = keep <= 0 ? 0 : (255 << 24) | ((((d >>> 16) & 255) * keep) << 16) | ((((d >>> 8) & 255) * keep) << 8) | ((d & 255) * keep);
  });
}

/**
 * A thin ring of dots in space: centre (cx, cy, cz), in the plane spanned by the unit vectors e1, e2, radius r,
 * w wide (concentric rows of dots, so a big ring stays cheap). c and a may be functions of (v: 0 inner to 1
 * outer, g: angle from e1 towards e2); keep(y) false skips a dot, as under the floor.
 */
export function ring3(q, cx, cy, cz, e1, e2, r, w, c, a = 1, keep = null) {
  if (r <= 0) return;
  const n = Math.max(8, Math.ceil(r * Math.PI * 2 * 1.3)), rows = Math.max(1, Math.ceil(w / 0.9)), fc = typeof c === "function", fa = typeof a === "function";
  for (let j = 0; j < rows; j++) {
    const rr = Math.max(0.3, r - (j + 0.5) * (w / rows)), v = 1 - (j + 0.5) / rows;
    for (let i = 0; i < n; i++) {
      const g = (i / n) * Math.PI * 2, cg = Math.cos(g) * rr, sg = Math.sin(g) * rr;
      const y = cy + e1[1] * cg + e2[1] * sg;
      if (keep && !keep(y)) continue;
      q.dot(cx + e1[0] * cg + e2[0] * sg, y, cz + e1[2] * cg + e2[2] * sg, fc ? c(v, g) : c, fa ? a(v, g) : a);
    }
  }
}

/**
 * Space.beam that also takes the light off the pixels it wins: a black thing that stays black under every glow.
 * Draw it after the glows. c may be a function of (u along, v across).
 */
export function darkBeam(q, x0, y0, z0, x1, y1, z1, w, c, bias = 0) {
  const s = q.clip(x0, y0, z0, x1, y1, z1);
  if (!s) return;
  const [X0, Y0, Z0, X1, Y1, Z1, u0, u1] = s;
  q.project(X0, Y0, Z0);
  const ax = q.x, ay = q.y, ad = q.d, ra = (w / 2) * q.k;
  q.project(X1, Y1, Z1);
  const bx = q.x, by = q.y, bd = q.d, rb = (w / 2) * q.k, r = Math.max(ra, rb), p = q.p, zp = p.z;
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9, D = p.D, Lb = p.L, W = p.w, H = p.h, ox = p.ox, oy = p.oy, fc = typeof c === "function";
  p.each(Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r, (lx, ly, sx, sy) => {
    const f = clamp(((lx - ax) * dx + (ly - ay) * dy) / L2), ex = ax + dx * f - lx, ey = ay + dy * f - ly, rr = ra + (rb - ra) * f, dist = Math.sqrt(ex * ex + ey * ey);
    if (dist > rr || rr <= 0) return;
    const v = dist / rr, z = ad + (bd - ad) * f - Math.sqrt(1 - v * v) * (w / 2) - bias;
    p.z = z;
    p.put(sx, sy, fc ? c(u0 + (u1 - u0) * f, v) : c);
    const ix = sx - ox, iy = sy - oy;
    if (ix >= 0 && iy >= 0 && ix < W && iy < H && D[iy * W + ix] === Math.fround(z)) Lb[iy * W + ix] = 0;
  });
  p.z = zp;
}

/**
 * An obsidian shard from core Bits ({ x, y, a, s, life }): a thin triangle pointing along its spin angle, a
 * dark violet body, the long edge facing the light at (lx, ly) lit (brighter with lk), the other in shadow,
 * a white glint at the tip while the light is strong. C is an 8-step palette.
 */
export function shard(p, b, C, lx, ly, lk) {
  const fa = Math.min(1, b.life / 0.4), ca = Math.cos(b.a), sa = Math.sin(b.a), L = Math.max(2, b.s), W = Math.max(2, L * 0.55);
  const side = -sa * (lx - b.x) + ca * (ly - b.y) > 0 ? 1 : -1;
  const rim = lk > 0.6 ? C[6] : lk > 0.3 ? C[5] : lk > 0.08 ? C[4] : C[3], E = L / 2 + 1.5;
  p.shade(b.x - E, b.y - E, b.x + E, b.y + E, (x, y, out) => {
    const dx = x - b.x, dy = y - b.y, u = dx * ca + dy * sa, v = (-dx * sa + dy * ca) * side;
    if (u < -L / 2 - 0.4 || u > L / 2 + 0.4) return;
    const half = ((W / 2) * (L / 2 - u)) / L + 0.4;
    if (Math.abs(v) > half) return;
    out.a = fa;
    if (u > L / 2 - 1.3 && lk > 0.3) return WHITE;
    if (v > half - 1) return u > -L / 4 ? rim : C[Math.max(3, C.indexOf(rim) - 1)];
    return v < -half + 1 ? C[1] : C[2];
  });
  if (lk > 0.04) p.glow(b.x, b.y, 3 + L * 0.6, C[5], 0.2 * lk * fa);
}

/**
 * Ink drops: fly under gravity, land on the floor (y = floor(x)) and call onLand(x, y, speed).
 * add(x, y, vx, vy, size); update(dt); draw(p, body, shine) draws a dark drop with a lit top.
 */
export class Drops {
  constructor(o = {}) {
    this.list = [];
    this.floor = o.floor ?? (() => 0);
    this.onLand = o.onLand ?? null;
    this.g = o.g ?? 0.8;
  }
  add(x, y, vx, vy, size = 1) {
    this.list.push({ x, y, vx, vy, size });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      d.vy += GRAVITY * this.g * dt;
      d.vx -= d.vx * 0.4 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const f = this.floor(d.x);
      if (d.vy > 0 && d.y >= f) {
        this.onLand?.(d.x, f, d.vy, d.size);
        this.list.splice(i, 1);
      }
    }
  }
  draw(p, body, shine) {
    for (const d of this.list) {
      const up = d.vy < 0;
      p.px(d.x, d.y, body);
      if (d.size > 1.4) p.px(d.x, d.y + (up ? 1 : -1), body);
      p.px(d.x, d.y - (d.size > 1.4 && !up ? 1 : 0), shine);
    }
  }
}

/**
 * A dark pool opened in the floor, seen at a slant (radius rx, centred on the floor at x = 0): the far lip lit,
 * the near lip dark, ripples ({ x, t0, life, w }) running out across it, a sheen along the far side, a wet fringe.
 */
export function floorPool(p, C, rx, t, ripples) {
  if (rx < 1) return;
  const ry = rx * 0.17 + 0.6;
  p.shade(-rx - 3, -ry - 2, rx + 3, ry + 2, (x, y) => {
    const dx = x / rx, dy = (y - 0.5) / ry, d = Math.sqrt(dx * dx + dy * dy);
    if (d > 1.18) return;
    if (d > 1) {
      if (dy < 0 && d < 1.09) return Math.abs(dx) < 0.55 ? C[6] : Math.abs(dx) < 0.85 ? C[5] : C[4];
      if (dy >= 0 && d < 1.09) return C[2];
      return y > -0.5 && noise(x * 0.7, 9) > 0.15 ? C[1] : undefined;
    }
    // ripples: ellipses on the slanted surface, kept about a pixel thick all the way round
    for (const r of ripples) {
      const age = t - r.t0, rr = age * 46 * r.w + 1, ex = x - r.x, ey = (y - 0.5) / 0.17, e = Math.sqrt(ex * ex + ey * ey) || 1;
      const g = Math.sqrt(ex * ex + (ey / 0.17) ** 2) / e;
      if (Math.abs(e - rr) < 0.55 * g && age < r.life) return age < r.life * 0.5 ? C[4] : C[3];
    }
    if (dy < -0.55 && dy > -0.85 && noise(x * 0.25 + t * 1.3, 4) > 0.2) return noise(x * 0.6 - t * 2, 6) > 0.55 ? C[5] : C[2];
    // the far inner wall catches the glow from below: violet just under the lip, falling to black
    if (dy < -0.35 && d > 0.72) return d > 0.9 ? C[3] : C[2];
    return d > 0.86 ? C[1] : C[0];
  });
}

// ---- 3D ink: the pool, drops, curves and lit balls shared by shadow-tendrils and grasping-hands (their `three`)
import { noise2 as inkNoise2 } from "../../core/index.js";

/** The world light of the ink effects, a unit vector from the surface toward it: far left and above. */
export const INK_LIGHT = (() => {
  const v = [-0.5, -0.55, -0.67], l = Math.hypot(...v);
  return v.map((x) => x / l);
})();
const INK_HL = Math.hypot(INK_LIGHT[0], INK_LIGHT[2]), INK_HX = INK_LIGHT[0] / INK_HL, INK_HZ = INK_LIGHT[2] / INK_HL;

/**
 * floorPool in 3D: a true circle of radius rx on the floor (centred at the origin) through a Space q: the lip lit
 * on the side facing INK_LIGHT, the inner wall opposite catching the glow from below, ripples ({ x, z, t0, life, w })
 * as true rings running out across it, a sheen near the lit side, a wet fringe on the dark side.
 */
export function inkPool(q, C, rx, t, ripples) {
  if (rx < 1) return;
  const lip = 1 + 2.6 / rx, fringe = 1 + 5 / rx;
  q.plane(0, 0, 0, null, rx * fringe + 1, (u, v) => {
    const rr = Math.hypot(u, v), d = rr / rx, s = rr > 0.01 ? (u * INK_HX + v * INK_HZ) / rr : 0;
    if (d > 1) {
      if (d < lip) return s > 0.55 ? C[6] : s > 0.2 ? C[5] : s > -0.1 ? C[4] : s > -0.5 ? C[3] : C[2];
      return d < fringe && s < 0.35 && inkNoise2(u * 0.7, v * 0.7, 9) > 0.15 ? C[1] : undefined;
    }
    for (const r of ripples) {
      const age = t - r.t0;
      if (age >= r.life) continue;
      if (Math.abs(Math.hypot(u - r.x, v - r.z) - (age * 46 * r.w + 1)) < 0.75) return age < r.life * 0.5 ? C[4] : C[3];
    }
    if (s > 0.2 && d > 0.45 && d < 0.85 && inkNoise2(Math.atan2(v, u) * 2.2 + t * 1.3, d * 3, 4) > 0.15) return inkNoise2(Math.atan2(v, u) * 5 - t * 2, d * 6, 6) > 0.5 ? C[5] : C[2];
    if (s < -0.1 && d > 0.72) return d > 0.9 ? C[3] : C[2];
    return d > 0.86 ? C[1] : C[0];
  });
}

/** A lit collar ring where something breaks the floor at (x, z): radius r, lit on the side toward INK_LIGHT. */
export function inkCollar(q, C, x, z, r) {
  q.ring(x, 0, z, r, 1.3, (v, g) => {
    const s = Math.cos(g) * INK_HX + Math.sin(g) * INK_HZ;
    return s > 0.6 ? C[6] : s > 0.1 ? C[5] : s > -0.4 ? C[4] : C[3];
  });
}

/**
 * Ink drops in 3D: fly under gravity, land on the floor and call onLand(x, z, speed, size).
 * add(x, y, z, vx, vy, vz, size); update(dt); draw(q, body, shine) through a Space.
 */
export class InkDrops {
  constructor(o = {}) {
    this.list = [];
    this.onLand = o.onLand ?? null;
    this.g = o.g ?? 0.8;
  }
  add(x, y, z, vx, vy, vz, size = 1) {
    this.list.push({ x, y, z, vx, vy, vz, size });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      d.vy += GRAVITY * this.g * dt;
      d.vx -= d.vx * 0.4 * dt;
      d.vz -= d.vz * 0.4 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      if (d.vy > 0 && d.y >= 0) {
        this.onLand?.(d.x, d.z, d.vy, d.size);
        this.list.splice(i, 1);
      }
    }
  }
  draw(q, body, shine) {
    for (const d of this.list) {
      const up = d.vy < 0;
      q.px(d.x, d.y, d.z, body);
      if (d.size > 1.4) q.px(d.x, d.y + (up ? 1 : -1), d.z, body);
      q.px(d.x, d.y - (d.size > 1.4 && !up ? 1 : 0), d.z, shine);
    }
  }
}

/**
 * Walk a curve in 3D from (x, y, z) heading T (unit), len px long, a point every ds. N (unit, across T) is the
 * plane it bends toward first; bend(s, i) returns the turn rates [toward N, toward B = T x N] in rad/px at arc
 * length s. Each point: { x, y, z, s, tx, ty, tz, nx, ny, nz, bx, by, bz }; the frame is carried along as it turns.
 */
export function inkWalk(x, y, z, T, N, len, ds, bend) {
  let [tx, ty, tz] = T, [nx, ny, nz] = N;
  const pts = [], n = Math.ceil(len / ds);
  for (let i = 0; i <= n; i++) {
    const s = i * ds, bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
    pts.push({ x, y, z, s, tx, ty, tz, nx, ny, nz, bx, by, bz });
    const [da, db] = bend(s, i);
    tx += (da * nx + db * bx) * ds;
    ty += (da * ny + db * by) * ds;
    tz += (da * nz + db * bz) * ds;
    const l = Math.hypot(tx, ty, tz) || 1;
    tx /= l; ty /= l; tz /= l;
    const d = nx * tx + ny * ty + nz * tz;
    nx -= d * tx; ny -= d * ty; nz -= d * tz;
    const m = Math.hypot(nx, ny, nz) || 1;
    nx /= m; ny /= m; nz /= m;
    x += tx * ds; y += ty * ds; z += tz * ds;
  }
  return pts;
}

/**
 * The ink body colour for a Space ball: shade(glow) returns a function of the ball's screen normal. A near-black body
 * with a lighter half toward INK_LIGHT, a bright rim on the lit edge (white where it faces the light squarely), violet
 * on the dark edge; glow 0..1 turns the facing pixels to a running pulse of light.
 */
export function inkShade(q, C) {
  const v = q.view(...INK_LIGHT), m = Math.hypot(v[0], v[1]), sx = v[0] / (m || 1), sy = v[1] / (m || 1), edge = Math.min(1, m * 2 + 0.3);
  return (glow = 0) => (nx, ny, nz) => {
    if (glow > 0.2 && nz > 0.45) return glow > 0.7 ? C[7] : C[5];
    if (nz < 0.58) {
      const e = nx * sx + ny * sy;
      if (e > 0.25) return e > 0.88 && edge > 0.8 ? C[7] : e > 0.5 && edge > 0.5 ? C[6] : C[5];
      return e < -0.25 ? C[3] : C[4];
    }
    const f = nx * v[0] + ny * v[1] + nz * v[2];
    return f > 0.45 ? C[2] : f > -0.3 ? C[1] : C[0];
  };
}

/** A ball of ink (see inkShade) that the floor cuts: nothing of it below y = 0 is drawn. */
export function inkBall(q, shade, x, y, z, r, glow = 0) {
  if (y - r >= 0) return;
  if (y + r <= 0) return q.ball(x, y, z, r, shade(glow));
  const cp = q.cp, sp = q.sp;
  q.ball(x, y, z, r, shade(glow), (nx, ny, nz) => (y + r * (ny * cp - nz * sp) <= 0 ? 1 : 0));
}
