// Shared by the ice effects: panes of ice that tumble and skid, polygon helpers, a character turned to ice,
// cracks that race through a shape. Files starting with _ are helpers, not effects.
// The crack walk and the faceted crystal shading are adapted from Sprite Fusion's open-source ice
// (https://www.spritefusion.com/pixel-art-vfx/ice), MIT License, Copyright (c) 2026 Hugo Duprez.

import { GRAVITY, clamp, luma, rand, TAU, WHITE } from "../../core/index.js";

/** Is (x, y) inside the polygon pts [[x, y], ...]? (even-odd rule) */
export function inPoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A polygon's centroid and area: { x, y, area }. */
export function centroid(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [x0, y0] = pts[j], [x1, y1] = pts[i], k = x0 * y1 - x1 * y0;
    a += k;
    cx += (x0 + x1) * k;
    cy += (y0 + y1) * k;
  }
  if (Math.abs(a) < 1e-6) {
    const n = pts.length;
    return { x: pts.reduce((s, q) => s + q[0], 0) / n, y: pts.reduce((s, q) => s + q[1], 0) / n, area: 0 };
  }
  return { x: cx / (3 * a), y: cy / (3 * a), area: Math.abs(a) / 2 };
}

/** Cut a polygon along the line through (x, y) at angle a: the pieces with three corners or more. */
export function splitPoly(pts, x, y, a) {
  const nx = -Math.sin(a), ny = Math.cos(a), side = (q) => (q[0] - x) * nx + (q[1] - y) * ny, L = [], Rt = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], sp = side(p), sq = side(q);
    (sp >= 0 ? L : Rt).push(p);
    if (sp >= 0 !== sq >= 0) {
      const u = sp / (sp - sq), m = [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
      L.push(m);
      Rt.push(m);
    }
  }
  return [L, Rt].filter((s) => s.length >= 3);
}

/** A color turned to ice: its brightness picks a step of the ice ramp C (dark to bright), never the darkest. */
export function iceOf(c, C) {
  const n = C.length, l = luma(c);
  return C[clamp(Math.round(((l < 0.12 ? 2 : 2 + l * 5.2) * (n - 1)) / 7), 1, n - 1)];
}

/** Fill a polygon with translucent color (true blending, no dither): glass, ice, light. */
export function glassPoly(p, pts, c, a) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (inPoly(pts, x + 0.5, y + 0.5)) p.blend(x, y, c, a);
}

/**
 * Panes of ice: flat polygons that fly, spin and tumble end over end (they squash as they turn edge-on and
 * flash as they square up to the light), bounce on the floor, skid, settle and fade. Drawn as glass: a
 * translucent face, edges lit where they face the light, a glint.
 * add({ pts (corners around 0, 0), x, y, vx, vy, a (turn), va, f (tumble), vf, lit (0..1: how much light its
 * face catches), g, drag, bounce, life, brittle (breaks on that many hard landings), crumble (seconds it lies
 * still before it crumbles), solid (opaque: one `tone` 0..1, or shaded like a blade split along `ridge`, an angle) });
 * update(dt); draw(p, C)
 * with an ice ramp, dark to bright. onLand(q, x, y, speed) when one hits the floor hard, onCrumble(q) when one
 * that lay still crumbles away, onSkid(q, x, y) while one slides along the floor.
 */
export class Panes {
  constructor(opts = {}) {
    this.list = [];
    this.ground = opts.ground ?? (() => Infinity);
    this.onLand = opts.onLand ?? null;
    this.onCrumble = opts.onCrumble ?? null;
    this.onSkid = opts.onSkid ?? null;
  }
  add(q) {
    const life = q.life ?? 1;
    this.list.push({ vx: 0, vy: 0, a: 0, va: 0, f: 0, vf: 0, lit: 0.6, g: 1, drag: 0.3, bounce: 0.35, rest: false, brittle: false, ...q, life, max: life });
  }
  get count() {
    return this.list.length;
  }
  /** The pane's corners as drawn: tumbled (squashed across its own width), turned and placed. */
  corners(q) {
    const ca = Math.cos(q.a), sa = Math.sin(q.a), k = Math.cos(q.f);
    return q.pts.map(([x, y]) => {
      const yy = y * k;
      return [q.x + x * ca - yy * sa, q.y + x * sa + yy * ca];
    });
  }
  seat(q) {
    let low = -Infinity;
    for (const c of this.corners(q)) low = Math.max(low, c[1]);
    return low;
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const q = this.list[i];
      if ((q.life -= dt) <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      const floor = this.ground(q.x) - 0.5;
      if (q.rest && q.crumble !== undefined && (q.restT = (q.restT ?? 0) + dt) > q.crumble) {
        this.onCrumble?.(q);
        this.list.splice(i, 1);
        continue;
      }
      if (q.rest) {
        // skidding: friction slows the slide and the spin, the pane stays seated on the floor
        if (Math.abs(q.vx) > 8) this.onSkid?.(q, q.x, floor + 0.5);
        q.x += q.vx * dt;
        q.vx -= q.vx * 7 * dt;
        q.a += q.va * dt;
        q.va -= q.va * 9 * dt;
        q.vf -= q.vf * 9 * dt;
        q.f += q.vf * dt;
        q.y -= this.seat(q) - floor;
        continue;
      }
      q.vy += GRAVITY * q.g * dt;
      q.vx -= q.vx * q.drag * dt;
      q.vy -= q.vy * q.drag * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.a += q.va * dt;
      q.f += q.vf * dt;
      const low = this.seat(q);
      if (q.g <= 0 || low < floor || q.vy <= 0) continue;
      q.y -= low - floor;
      if (q.vy > 70) (q.hits = (q.hits ?? 0) + 1), this.onLand?.(q, q.x, floor + 0.5, q.vy);
      if (q.brittle && q.vy > 70 && q.hits >= q.brittle) {
        this.list.splice(i, 1);
        continue;
      }
      if (q.vy > 70 && q.bounce > 0) {
        q.vy = -q.vy * q.bounce;
        q.vx *= 0.75;
        q.va *= 0.6;
        q.vf *= 0.5;
      } else {
        q.rest = true;
        q.vy = 0;
      }
    }
  }
  draw(p, C) {
    const n = C.length;
    for (const q of this.list) {
      const a = Math.min(1, q.life / 0.35), pts = this.corners(q), k = Math.cos(q.f), face = Math.abs(k);
      // the face: glassy, brighter the more it faces us and the more light it catches; it flashes as it squares up
      const lv = q.lit * (0.35 + 0.65 * face), flash = face > 0.97 && !q.rest;
      if (face > 0.25) {
        if (q.solid && q.tone !== undefined) {
          // a chunk of one face: its tone, brighter as it squares up to the light
          p.poly(pts, flash ? C[n - 1] : C[clamp(Math.round(1 + q.tone * 5 * (0.6 + 0.4 * face)), 1, n - 2)], a);
        } else if (q.solid) {
          // shaded like the blade it broke from: a lit side, a pale ridge, a deep side
          const rr = q.ridge ?? -Math.PI / 2, cr = Math.cos(rr), sr = Math.sin(rr), ca = Math.cos(q.a), sa = Math.sin(q.a);
          const rx = cr * ca - sr * k * sa, ry = cr * sa + sr * k * ca;
          let nx = -ry, ny = rx;
          if (nx * -0.55 + ny * -0.84 < 0) (nx = -nx), (ny = -ny);
          const lit = flash ? C[n - 1] : C[clamp(Math.round(3 + lv * 3), 3, n - 2)], deep = C[clamp(Math.round(1 + lv * 2), 1, 3)];
          p.poly(pts, (x, y) => {
            const d = (x - q.x) * nx + (y - q.y) * ny;
            return d > 0.6 ? lit : d > -0.6 ? C[n - 2] : deep;
          }, a);
        } else glassPoly(p, pts, flash ? C[n - 1] : C[clamp(Math.round(3 + lv * 3), 3, n - 2)], (0.3 + 0.35 * lv + (flash ? 0.3 : 0)) * a);
      }
      let cx = 0, cy = 0, top = 0;
      for (const [x, y] of pts) (cx += x), (cy += y);
      cx /= pts.length;
      cy /= pts.length;
      // edges: lit where they face the light (up and left), cool where they face away
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        let nx = y1 - y0, ny = x0 - x1;
        if (nx * ((x0 + x1) / 2 - cx) + ny * ((y0 + y1) / 2 - cy) < 0) (nx = -nx), (ny = -ny);
        const l = Math.hypot(nx, ny) || 1, lit = (-nx * 0.55 - ny * 0.84) / l;
        p.line(x0, y0, x1, y1, face < 0.25 || lit > 0.35 ? C[n - 1] : lit > -0.25 ? C[n - 2] : q.solid ? C[1] : C[Math.max(2, n - 4)], a);
        if (pts[i][1] < pts[top][1]) top = i;
      }
      if (face > 0.7) p.dot(pts[top][0], pts[top][1], WHITE, a);
      p.glow(cx, cy, 5, C[n - 3], (flash ? 0.5 : 0.14) * a);
    }
  }
}

/**
 * A jagged ice blade standing on its base (bx, by), tip at (tx, ty), w wide at the base. Shaded in an ice ramp
 * C (dark to bright, 8 steps): a lit facet on the left with a pale edge, a bright ridge, a deep facet on the
 * right, a white tip, a dark rim, and a notch cut into one side so it reads as a shard, not a cone.
 * opts: { a (alpha), white (flash it white), glint (0..1: a highlight across it at that height, or -1),
 * jag (0..1: where the notch starts, or -1), dim (steps darker, for back rows) }.
 */
export function blade(p, bx, by, tx, ty, w, C, opts = {}) {
  const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy);
  if (L < 1.5 || w < 0.5) return;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, a = opts.a ?? 1, dim = opts.dim ?? 0, jag = opts.jag ?? -1, glint = opts.glint ?? -1;
  const K = (i) => C[clamp(i - dim, 0, C.length - 1)], hw = w / 2;
  // half widths on the left (lit) and right (shadow) sides at height u; the notch steps the right side in
  const left = (u) => hw * (1 - u) + 0.35, right = (u) => hw * (1 - u) * (jag >= 0 && u > jag ? 0.55 : 1) + 0.35, ridge = (u) => -w * 0.12 * (1 - u);
  const pad = hw + 2;
  p.shade(Math.min(bx, tx) - pad, Math.min(by, ty) - pad, Math.max(bx, tx) + pad, Math.max(by, ty), (x, y, o) => {
    const rx = x - bx, ry = y - by, u = (rx * ux + ry * uy) / L, s = rx * nx + ry * ny;
    if (u < 0) return;
    const l = left(Math.min(u, 1)), r = right(Math.min(u, 1));
    if (u > 1 || s < -l || s > r) {
      // a dark rim just outside the blade
      const over = u > 1 ? (u - 1) * L : 0, out = Math.max(over, s < -l ? -l - s : s - r);
      if (out < 1 && u < 1 + 1 / L) {
        o.c = K(0);
        o.a = a;
      }
      return;
    }
    o.a = a;
    if (opts.white) return (o.c = WHITE);
    const rd = ridge(u);
    let c;
    if (u > 0.88) c = WHITE;
    else if (Math.abs(s - rd) < 0.55) c = K(6);
    else if (s < rd) c = s + l < 1 ? K(6) : (s + l) / Math.max(1, rd + l) > 0.55 ? K(5) : K(4);
    else c = r - s < 1.1 ? K(1) : (s - rd) / Math.max(1, r - rd) > 0.5 ? K(2) : K(3);
    // the notch's ledge catches light; a little glitter in the lit facet
    if (jag >= 0 && Math.abs(u - jag) * L < 0.8 && s > rd) c = K(6);
    else if (s < rd && c !== K(6) && ((Math.floor(x) * 73856093) ^ (Math.floor(y) * 19349663)) % 997 < 30) c = K(7);
    if (glint >= 0 && s <= rd + 0.6) {
      const g = Math.abs(u - glint) * L;
      if (g < 0.8) c = WHITE;
      else if (g < 1.8) c = K(6);
    }
    o.c = c;
  });
}

/**
 * A snowflake design, seeded: pairs of side branches along each arm ([where 0..1, length 0..1 of the arm]),
 * maybe a hexagonal plate round the heart, maybe forked tips.
 */
export function flakeDesign(R) {
  const n = R.int(1, 3), branches = [];
  for (let i = 0; i < n; i++) branches.push([0.38 + (0.4 * (i + R.range(0.2, 0.8))) / n, R.range(0.24, 0.36) * (1 - i * 0.15)]);
  return { branches, plate: R.chance(0.45), fork: R.chance(0.45) };
}

/**
 * A six-armed snowflake of radius r turned by rot, crisp 1 px lines: pale arms, side branches at 60 degrees,
 * a plate or forked tips by design, a white heart, light. hot (0..1) makes it twinkle white.
 */
export function snowflake(p, x, y, r, rot, d, C, opts = {}) {
  const n = C.length, a = opts.a ?? 1, hot = opts.hot ?? 0;
  rot = Math.round(rot / (Math.PI / 18)) * (Math.PI / 18); // turn in 10 degree ticks, like sprite frames
  if (r < 1.2) {
    p.dot(x, y, WHITE, a);
    return;
  }
  if (r < 2.6) {
    // too small for branches: a six-point star that flips between two poses as it turns
    const pose = Math.floor(((rot % (Math.PI / 3)) + Math.PI / 3) / (Math.PI / 6)) % 2;
    const pts = pose ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 1], [-1, -1], [1, -1], [-1, 1]];
    for (const [dx, dy] of pts) p.dot(x + dx, y + dy, hot > 0.5 ? WHITE : C[n - 3], a);
    p.dot(x, y, WHITE, a);
    p.glow(x, y, 4, C[n - 3], 0.2 * a);
    return;
  }
  // detail by size: a bare star when small, one pair of branches when middling, the full design when big
  const arm = hot > 0.5 ? WHITE : C[n - 2], br = hot > 0.5 ? C[n - 2] : C[n - 3], big = r >= 7;
  const branches = r < 4 ? [] : big ? d.branches.slice(0, 2) : [[0.58, 0.36]];
  for (let k = 0; k < 6; k++) {
    const g = rot + (k * TAU) / 6, ca = Math.cos(g), sa = Math.sin(g);
    p.line(x, y, x + ca * r, y + sa * r, arm, a);
    for (const [u, l] of branches) {
      const bx = x + ca * r * u, by = y + sa * r * u, bl = Math.max(1, r * l);
      for (const s of [-1, 1]) p.line(bx, by, bx + Math.cos(g + (s * Math.PI) / 3) * bl, by + Math.sin(g + (s * Math.PI) / 3) * bl, br, a);
    }
    if (d.fork && big && !d.plate)
      for (const s of [-1, 1]) p.dot(x + ca * r + Math.cos(g + s * 0.9) * 1.2, y + sa * r + Math.sin(g + s * 0.9) * 1.2, br, a);
    p.dot(x + ca * r, y + sa * r, WHITE, a);
  }
  if (d.plate && big) {
    const q = r * 0.34;
    for (let k = 0; k < 6; k++) {
      const g0 = rot + Math.PI / 6 + (k * TAU) / 6, g1 = g0 + TAU / 6;
      p.line(x + Math.cos(g0) * q, y + Math.sin(g0) * q, x + Math.cos(g1) * q, y + Math.sin(g1) * q, C[n - 3], a);
    }
  }
  p.px(x, y, WHITE);
  p.glow(x, y, 3 + r * 1.2, C[n - 4], (0.14 + 0.35 * hot) * a);
  if (hot > 0.3) p.glow(x, y, 2 + r * 0.5, WHITE, 0.3 * hot * a);
}

/** Nothing outlives the effect: trims the life of every particle, bit and pane that would last past D. */
export function endBy(t, D, ...systems) {
  const left = Math.max(0.001, D - 0.05 - t);
  for (const sys of systems) for (const q of sys.list) if (q.life > left) q.life = left;
}

/**
 * Cracks racing out from (x, y) through a shape: n jagged lines that wander, fork now and then and stop at
 * the shape's edge (inside(x, y) says what's in it). Each point carries its distance from the start along the
 * crack, so drawFractures can grow them at a speed. Returns polylines [[x, y, d], ...].
 */
export function fractures(R, inside, x, y, n, opts = {}) {
  const out = [], step = opts.step ?? [1.6, 2.6], len = opts.len ?? 18, fork = opts.fork ?? 0.16, a0 = opts.a0 ?? R.range(0, TAU), spread = opts.spread ?? TAU;
  const walk = (x, y, d, a, len, depth) => {
    const pts = [[x, y, d]];
    for (let s = 0; s < len; s++) {
      a += R.range(-0.55, 0.55);
      const st = R.range(step[0], step[1]), nx = x + Math.cos(a) * st, ny = y + Math.sin(a) * st;
      if (!inside(nx, ny)) break;
      (x = nx), (y = ny), (d += st);
      pts.push([x, y, d]);
      if (depth < 2 && pts.length > 2 && R.chance(fork)) walk(x, y, d, a + R.sign() * R.range(0.6, 1.2), Math.ceil(len * 0.5), depth + 1);
    }
    if (pts.length > 1) out.push(pts);
  };
  for (let i = 0; i < n; i++) walk(x, y, 0, a0 + (i / n) * spread + R.range(-0.3, 0.3) * Math.min(1, spread / TAU), len, 0);
  return out;
}

/**
 * Draw cracks grown out to distance `reach` from their start: a bright line over a dark one a pixel lower (an
 * engraved fracture), a white-hot tip while they run, light leaking out along them. ox, oy shift them.
 */
export function drawFractures(p, cracks, reach, C, opts = {}) {
  const n = C.length, ox = opts.ox ?? 0, oy = opts.oy ?? 0, hot = opts.hot ?? true, a = opts.a ?? 1;
  const seg = (pts, i) => {
    const [x0, y0, d0] = pts[i - 1], [x1, y1, d1] = pts[i];
    if (d0 >= reach) return null;
    const u = Math.min(1, (reach - d0) / Math.max(0.01, d1 - d0));
    return [x0 + ox, y0 + oy, x0 + ox + (x1 - x0) * u, y0 + oy + (y1 - y0) * u, reach - d1 < 3];
  };
  for (const pts of cracks)
    for (let i = 1; i < pts.length; i++) {
      const s = seg(pts, i);
      if (!s) break;
      p.line(s[0], s[1] + 1, s[2], s[3] + 1, C[Math.min(2, n - 1)], a);
    }
  for (const pts of cracks)
    for (let i = 1; i < pts.length; i++) {
      const s = seg(pts, i);
      if (!s) break;
      const tip = hot && s[4];
      p.line(s[0], s[1], s[2], s[3], tip ? WHITE : C[n - 2], a);
      if (tip) p.glow(s[2], s[3], 5, C[n - 3], 0.5 * a);
      else if (i % 2) p.glow(s[2], s[3], 3, C[n - 3], 0.18 * a);
    }
}

// ================================================================================================
// 3D: faceted ice cones, panes that tumble in space, frost on the floor. They draw through a Space (q).
// ================================================================================================

const LIGHT = [-0.45, -0.6, 0.66]; // toward the light in view space (right, down, towards the viewer): top left, in front
const LL = Math.hypot(...LIGHT), LV = LIGHT.map((v) => v / LL);
const HALF = (() => {
  const h = [LV[0], LV[1], LV[2] + 1], l = Math.hypot(...h);
  return h.map((v) => v / l);
})();
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
// Rodrigues: v turned by th about the unit axis k
const turn3 = (v, k, th) => {
  const c = Math.cos(th), s = Math.sin(th), d = dot3(k, v) * (1 - c), x = cross3(k, v);
  return [v[0] * c + x[0] * s + k[0] * d, v[1] * c + x[1] * s + k[1] * d, v[2] * c + x[2] * s + k[2] * d];
};
// a plane's own axes for a normal, the same as the Space's (floor: u is x and v is z)
const planeAxes = (n) => {
  const N = norm3(n), e1 = Math.abs(N[1]) > 0.9 ? norm3(cross3(cross3(N, [1, 0, 0]), N)) : norm3(cross3(N, [0, -1, 0]));
  return [e1, cross3(N, e1)];
};

/**
 * A faceted ice cone with a depth for every pixel, seen from any side: a pyramid when `sides` is small, from
 * radius r0 at b (the base) to r1 at t (the tip; 0 for a point). Each facet is lit from the top left and in
 * front, so the facets that turn to the light change as the camera goes round; edges between facets catch light,
 * the rim is dark, the point is white. Round shafts are cones with r0 = r1.
 * opts: { sides (5), phase (turn of the facets about the axis), a (alpha), dim (steps darker), white (flash it
 * white), glint (0..1 along it: a highlight band, or -1), cap (draw the flat ends, true) }.
 */
export function cone3(q, b, t, r0, r1, C, opts = {}) {
  const dx = t[0] - b[0], dy = t[1] - b[1], dz = t[2] - b[2], L = Math.hypot(dx, dy, dz);
  if (L < 0.5 || Math.max(r0, r1) < 0.2) return;
  if (!q.project(b[0], b[1], b[2])) return;
  const ax = q.x, ay = q.y, ad = q.d, k = q.k;
  if (!q.project(t[0], t[1], t[2])) return;
  const bx = q.x, by = q.y;
  const n = C.length, al = opts.a ?? 1, dim = opts.dim ?? 0, N = opts.sides ?? 5, ph = opts.phase ?? 0.4, glint = opts.glint ?? -1, caps = opts.cap ?? true, white = !!opts.white;
  const K = (i) => C[clamp(i - dim, 0, n - 1)];
  const aw = [dx / L, dy / L, dz / L], A = q.view(...aw);
  // the facets' reference axes: perpendicular to the axis, one from world up
  const ref = Math.abs(aw[1]) < 0.9 ? [0, -1, 0] : [1, 0, 0], d0 = dot3(ref, aw), e0w = norm3([ref[0] - aw[0] * d0, ref[1] - aw[1] * d0, ref[2] - aw[2] * d0]), e1w = cross3(aw, e0w);
  const E0 = q.view(...e0w), E1 = q.view(...e1w);
  const c = (r0 - r1) / L, sl = Math.sqrt(1 + c * c), Az = A[2], a2 = 1 - Az * Az * (1 + c * c), step = TAU / N;
  const pad = Math.max(r0, r1) * k + 2, p = q.p, z0 = p.z;
  p.each(Math.min(ax, bx) - pad, Math.min(ay, by) - pad, Math.max(ax, bx) + pad, Math.max(ay, by) + pad, (lx, ly, sx, sy) => {
    const X = (lx - ax) / k, Y = (ly - ay) / k, s0 = X * A[0] + Y * A[1], m = r0 - c * s0, b2 = 2 * Az * (m * c - s0), c2 = X * X + Y * Y - s0 * s0 - m * m;
    let z = -Infinity, hit = 0; // 1 the side, 2 the base, 3 the tip's flat end
    const onSide = (zz) => {
      const s = s0 + zz * Az;
      return s >= 0 && s <= L && r0 - c * s >= 0;
    };
    if (Math.abs(a2) < 1e-6) {
      if (Math.abs(b2) > 1e-9 && onSide(-c2 / b2)) (z = -c2 / b2), (hit = 1);
    } else {
      const dsc = b2 * b2 - 4 * a2 * c2;
      if (dsc >= 0) {
        const sq = Math.sqrt(dsc), z1 = (-b2 + sq) / (2 * a2), z2 = (-b2 - sq) / (2 * a2);
        const hi = Math.max(z1, z2), lo = Math.min(z1, z2);
        if (onSide(hi)) (z = hi), (hit = 1);
        else if (onSide(lo)) (z = lo), (hit = 1);
      }
    }
    if (caps && Az < -1e-3 && r0 > 0.3) {
      const zc = -s0 / Az;
      if (zc > z && X * X + Y * Y + zc * zc <= r0 * r0 + 1e-6) (z = zc), (hit = 2);
    }
    if (caps && Az > 1e-3 && r1 > 0.3) {
      const zc = (L - s0) / Az;
      if (zc > z && X * X + Y * Y + zc * zc - L * L <= r1 * r1 + 1e-6) (z = zc), (hit = 3);
    }
    if (!hit) return;
    p.z = ad - z;
    if (white) return p.put(sx, sy, WHITE, al);
    if (hit > 1) {
      // a flat end: lit by how it faces the light, a pale rim, a dark outer edge
      const rr = hit === 2 ? Math.hypot(X, Y, z) / r0 : Math.sqrt(Math.max(0, X * X + Y * Y + z * z - L * L)) / r1, lam = (hit === 2 ? -1 : 1) * (A[0] * LV[0] + A[1] * LV[1] + A[2] * LV[2]);
      const base = 1 + Math.round(clamp((lam + 0.3) / 1.2) * 4);
      return p.put(sx, sy, rr > 0.93 ? K(0) : rr > 0.74 ? K(Math.min(n - 1, base + 2)) : K(base), al);
    }
    const s = s0 + z * Az, u = s / L, px = X - s * A[0], py = Y - s * A[1], pz = z - s * Az, pl = Math.hypot(px, py, pz) || 1, rad = [px / pl, py / pl, pz / pl];
    // which facet, how close to its edge, and how it faces the light
    const f = (Math.atan2(dot3(rad, E1), dot3(rad, E0)) - ph) / step, j = Math.round(f), g = Math.abs(f - j), th = ph + j * step, ct = Math.cos(th), st = Math.sin(th);
    const lam = ((ct * E0[0] + st * E1[0] + A[0] * c) * LV[0] + (ct * E0[1] + st * E1[1] + A[1] * c) * LV[1] + (ct * E0[2] + st * E1[2] + A[2] * c) * LV[2]) / sl;
    const r = Math.max(0.5, r0 - c * s), edge = (0.5 - g) * step * r * k < 0.6, facing = (rad[2] + Az * c) / sl;
    let col;
    if (facing < 0.14 && u < 0.97) col = K(0);
    else if (u > 0.9 && r1 < 0.3) col = WHITE;
    else {
      const base = 1 + Math.round(clamp((lam + 0.3) / 1.2) * 5);
      col = edge ? K(Math.min(n - 1, Math.max(base, 3) + 2)) : K(base);
      if (glint >= 0 && lam > -0.1 && Math.abs(u - glint) * L * k < 0.9) col = WHITE;
    }
    p.put(sx, sy, col, al);
  });
  p.z = z0;
}

/**
 * Panes of ice in 3D: flat polygons that fly, tumble about any axis, bounce on the floor, skid, settle flat and
 * fade, as Panes does in 2D, but each a real polygon in space.
 * add({ pts (corners around 0, 0 in the pane's own plane, y down), x, y, z, vx, vy, vz, az (the way its face
 * points at first, radians about the vertical), a (turn in its plane), va, f (tumble about its own x), vf, lit,
 * g, drag, bounce, life, brittle, crumble, solid, tone, ridge });
 * update(dt); draw(q, C). onLand(pane, x, y, z, speed), onCrumble(pane), onSkid(pane, x, y, z). ground(x, z) is the floor.
 */
export class Panes3 {
  constructor(opts = {}) {
    this.list = [];
    this.ground = opts.ground ?? (() => Infinity);
    this.onLand = opts.onLand ?? null;
    this.onCrumble = opts.onCrumble ?? null;
    this.onSkid = opts.onSkid ?? null;
  }
  add(q) {
    const life = q.life ?? 1, az = q.az ?? 0, sa = Math.sin(az), ca = Math.cos(az);
    let U = [ca, 0, -sa], V = [0, 1, 0], N = [sa, 0, ca];
    if (q.a) (U = turn3(U, N, q.a)), (V = turn3(V, N, q.a));
    if (q.f) (V = turn3(V, U, q.f)), (N = turn3(N, U, q.f));
    const vf = q.vf ?? 0, va = q.va ?? 0, w = [U[0] * vf + N[0] * va, U[1] * vf + N[1] * va, U[2] * vf + N[2] * va];
    this.list.push({ vx: 0, vy: 0, vz: 0, z: 0, lit: 0.6, g: 1, drag: 0.3, bounce: 0.35, rest: false, brittle: false, ...q, U, V, N, w, life, max: life });
  }
  get count() {
    return this.list.length;
  }
  /** The pane's corners in the world. */
  corners(q) {
    return q.pts.map(([x, y]) => [q.x + q.U[0] * x + q.V[0] * y, q.y + q.U[1] * x + q.V[1] * y, q.z + q.U[2] * x + q.V[2] * y]);
  }
  seat(q) {
    let low = -Infinity;
    for (const [x, y] of q.pts) low = Math.max(low, q.U[1] * x + q.V[1] * y);
    return q.y + low;
  }
  turn(q, axis, ang) {
    q.U = turn3(q.U, axis, ang);
    q.V = turn3(q.V, axis, ang);
    q.N = norm3(cross3(q.U, q.V));
    q.U = norm3(cross3(q.V, q.N));
    q.V = cross3(q.N, q.U);
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const q = this.list[i];
      if ((q.life -= dt) <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      const floor = this.ground(q.x, q.z) - 0.5;
      if (q.rest && q.crumble !== undefined && (q.restT = (q.restT ?? 0) + dt) > q.crumble) {
        this.onCrumble?.(q);
        this.list.splice(i, 1);
        continue;
      }
      if (q.rest) {
        // skidding: friction slows the slide, the pane lies down flat and stays seated on the floor
        if (Math.hypot(q.vx, q.vz) > 8) this.onSkid?.(q, q.x, floor + 0.5, q.z);
        q.x += q.vx * dt;
        q.z += q.vz * dt;
        q.vx -= q.vx * 7 * dt;
        q.vz -= q.vz * 7 * dt;
        const up = q.N[1] < 0 ? [0, -1, 0] : [0, 1, 0], ax = cross3(q.N, up), sn = Math.hypot(...ax);
        if (sn > 1e-4) this.turn(q, [ax[0] / sn, ax[1] / sn, ax[2] / sn], Math.atan2(sn, dot3(q.N, up)) * Math.min(1, 14 * dt));
        if (q.va) {
          this.turn(q, q.N, q.va * dt);
          q.va -= q.va * 9 * dt;
        }
        q.y -= this.seat(q) - floor;
        continue;
      }
      q.vy += GRAVITY * q.g * dt;
      q.vx -= q.vx * q.drag * dt;
      q.vy -= q.vy * q.drag * dt;
      q.vz -= q.vz * q.drag * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      const wl = Math.hypot(...q.w);
      if (wl > 1e-6) this.turn(q, [q.w[0] / wl, q.w[1] / wl, q.w[2] / wl], wl * dt);
      const low = this.seat(q);
      if (q.g <= 0 || low < floor || q.vy <= 0) continue;
      q.y -= low - floor;
      if (q.vy > 70) (q.hits = (q.hits ?? 0) + 1), this.onLand?.(q, q.x, floor + 0.5, q.z, q.vy);
      if (q.brittle && q.vy > 70 && q.hits >= q.brittle) {
        this.list.splice(i, 1);
        continue;
      }
      if (q.vy > 70 && q.bounce > 0) {
        q.vy = -q.vy * q.bounce;
        q.vx *= 0.75;
        q.vz *= 0.75;
        q.w = q.w.map((v) => v * 0.55);
      } else {
        q.rest = true;
        q.vy = 0;
        q.va = dot3(q.w, q.N) * 0.6;
      }
    }
  }
  draw(sp, C) {
    const n = C.length, V0 = sp.view(1, 0, 0), V1 = sp.view(0, 1, 0), V2 = sp.view(0, 0, 1);
    // the light in the world, for panes cut along a ridge and for edges
    const Lw = [dot3(V0, LV), dot3(V1, LV), dot3(V2, LV)];
    for (const q of sp.sort(this.list, (e) => [e.x, e.y, e.z])) {
      const a = Math.min(1, q.life / 0.35), Nv = sp.view(...q.N), face = Math.abs(Nv[2]), flash = Math.abs(dot3(Nv, HALF)) > 0.955 && !q.rest;
      const lv = q.lit * (0.35 + 0.65 * face), cs = this.corners(q);
      let R = 0;
      for (const [x, y] of q.pts) R = Math.max(R, Math.hypot(x, y));
      const l2x = dot3(Lw, q.U), l2y = dot3(Lw, q.V); // the light in the pane's own axes
      const [e1, e2] = planeAxes(q.N), m = [dot3(e1, q.U), dot3(e2, q.U), dot3(e1, q.V), dot3(e2, q.V)];
      let ridge = null;
      if (q.solid && q.tone === undefined) {
        const rr = q.ridge ?? -Math.PI / 2;
        let nx = -Math.sin(rr), ny = Math.cos(rr);
        if (nx * l2x + ny * l2y < 0) (nx = -nx), (ny = -ny);
        ridge = [nx, ny];
      }
      const lit = flash ? C[n - 1] : C[clamp(Math.round(3 + lv * 3), 3, n - 2)], deep = C[clamp(Math.round(1 + lv * 2), 1, 3)];
      const tone = q.solid && q.tone !== undefined ? (flash ? C[n - 1] : C[clamp(Math.round(1 + q.tone * 5 * (0.6 + 0.4 * face)), 1, n - 2)]) : 0;
      if (face > 0.08)
        sp.plane(q.x, q.y, q.z, q.N, R + 1, (u, v, out) => {
          const x = u * m[0] + v * m[1], y = u * m[2] + v * m[3];
          if (!inPoly(q.pts, x, y)) return;
          if (tone) {
            out.c = tone;
            out.a = a;
          } else if (ridge) {
            const d = x * ridge[0] + y * ridge[1];
            out.c = flash ? C[n - 1] : d > 0.6 ? lit : d > -0.6 ? C[n - 2] : deep;
            out.a = a;
          } else {
            out.c = lit;
            out.a = (0.3 + 0.35 * lv + (flash ? 0.3 : 0)) * a;
            out.blend = true;
          }
        });
      // edges, a hair out towards the viewer so they sit on the face; lit where they face up and left
      const sg = Nv[2] >= 0 ? 0.35 : -0.35, off = [q.N[0] * sg, q.N[1] * sg, q.N[2] * sg];
      let cx = 0, cy = 0, top = 0;
      for (const [x, y] of q.pts) (cx += x), (cy += y);
      cx /= q.pts.length;
      cy /= q.pts.length;
      for (let i = 0; i < cs.length; i++) {
        const [x0, y0] = q.pts[i], [x1, y1] = q.pts[(i + 1) % q.pts.length], j = (i + 1) % cs.length;
        let nx = y1 - y0, ny = x0 - x1;
        if (nx * ((x0 + x1) / 2 - cx) + ny * ((y0 + y1) / 2 - cy) < 0) (nx = -nx), (ny = -ny);
        const l = Math.hypot(nx, ny) || 1, le = (nx * l2x + ny * l2y) / l;
        const col = face < 0.25 || le > 0.35 ? C[n - 1] : le > -0.25 ? C[n - 2] : q.solid ? C[1] : C[Math.max(2, n - 4)];
        sp.line(cs[i][0] + off[0], cs[i][1] + off[1], cs[i][2] + off[2], cs[j][0] + off[0], cs[j][1] + off[1], cs[j][2] + off[2], col, a);
        if (cs[i][1] < cs[top][1]) top = i;
      }
      if (face > 0.7) sp.dot(cs[top][0] + off[0], cs[top][1] + off[1], cs[top][2] + off[2], WHITE, a);
      sp.glow(q.x, q.y, q.z, 5, C[n - 3], (flash ? 0.5 : 0.14) * a);
    }
  }
}

/**
 * Frost laid on the floor: a crust of white and pale specks fading out to a ragged edge, a cold bloom under it.
 * Centered on (cx, cz), half-widths rx, rz (an ellipse or a strip). `a` (0..1) is how far it has grown and how
 * strong it is: the ragged edge sits at a * 1.15 of the radius. `edge` (0..1) whitens the front while it is still
 * spreading, `dens` (1) thins the speckle for big patches. seed varies the speckle. Draw it before what stands on it.
 */
export function frostFloor(q, C, cx, cz, rx, rz, a, edge = 0, seed = 0, dens = 1) {
  const n = C.length, R = Math.max(rx, rz) + 2;
  if (a <= 0) return;
  q.plane(cx, 0, cz, null, R, (u, v, o) => {
    const dx = u / rx, dz = v / rz, d0 = Math.hypot(dx, dz);
    if (d0 > 1.2) return;
    const iu = Math.floor((u + cx) / 1.6), iv = Math.floor((v + cz) / 1.6), h = rand(iu, iv, seed + 17), d = d0 + (rand(iu, iv, seed + 5) - 0.5) * 0.18, k = clamp((a * 1.15 - d) / 0.5);
    if (k <= 0) return;
    const rim = edge > 0 && d > a * 1.15 - 0.07 * edge && d < a * 1.15;
    o.l = C[n - 4];
    o.k = 0.1 * k;
    if (h > (0.25 + 0.8 * k) * dens && !rim) return;
    o.c = rim || h < 0.16 ? WHITE : h < 0.5 ? C[n - 2] : C[n - 3];
    o.a = h < 0.5 ? 0.95 : 0.7;
  });
}

/**
 * Cracks in 3D, grown out to distance `reach` as drawFractures does in 2D, laid on a surface: map(x, y) turns a
 * crack point of the 2D drawing into a world point [x, y, z] on that surface (a hair out from it).
 * opts: { hot (white-hot tips, true), a (alpha) }.
 */
export function drawFractures3(q, cracks, reach, C, map, opts = {}) {
  const n = C.length, hot = opts.hot ?? true, a = opts.a ?? 1;
  const seg = (pts, i) => {
    const [x0, y0, d0] = pts[i - 1], [x1, y1, d1] = pts[i];
    if (d0 >= reach) return null;
    const u = Math.min(1, (reach - d0) / Math.max(0.01, d1 - d0));
    return [map(x0, y0), map(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u), reach - d1 < 3];
  };
  for (const pts of cracks)
    for (let i = 1; i < pts.length; i++) {
      const s = seg(pts, i);
      if (!s) break;
      const tip = hot && s[2];
      q.line(...s[0], ...s[1], tip ? WHITE : C[n - 2], a);
      if (tip) q.glow(...s[1], 5, C[n - 3], 0.5 * a);
      else if (i % 2) q.glow(...s[1], 3, C[n - 3], 0.18 * a);
    }
}

/**
 * A polygon laid in 3D as a shaded face: pts [[a, b], ...] in the face's own axes around its center c, tu and tv
 * (unit vectors in the world, at right angles: the face's a and b directions), painted by fn(a, b, out) as a
 * pixel shader (return a color or set out.c, out.a, out.blend, out.l, out.k). Faces are opaque unless out.blend.
 */
export function face3(q, c, tu, tv, pts, fn) {
  const N = norm3(cross3(tu, tv)), [e1, e2] = planeAxes(N), m = [dot3(e1, tu), dot3(e2, tu), dot3(e1, tv), dot3(e2, tv)];
  let R = 0;
  for (const [x, y] of pts) R = Math.max(R, Math.hypot(x, y));
  q.plane(c[0], c[1], c[2], N, R + 1, (u, v, out) => {
    const a = u * m[0] + v * m[1], b = u * m[2] + v * m[3];
    if (inPoly(pts, a, b)) return fn(a, b, out);
  });
}
