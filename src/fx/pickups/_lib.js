// Helpers for the pickups: a scratch layer to build outlined sprites in, floor shadows, twinkles and bobs.
// Not an effect (the file name starts with _).

import { createFrame, Painter, TAU, WHITE, hex, ramp, scale, rand } from "../../core/index.js";

/**
 * The palette as at least n color steps, dark to bright, so effects can index C[0]..C[n-1] whatever ramp a
 * caller passes: a 7-step ramp repeats its brightest step, a short one is stretched step by step (no blending).
 */
export function fit(palette, n = 8) {
  const r = ramp(palette);
  if (!r.length) return Array(n).fill(WHITE);
  if (r.length >= n - 1) {
    while (r.length < n) r.push(r[r.length - 1]);
    return r;
  }
  return Array.from({ length: n }, (_, i) => r[Math.round((i * (r.length - 1)) / (n - 1))]);
}

/**
 * A scratch layer: draw a sprite into it with its own painter (same local coordinates as the effect), give
 * it a dark outline, recolor it, then stamp it onto the frame. Lets a procedural shape get a hand-made
 * 1 px outline and lets shines sweep across exactly the sprite's pixels.
 */
export class Layer {
  constructor(w = 64, h = 64) {
    this.f = createFrame(w, h);
    this.q = new Painter(this.f);
    this.tmp = new Uint32Array(w * h);
  }
  /** Clear it and put its top-left at local (x0, y0). Returns the layer's painter. */
  begin(x0, y0) {
    const f = this.f;
    f.ox = Math.floor(x0);
    f.oy = Math.floor(y0);
    f.color.fill(0);
    f.light.fill(0);
    return this.q.reset().place(0, 0);
  }
  idx(x, y) {
    const f = this.f, i = Math.floor(x) - f.ox, j = Math.floor(y) - f.oy;
    return i < 0 || j < 0 || i >= f.w || j >= f.h ? -1 : j * f.w + i;
  }
  get(x, y) {
    const i = this.idx(x, y);
    return i < 0 ? 0 : this.f.color[i];
  }
  set(x, y, c) {
    const i = this.idx(x, y);
    if (i >= 0) this.f.color[i] = c;
  }
  /** Fill each pixel from fn(x, y) at the pixel's center (x + 0.5, y + 0.5): return a color or 0. */
  fill(x0, y0, x1, y1, fn) {
    for (let y = Math.floor(y0); y <= y1; y++)
      for (let x = Math.floor(x0); x <= x1; x++) {
        const c = fn(x + 0.5, y + 0.5);
        if (c) this.set(x, y, c);
      }
  }
  /** A 1 px outline around everything drawn: c is a color or fn(x, y, neighbour color). corners adds diagonals. */
  outline(c, corners = false) {
    const f = this.f, C = f.color, T = this.tmp, w = f.w, h = f.h;
    T.fill(0);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (C[k]) continue;
        let n = (i > 0 && C[k - 1]) || (i < w - 1 && C[k + 1]) || (j > 0 && C[k - w]) || (j < h - 1 && C[k + w]);
        if (!n && corners) n = (i > 0 && j > 0 && C[k - w - 1]) || (i < w - 1 && j > 0 && C[k - w + 1]) || (i > 0 && j < h - 1 && C[k + w - 1]) || (i < w - 1 && j < h - 1 && C[k + w + 1]);
        if (n) T[k] = typeof c === "function" ? c(i + f.ox, j + f.oy, n) : c;
      }
    for (let k = 0; k < w * h; k++) if (T[k]) C[k] = T[k];
    return this;
  }
  /** Recolor every drawn pixel: fn(x, y, c) returns the new color. */
  map(fn) {
    const f = this.f, C = f.color;
    for (let k = 0; k < C.length; k++) if (C[k]) C[k] = fn((k % f.w) + f.ox, Math.floor(k / f.w) + f.oy, C[k]) || C[k];
    return this;
  }
  /** Stamp the layer onto p, offset by (dx, dy), at alpha a (dithered); clip [x0, x1] keeps x0 <= x < x1. */
  draw(p, dx = 0, dy = 0, a = 1, clip = null) {
    const f = this.f, C = f.color;
    for (let k = 0; k < C.length; k++) {
      if (!C[k]) continue;
      const x = (k % f.w) + f.ox + dx;
      if (clip && (x < clip[0] || x >= clip[1])) continue;
      p.dot(x, Math.floor(k / f.w) + f.oy + dy, C[k], a);
    }
    return this;
  }
}

const SHADOW = hex("#100e17");
/**
 * A floor shadow centered on x, half-width rx: a solid dark band on the floor line (y = 0) and a narrower one
 * under it, with dithered ends. Shrink rx as the thing above rises.
 */
export function shadow(p, x, rx, k = 1) {
  if (rx < 1) return;
  for (let row = 0; row < 2; row++) {
    const w = rx - row * 2;
    for (let i = Math.floor(x - w); i < Math.ceil(x + w); i++) {
      const e = Math.abs(i + 0.5 - x) / w;
      if (e <= 1) p.dot(i, row, SHADOW, row ? k : k * (e < 0.8 ? 1 : 0.5));
    }
  }
}

/** A four-point twinkle of arm length s (whole pixels): white core, bright inner arms, colored tips. */
export function twinkle(p, x, y, s, c, mid = c, core = WHITE) {
  s = Math.round(s);
  if (s <= 0) return;
  for (let d = 1; d <= s - 1; d++) {
    const k = d < s / 2 ? mid : c;
    p.px(x + d, y, k), p.px(x - d, y, k), p.px(x, y + d, k), p.px(x, y - d, k);
  }
  if (s >= 4) p.px(x + 1, y + 1, c), p.px(x - 1, y - 1, c), p.px(x + 1, y - 1, c), p.px(x - 1, y + 1, c);
  p.px(x, y, core);
}

/** A seamless bob: up-and-down offset in px for loop phase ph (0..1), n bobs a loop. */
export const bob = (ph, amp, n = 1, off = 0) => -amp * Math.sin((ph * n + off) * TAU);

/**
 * Fill a puffy shape into layer L from a signed distance sdf(x, y) in px (negative inside). The surface is
 * flat in the middle and rounds over in a bevel px wide at the edge; color(b, e, x, y) gets the light b
 * (about -0.3 facing away .. 1 facing the light, 0.62 flat) and the depth e in px from the edge. clip(x, y)
 * returning true cuts a pixel away without shading the cut (a break, a bite).
 */
export function pillow(L, x0, y0, x1, y1, sdf, color, { bevel = 3, light = [-0.5, -0.6, 0.62], clip = null } = {}) {
  L.fill(x0, y0, x1, y1, (x, y) => {
    const d = sdf(x, y);
    if (d > 0 || (clip && clip(x, y))) return 0;
    const e = -d;
    let gx = sdf(x + 0.5, y) - sdf(x - 0.5, y), gy = sdf(x, y + 0.5) - sdf(x, y - 0.5);
    const gl = Math.hypot(gx, gy) || 1;
    gx /= gl;
    gy /= gl;
    const k = Math.max(0, 1 - e / bevel) * 1.25, sn = Math.sin(k), cs = Math.cos(k);
    return color(gx * sn * light[0] + gy * sn * light[1] + cs * light[2], e, x, y);
  });
}

/** Signed distance (px, roughly) to a heart of half-width w centered at (cx, cy): the classic sextic curve. */
export function heartSdf(x, y, cx, cy, w, h = w) {
  const S = w / 1.14, X = (x - cx) / S, Y = -(y - cy) / (h / 1.14) + 0.12;
  const q = X * X + Y * Y - 1, f = q * q * q - X * X * Y * Y * Y;
  const gx = 6 * X * q * q - 2 * X * Y * Y * Y, gy = 6 * Y * q * q - 3 * X * X * Y * Y;
  return (f / Math.max(Math.hypot(gx, gy), 0.6)) * S;
}

// ---- the rebuilt pickups (techniques from Sprite Fusion's open-source pickup and sparkle, MIT, Hugo Duprez)

const INK = hex("#0b0814");

/**
 * A soft floor shadow at x, half-width rx: dithered darkness on the floor line, fuller in the middle, with a
 * shorter second row under it. k (0..1) is its strength: lift the thing above and the shadow shrinks and thins.
 */
export function blobShadow(p, x, rx, k = 1, y = 0) {
  if (rx < 0.8 || k <= 0) return;
  for (let i = Math.floor(x - rx); i <= Math.ceil(x + rx); i++) {
    const u = Math.abs(i + 0.5 - x) / rx;
    if (u > 1) continue;
    const a = k * (1 - u * u);
    p.dot(i, y, INK, a * 1.1);
    if (u < 0.6) p.dot(i, y + 1, INK, a * 0.6);
  }
}

/** A four-point star glint: arms of arm px in c, dimmer tips, a white heart, its own light. */
export function glint(p, x, y, arm, c, k = 0.4, tip = scale(c, 0.8)) {
  const n = Math.round(arm), X = Math.floor(x), Y = Math.floor(y);
  if (n < 0) return;
  for (let d = 1; d <= n; d++) {
    const cc = d === n && n > 1 ? tip : c;
    p.px(X + d, Y, cc), p.px(X - d, Y, cc), p.px(X, Y + d, cc), p.px(X, Y - d, cc);
  }
  p.px(X, Y, n > 0 ? WHITE : c);
  p.glow(X + 0.5, Y + 0.5, 3 + n * 2.5, c, k);
}

/** Additive light in an ellipse (a pool of light on the floor): k at the center falling off to the rim. */
export function pool(p, x, y, rx, ry, c, k) {
  if (k <= 0.004 || rx < 1) return;
  p.shade(x - rx, y - ry, x + rx, y + ry, (px, py, out) => {
    const dx = (px - x) / rx, dy = (py - y) / ry, d = dx * dx + dy * dy;
    if (d >= 1) return;
    const f = 1 - Math.sqrt(d);
    out.l = c;
    out.k = f * f * k;
  });
}

/**
 * A coin of radius r tumbling: its face turns by `spin` about an axis at screen angle `ax`, showing its rim
 * as it goes edge-on. A lit rim round a face with a shine, built in layer L with a dark outline, lit from the
 * top left. C: an 8-step gold ramp. snap puts its center on a pixel corner (even sizes) so it holds its shape
 * while it moves; pass snap false and a pixel-center y for odd heights.
 */
export function coin(L, p, x, y, r, ax, spin, C, white = false, a = 1, snap = true) {
  const X = snap ? Math.round(x) : x, Y = snap ? Math.round(y) : y, cs = Math.cos(spin), sn = Math.sin(spin);
  const b = Math.max(0.5, r * Math.abs(cs)), th = 1.2 * sn * Math.sign(cs || 1), ca = Math.cos(ax), sa = Math.sin(ax);
  const face = Math.abs(cs), R = Math.ceil(r) + 2;
  L.begin(Math.floor(X) - R, Math.floor(Y) - R);
  L.fill(Math.floor(X) - R, Math.floor(Y) - R, Math.floor(X) + R, Math.floor(Y) + R, (px, py) => {
    const dx = px - X, dy = py - Y, u = dx * ca + dy * sa, w = -dx * sa + dy * ca;
    const ef = Math.hypot(u / r, w / b), er = Math.hypot(u / r, (w - th) / b);
    if (white && (ef <= 1 || er <= 1)) return WHITE;
    if (ef <= 1) {
      // in the face's own frame: the raised rim, a recessed ring inside it, a raised middle with a shine
      const lit = -(dx * 0.62 + dy * 0.78) / Math.max(1, Math.hypot(dx, dy)), dim = face < 0.45 ? 1 : 0;
      if (b < 1.1) return lit > 0 ? C[6] : C[4];
      if (ef > 0.72) return C[(lit > 0.3 ? 6 : lit > -0.35 ? 5 : 3) - dim];
      if (b > 2.2 && ef > 0.42) return C[(lit > 0.2 ? 4 : 5) - dim];
      if (face > 0.6 && lit > 0.5) return C[7];
      return C[5 - dim];
    }
    if (er <= 1) return Math.abs(w - th) < Math.abs(w) ? C[2] : C[3];
    return 0;
  });
  L.outline(C[1]).draw(p, 0, 0, a);
}

/**
 * A small cut gem of radius r turned to angle `ang` (radians, on screen): a crown with a table over a pointed
 * pavilion, its facets lit from the top left, a white glint on the table; G is a ramp dark to bright (6+
 * steps). Built in L with a dark outline.
 */
export function gemlet(L, p, x, y, r, ang, G, white = false, a = 1) {
  const X = Math.round(x), Y = Math.round(y), ca = Math.cos(ang), sa = Math.sin(ang), n = G.length, R = Math.ceil(r * 1.4) + 2;
  const ct = r * 0.75, tw = r * 0.5, pv = r * 1.3;
  L.begin(X - R, Y - R);
  L.fill(X - R, Y - R, X + R - 1, Y + R - 1, (px, py) => {
    const dx = px - X, dy = py - Y, u = dx * ca + dy * sa, w = -dx * sa + dy * ca;
    let facet;
    if (w < 0) {
      if (w < -ct || Math.abs(u) > r - ((-w) / ct) * (r - tw)) return 0;
      facet = w < -ct * 0.45 && Math.abs(u) < tw * 0.95 ? 0 : u < 0 ? 1 : 2;
    } else {
      if (w > pv || Math.abs(u) > r * (1 - w / pv)) return 0;
      facet = Math.abs(u) < 0.5 ? 4 : u < 0 ? 3 : 5;
    }
    if (white) return WHITE;
    // each facet's normal, turned with the gem; the light comes from the top left of the screen
    const N = [[0, -1], [-0.7, -0.7], [0.7, -0.7], [-0.6, 0.8], [0, 1], [0.6, 0.8]][facet];
    const nx = N[0] * ca - N[1] * sa, ny = N[0] * sa + N[1] * ca, l = -(nx * 0.62 + ny * 0.78);
    if (facet === 0 && l > 0.3 && u < 0) return WHITE;
    return l > 0.6 ? G[n - 1] : l > 0.2 ? G[n - 2] : l > -0.2 ? G[n - 3] : l > -0.6 ? G[n - 4] : G[n - 5];
  });
  L.outline(G[0]).draw(p, 0, 0, a);
}

/**
 * A cut gem as a convex solid: facet planes { n: [x, y, z] outward unit normal, d, kind }, y up, z towards
 * the viewer, the girdle on y = 0. brilliant() builds a round brilliant: a table, crown facets, a thin
 * girdle, pavilion facets down to a point; n facets round (8 by default).
 */
export function brilliant({ r = 7.5, crown = 3.6, table = 0.52, pavilion = 8, girdle = 0.8, n = 8 } = {}) {
  const planes = [{ n: [0, 1, 0], d: crown + girdle / 2, kind: 0 }];
  const cs = Math.atan2(crown, r * (1 - table)), ps = Math.atan2(pavilion, r);
  for (let i = 0; i < n * 2; i++) {
    const a = (i * Math.PI) / n, half = i % 2;
    const c = half ? Math.min(1.45, cs + 0.22) : cs, pv = half ? ps - 0.1 : ps;
    // crown: main facets, and steeper ones between them by the girdle
    planes.push({ n: [Math.sin(c) * Math.cos(a), Math.cos(c), Math.sin(c) * Math.sin(a)], d: r * Math.sin(c) * (half ? 1.012 : 1) + (girdle / 2) * Math.cos(c), kind: half ? 2 : 1 });
    // the girdle: a ring of thin upright faces
    planes.push({ n: [Math.cos(a), 0, Math.sin(a)], d: r * (half ? 1.0 : 1.0), kind: 3 });
    // pavilion: main facets to the point, shallower ones between them by the girdle
    planes.push({ n: [Math.sin(pv) * Math.cos(a), -Math.cos(pv), Math.sin(pv) * Math.sin(a)], d: r * Math.sin(pv) * (half ? 1.03 : 1) + (girdle / 2) * Math.cos(pv), kind: half ? 5 : 4 });
  }
  return { planes, r, top: crown + girdle / 2, bottom: pavilion + girdle / 2 };
}

/**
 * A crystal: an n-sided prism (apothem r, half-height half) with a pointed cap of height top and a shorter
 * point of height bottom, as facet planes for drawGem (kinds 6 prism, 7 cap, 8 point).
 */
export function prism({ r = 4.6, half = 5.5, top = 7.5, bottom = 6, n = 6 } = {}) {
  const planes = [], ct = Math.atan2(top, r), cb = Math.atan2(bottom, r);
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n;
    planes.push({ n: [Math.cos(a), 0, Math.sin(a)], d: r, kind: 6 });
    planes.push({ n: [Math.sin(ct) * Math.cos(a), Math.cos(ct), Math.sin(ct) * Math.sin(a)], d: Math.sin(ct) * r + Math.cos(ct) * half, kind: 7 });
    planes.push({ n: [Math.sin(cb) * Math.cos(a), -Math.cos(cb), Math.sin(cb) * Math.sin(a)], d: Math.sin(cb) * r + Math.cos(cb) * half, kind: 8 });
  }
  return { planes, r: r / Math.cos(Math.PI / n), top: half + top, bottom: half + bottom };
}

/**
 * Draw gem g turned by spin (radians about its upright axis), its center (the girdle) at (x, y), seen from a
 * little above (tilt), into layer L with a dark outline. Each pixel finds the facet it looks at; crown facets
 * catch the light from the top left, pavilion facets glow with the light bouncing up through the stone.
 * C: ramp dark to bright (8). Returns the brightest spot { x, y } for a glint.
 */
export function drawGem(L, p, g, x, y, spin, C, { tilt = 0.32, white = false, a = 1, edges = true, gain = 1 } = {}) {
  const cs = Math.cos(spin), sn = Math.sin(spin), ct = Math.cos(tilt), st = Math.sin(tilt);
  const P = g.planes.map((q) => ({ n: [q.n[0] * cs - q.n[2] * sn, q.n[1], q.n[0] * sn + q.n[2] * cs], d: q.d, kind: q.kind }));
  // light from the top left, a little in front; the eye looks down the tilted z axis
  const Lx = -0.55, Ly = 0.72, Lz = 0.42, D = [0, -st, -ct], V = [0, st, ct];
  const Hl = Math.hypot(Lx + V[0], Ly + V[1], Lz + V[2]), H = [(Lx + V[0]) / Hl, (Ly + V[1]) / Hl, (Lz + V[2]) / Hl];
  const X = Math.round(x), Y = Math.round(y), R = Math.ceil(g.r) + 2, top = Math.ceil(g.top + 2), bot = Math.ceil(g.bottom + 2);
  let best = -1, bx = X, by = Y;
  const ids = new Map();
  L.begin(X - R, Y - top);
  L.fill(X - R, Y - top, X + R, Y + bot, (px, py) => {
    const sx = px - X, sy = -(py - Y);
    // the ray through this pixel: origin on the screen plane, straight down the view axis
    const o = [sx, sy * ct, -sy * st];
    let t0 = -1e9, t1 = 1e9, hit = null;
    for (const q of P) {
      const nd = q.n[0] * D[0] + q.n[1] * D[1] + q.n[2] * D[2], no = q.n[0] * o[0] + q.n[1] * o[1] + q.n[2] * o[2];
      if (Math.abs(nd) < 1e-6) {
        if (no > q.d) return 0;
        continue;
      }
      const tt = (q.d - no) / nd;
      if (nd < 0) {
        if (tt > t0) (t0 = tt), (hit = q);
      } else if (tt < t1) t1 = tt;
    }
    if (!hit || t0 > t1) return 0;
    if (white) return WHITE;
    ids.set((Math.floor(px) + 500) * 1000 + Math.floor(py) + 500, P.indexOf(hit));
    const n = hit.n, pav = hit.kind === 4 || hit.kind === 5 || hit.kind === 8;
    // the pavilion shows light that came in through the crown and bounced back: mirror its normal
    const m = pav ? [n[0], -n[1] * 0.6, n[2]] : n, ml = Math.hypot(m[0], m[1], m[2]);
    const lam = Math.max(0, (m[0] * Lx + m[1] * Ly + m[2] * Lz) / ml), spec = Math.pow(Math.max(0, (m[0] * H[0] + m[1] * H[1] + m[2] * H[2]) / ml), 18);
    let b = pav ? 0.02 + 0.72 * Math.pow(lam, 2.4) : hit.kind === 3 ? 0.12 + 0.4 * lam : 0.04 + 0.66 * Math.pow(lam, 1.8);
    // a crystal's upright faces are lit by the light's level direction; its cap catches it from above
    if (hit.kind === 6) b = 0.16 + 0.66 * Math.pow(Math.max(0, (n[0] * Lx + n[2] * Lz) / Math.hypot(Lx, Lz)), 1.3);
    else if (hit.kind === 7) b = 0.22 + 0.62 * Math.pow(lam, 1.2);
    // a fracture shows the lit inside of the stone, rough and grainy; chips are small rough facets
    else if (hit.kind === 9) b = 0.62 + 0.25 * lam;
    else if (hit.kind === 10) b = 0.3 + 0.5 * lam + (rand(Math.floor(px - X), Math.floor(py - Y), 43) - 0.5) * 0.08;
    if (hit.kind !== 9) b *= gain;
    if (hit.kind === 0) b -= 0.04;
    const s = b + spec * 0.6;
    if (s > best) (best = s), (bx = px), (by = py);
    if (spec > 0.8) return pav ? C[6] : WHITE;
    return C[Math.max(1, Math.min(6, Math.round(1 + s * 5.6)))];
  });
  // the cut: where two facets meet, a pavilion edge sinks a shade and a crown ridge catches a shade more light
  if (!white && edges) {
    const out = [];
    for (const [key, id] of ids) {
      const kx = Math.floor(key / 1000), ky = key - kx * 1000, x = kx - 500, y = ky - 500, r = ids.get(key + 1000), d = ids.get(key + 1);
      if ((r !== undefined && r !== id) || (d !== undefined && d !== id)) {
        const c = L.get(x, y) >>> 0, i = C.findIndex((k) => k >>> 0 === c), pav = [4, 5, 8].includes(P[id].kind);
        if (i > 0) out.push([x, y, pav ? C[Math.max(1, i - 1)] : C[Math.min(7, i + 1)]]);
      }
    }
    for (const [x, y, c] of out) L.set(x, y, c);
  }
  L.outline(C[0]).draw(p, 0, 0, a);
  return { x: bx, y: by, k: best };
}

/**
 * A thick coin turning on its upright axis: radius r, thickness th, turned by theta (0 faces you). Each row
 * shows the face (squashed by cos theta, a raised rim, a recessed field, an embossed star) and, beside it,
 * the reeded edge band (th |sin theta| wide). Lit from the top left; the face flashes white as it squares
 * to the light. Built in L with a dark outline. C: 8-step ramp. Returns the flash strength 0..1.
 */
export function coin3d(L, p, x, y, r, th, theta, C, { a = 1, white = false } = {}) {
  const ct = Math.cos(theta), st = Math.sin(theta), sg = ct < 0 ? -1 : 1, act = Math.abs(ct), ast = Math.abs(st);
  const xc = (th / 2) * st * sg, nfx = st * sg, Lx = -0.55, Ly = 0.45, Lz = 0.7, Ln = Math.hypot(Lx, Ly, Lz);
  // the face's normal stays level, so its flash comes when it squares to the light's level direction
  const lam = (nfx * Lx + act * Lz) / Ln, Hx = Lx / Ln, Hz = Lz / Ln + 1, Hn = Math.hypot(Hx, Hz);
  const base = Math.max(2, Math.min(5, Math.round(2 + lam * 3.2)));
  const X = Math.round(x), Y = Math.round(y), B = Math.ceil(r + th) + 2;
  let flash = 0;
  L.begin(X - B, Y - B);
  L.fill(X - B, Y - B, X + B, Y + B, (px, py) => {
    const sx = px - X, sy = -(py - Y);
    if (Math.abs(sy) > r) return 0;
    const s = Math.sqrt(1 - (sy / r) ** 2), hw = r * s * act, xr = -(st < 0 ? -1 : 1) * s * r * ct, rw = (th / 2) * ast;
    if (white && (Math.abs(sx - xc) <= hw || Math.abs(sx - xr) <= rw + 0.05)) return WHITE;
    if (Math.abs(sx - xc) <= hw && act > 0.08) {
      // on the face: un-squash to the face's own coordinates
      const fx = (sx - xc) / act, fy = sy, d = Math.hypot(fx, fy) / r;
      // a faint curve across the face makes the flash sweep over it as it turns
      const tx = nfx + (fx / r) * 0.3 * act, sp = Math.pow(Math.max(0, (tx * Hx + act * Hz) / Hn / Math.hypot(tx, act)), 130);
      flash = Math.max(flash, sp);
      // relief in whole ramp steps so it shows at every angle: a raised rim lit on its upper left, a recessed
      // field, a raised diamond with lit and shaded faces
      const lit = (-fx * 0.6 + fy * 0.8) / Math.max(0.5, Math.hypot(fx, fy));
      let k;
      if (d > 0.76) k = base + (lit > 0.75 ? 2 : lit > 0.3 ? 1 : lit < -0.35 ? -1 : 0);
      else {
        const q = (Math.abs(fx) + Math.abs(fy)) / (r * 0.52);
        k = q >= 1 ? base - 1 : q < 0.45 ? base + 1 : fx <= 0 && fy >= 0 ? base + 1 : fx > 0 && fy < 0 ? base - 2 : base;
      }
      if (sp > 0.5) return sp > 0.8 ? WHITE : C[Math.min(7, k + 2)];
      return C[Math.max(2, Math.min(6, k))];
    }
    if (Math.abs(sx - xr) <= rw + 0.05) {
      // the reeded edge: grooves across the band, lit by the edge's own normal
      const cphi = xr < 0 ? -s : s, n = [cphi * ct, sy / r, -cphi * st], l = (n[0] * Lx + n[1] * Ly + n[2] * Lz) / Ln;
      const groove = Math.floor((Math.asin(sy / r) + Math.PI) * 9) % 2;
      const edge = Math.abs(sx - xr) > rw - 0.6 && Math.sign(sx - xr) === Math.sign(xc - xr);
      return C[Math.max(1, Math.min(6, Math.round(2.6 + l * 2.6) - groove + (edge ? 1 : 0)))];
    }
    return 0;
  });
  L.outline(C[1]).draw(p, 0, 0, a);
  return flash;
}

// ---- 3D: a small ray tracer over the Space, for the pickups' `three` variants. A pickup that really turns (a
// coin, a gem, a key, a flask, a chest) is a solid: an SDF or a convex solid of planes, found pixel by pixel along
// the camera's rays, so it has a true depth for every pixel, sorts with a character, and shows its other side.

const IDENT = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** 3x3 rotation matrices (row major, object to world; world y is down): about the vertical, x and z axes. */
export const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
export const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
export const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
/** A then B applied: matMul(A, B) v = A (B v). */
export const matMul = (A, B) => {
  const M = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
  return M;
};
const mv = (M, x, y, z) => [M[0] * x + M[1] * y + M[2] * z, M[3] * x + M[4] * y + M[5] * z, M[6] * x + M[7] * y + M[8] * z];
const mtv = (M, x, y, z) => [M[0] * x + M[3] * y + M[6] * z, M[1] * x + M[4] * y + M[7] * z, M[2] * x + M[5] * y + M[8] * z];

// a view-space vector (right, down on screen, towards the camera) as a world vector
const unview = (q, a, b, c) => {
  const vz = b * q.sp + c * q.cp;
  return [a * q.cy + vz * q.sy, b * q.cp - c * q.sp, -a * q.sy + vz * q.cy];
};
// the light, as it stands for every pickup: up and to the left of the camera, a little in front of it
const LIGHT = [-0.55, -0.72, 0.42];
const unit3 = ([x, y, z]) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
/** The world-space light L, the direction to the eye V and their half vector H for q's camera. */
export function lights(q, light = LIGHT) {
  const L = unview(q, ...light), V = unview(q, 0, 0, 1);
  return { L, V, H: unit3([L[0] + V[0], L[1] + V[1], L[2] + V[2]]) };
}

const REC = new Map();
const HIT = { t: 0, tmax: 0, x: 0, y: 0, z: 0, ox: 0, oy: 0, oz: 0, nx: 0, ny: 1, nz: 0, id: 0, kind: 0, i: -1, L: null, V: null, H: null };
const key = (sx, sy) => (sy + 2048) * 4096 + sx + 2048;

/**
 * Ray-trace a solid centered at (cx, cy, cz) inside a sphere of radius R. hit(O, D, h) walks the ray (origin O,
 * unit direction D, world coordinates relative to the center) and returns its distance t or -1, filling h's
 * normal (nx, ny, nz), id and kind; shade(h) gets the hit (h.x, h.y, h.z relative to the center, the same in view space
 * as h.vx (right), h.vy (down), h.vz (towards the camera), h.L, h.V, h.H)
 * and returns a color, or 0 to leave the pixel. Every pixel gets the depth of the surface it sees.
 *   ink      a 1 px outline round the silhouette
 *   crease   with ink: a line on the far side of any jump in depth bigger than this (parts overlapping parts)
 *   edge     (rec, right, down) => color: recolor a pixel by its neighbours (rec: { c, z, id, kind, i })
 *   a        alpha
 *   light    the light's direction on screen [right, down, towards the viewer] (the default is up left)
 */
export function trace(q, cx, cy, cz, R, hit, shade, { ink = 0, crease = 0, edge = null, a = 1, light = LIGHT } = {}) {
  if (!q.project(cx, cy, cz)) return;
  const p = q.p, X = q.x, Y = q.y, d0 = q.d, k = q.k, r = R * k, lt = lights(q, light), D = [-lt.V[0], -lt.V[1], -lt.V[2]], h = HIT, R2 = R * R;
  h.L = lt.L; h.V = lt.V; h.H = lt.H; h.tmax = 2 * R;
  const rec = REC;
  rec.clear();
  p.each(X - r - 1, Y - r - 1, X + r + 1, Y + r + 1, (lx, ly, sx, sy) => {
    const vx = (lx - X) / k, vy = (ly - Y) / k;
    if (vx * vx + vy * vy > R2) return;
    const O = unview(q, vx, vy, R);
    h.id = 0; h.kind = 0; h.i = -1;
    const t = hit(O, D, h);
    if (t < 0) return;
    h.vx = vx; h.vy = vy; h.vz = R - t;
    h.t = t; h.x = O[0] + D[0] * t; h.y = O[1] + D[1] * t; h.z = O[2] + D[2] * t;
    const c = shade(h);
    if (c) rec.set(key(sx, sy), { sx, sy, c, z: d0 - (R - t), id: h.id, kind: h.kind, i: h.i });
  });
  const z0 = p.z, around = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (edge) {
    const out = [];
    for (const e of rec.values()) {
      const c = edge(e, rec.get(key(e.sx + 1, e.sy)), rec.get(key(e.sx, e.sy + 1)));
      if (c) out.push([e, c]);
    }
    for (const [e, c] of out) e.c = c;
  }
  if (ink && crease) {
    const out = [];
    for (const e of rec.values()) for (const [dx, dy] of around) {
      const n = rec.get(key(e.sx + dx, e.sy + dy));
      if (n && n.z < e.z - crease) { out.push(e); break; }
    }
    for (const e of out) e.c = ink;
  }
  for (const e of rec.values()) (p.z = e.z), p.put(e.sx, e.sy, e.c, a);
  if (ink) {
    const edgeZ = new Map();
    for (const e of rec.values())
      for (const [dx, dy] of around) {
        const kk = key(e.sx + dx, e.sy + dy);
        if (rec.has(kk)) continue;
        const o = edgeZ.get(kk);
        if (!o || e.z < o.z) edgeZ.set(kk, { sx: e.sx + dx, sy: e.sy + dy, z: e.z });
      }
    for (const o of edgeZ.values()) (p.z = o.z), p.put(o.sx, o.sy, ink, a);
  }
  p.z = z0;
}

/** hit() for trace from a signed distance function f(x, y, z) (world coordinates relative to the center). */
export function sdfHit(f, { steps = 56, eps = 0.04, grad = 0.35 } = {}) {
  return (O, D, h) => {
    let t = 0;
    for (let i = 0; i < steps; i++) {
      const x = O[0] + D[0] * t, y = O[1] + D[1] * t, z = O[2] + D[2] * t, d = f(x, y, z);
      if (d < eps) {
        const e = grad, nx = f(x + e, y, z) - f(x - e, y, z), ny = f(x, y + e, z) - f(x, y - e, z), nz = f(x, y, z + e) - f(x, y, z - e), l = Math.hypot(nx, ny, nz) || 1;
        h.nx = nx / l; h.ny = ny / l; h.nz = nz / l;
        return t;
      }
      t += Math.max(d * 0.85, 0.03);
      if (t > h.tmax) return -1;
    }
    return -1;
  };
}

/** hit() for trace from an implicit surface f(x, y, z) (negative inside, not a distance): fixed steps, then bisection. */
export function implicitHit(f, { step = 0.6, bisect = 7, grad = 0.3 } = {}) {
  return (O, D, h) => {
    let t0 = 0, f0 = f(O[0], O[1], O[2]);
    for (let t = step; t <= h.tmax + step; t += step) {
      const f1 = f(O[0] + D[0] * t, O[1] + D[1] * t, O[2] + D[2] * t);
      if (f1 < 0 && f0 >= 0) {
        let a = t0, b = t;
        for (let i = 0; i < bisect; i++) {
          const m = (a + b) / 2;
          if (f(O[0] + D[0] * m, O[1] + D[1] * m, O[2] + D[2] * m) < 0) b = m;
          else a = m;
        }
        const x = O[0] + D[0] * b, y = O[1] + D[1] * b, z = O[2] + D[2] * b, e = grad;
        const nx = f(x + e, y, z) - f(x - e, y, z), ny = f(x, y + e, z) - f(x, y - e, z), nz = f(x, y, z + e) - f(x, y, z - e), l = Math.hypot(nx, ny, nz) || 1;
        h.nx = nx / l; h.ny = ny / l; h.nz = nz / l;
        return b;
      }
      t0 = t;
      f0 = f1;
    }
    return -1;
  };
}

/**
 * hit() for trace from convex solids of facet planes (brilliant(), prism(), ...: y up in the planes, flipped here to
 * the world's y down), turned by M (object to world) and scaled by s. Several solids make their union (the nearest
 * hit wins). Fills h.id (solid * 1000 + plane + 1), h.kind, and the hit point in the object's own frame h.ox..oz.
 */
export function convexHit(solids, M = IDENT, s = 1) {
  const list = Array.isArray(solids) ? solids : [solids];
  for (const g of list) g.flip ??= g.planes.map((q) => ({ n: [q.n[0], -q.n[1], q.n[2]], d: q.d, kind: q.kind }));
  return (O, D, h) => {
    const ro = mtv(M, O[0], O[1], O[2]).map((v) => v / s), rd = mtv(M, D[0], D[1], D[2]).map((v) => v / s);
    let best = -1, bp = null, bi = 0;
    for (let si = 0; si < list.length; si++) {
      const P = list[si].flip;
      let t0 = -1e9, t1 = 1e9, hp = -1;
      for (let pi = 0; pi < P.length; pi++) {
        const n = P[pi].n, nd = n[0] * rd[0] + n[1] * rd[1] + n[2] * rd[2], no = n[0] * ro[0] + n[1] * ro[1] + n[2] * ro[2];
        if (Math.abs(nd) < 1e-7) {
          if (no > P[pi].d) { t1 = -1e9; break; }
          continue;
        }
        const tt = (P[pi].d - no) / nd;
        if (nd < 0) { if (tt > t0) (t0 = tt), (hp = pi); }
        else if (tt < t1) t1 = tt;
        if (t0 > t1) break;
      }
      if (hp < 0 || t0 > t1 || t0 < 0) continue;
      if (best < 0 || t0 < best) (best = t0), (bp = P[hp]), (bi = si * 1000 + hp + 1);
    }
    if (best < 0) return -1;
    const n = mv(M, bp.n[0], bp.n[1], bp.n[2]);
    h.nx = n[0]; h.ny = n[1]; h.nz = n[2]; h.id = bi; h.kind = bp.kind;
    h.ox = ro[0] + rd[0] * best; h.oy = ro[1] + rd[1] * best; h.oz = ro[2] + rd[2] * best;
    return best;
  };
}

/** The point (x, y, z) in an object's own frame, for a hit on an SDF solid turned by M and scaled by s. */
export const toObject = (M, h, s = 1) => mtv(M, h.x, h.y, h.z).map((v) => v / s);

/** A cut gem's color for a hit on a brilliant() or prism() facet: the shading of drawGem, in world space. Returns [color, ramp index, spec]. */
export function gemTone(h, C, gain = 1) {
  const { kind } = h, n = [h.nx, h.ny, h.nz], pav = kind === 4 || kind === 5 || kind === 8;
  const [Lx, Ly, Lz] = h.L, [Hx, Hy, Hz] = h.H;
  const m = pav ? [n[0], -n[1] * 0.6, n[2]] : n, ml = Math.hypot(m[0], m[1], m[2]);
  const lam = Math.max(0, (m[0] * Lx + m[1] * Ly + m[2] * Lz) / ml), spec = Math.pow(Math.max(0, (m[0] * Hx + m[1] * Hy + m[2] * Hz) / ml), 18);
  let b = pav ? 0.02 + 0.72 * Math.pow(lam, 2.4) : kind === 3 ? 0.12 + 0.4 * lam : 0.04 + 0.66 * Math.pow(lam, 1.8);
  // a crystal's upright faces are lit by the light's level direction; its cap catches it from above
  if (kind === 6) b = 0.16 + 0.66 * Math.pow(Math.max(0, (n[0] * Lx + n[2] * Lz) / Math.hypot(Lx, Lz)), 1.3);
  else if (kind === 7) b = 0.22 + 0.62 * Math.pow(lam, 1.2);
  else if (kind === 9) b = 0.62 + 0.25 * lam;
  else if (kind === 10) b = 0.3 + 0.5 * lam;
  if (kind !== 9) b *= gain;
  if (kind === 0) b -= 0.04;
  const s = b + spec * 0.6;
  h.i = Math.max(1, Math.min(6, Math.round(1 + s * 5.6)));
  h.s = s;
  if (spec > 0.8) return pav ? C[6] : WHITE;
  return C[h.i];
}

/** The cut, for trace's edge: where two facets meet, a pavilion edge sinks a shade and a crown ridge catches a shade more light. */
export const gemEdges = (C) => (e, r, d) => {
  if (e.i < 1 || !((r && r.id !== e.id) || (d && d.id !== e.id))) return;
  return e.kind === 4 || e.kind === 5 || e.kind === 8 ? C[Math.max(1, e.i - 1)] : C[Math.min(7, e.i + 1)];
};

// ---- floor and light helpers for the variants

/** A soft shadow disc on the floor under a thing at (x, z): dithered darkness, fullest in the middle. k is its strength. */
export function floorShadow(q, x, z, r, k = 1) {
  if (r < 1 || k <= 0) return;
  q.plane(x, 0, z, null, r + 1, (u, v, out) => {
    const d = Math.hypot(u, v) / r;
    if (d > 1) return;
    out.c = INK;
    out.a = k * (1 - d * d) * 1.1;
  });
}

/** A shadow oval on the floor under (x, z): half-length rl along the direction (dx, dz), half-width rw. */
export function floorShadowOval(q, x, z, dx, dz, rl, rw, k = 1) {
  if (rl < 1 || k <= 0) return;
  const l = Math.hypot(dx, dz) || 1;
  dx /= l; dz /= l;
  q.plane(x, 0, z, null, Math.max(rl, rw) + 1, (u, v, out) => {
    const a = (u * dx + v * dz) / rl, b = (-u * dz + v * dx) / rw, d = a * a + b * b;
    if (d > 1) return;
    out.c = INK;
    out.a = k * (1 - d * 0.55) * 1.2;
  });
}

/** A pool of light on the floor round (x, z): k at the middle falling off to the rim. */
export function floorPool(q, x, z, r, c, k) {
  if (k <= 0.004 || r < 1) return;
  q.plane(x, 0, z, null, r, (u, v, out) => {
    const d = Math.hypot(u, v) / r;
    if (d >= 1) return;
    const f = 1 - d;
    out.l = c;
    out.k = f * f * k;
  });
}

/** A ring of light on a plane (default the floor): a thin band of color c, alpha a, with light of colour lc round it (width lw, strength lk). */
export function lightRing(q, cx, cy, cz, r, w, c, a, lc, lk, lw = 4, n) {
  q.plane(cx, cy, cz, n, r + lw + 1, (u, v, out) => {
    const e = Math.abs(Math.hypot(u, v) - r + w / 2);
    if (e < w / 2 + 0.01) (out.c = c), (out.a = a);
    if (lk > 0.004 && e < lw) (out.l = lc), (out.k = lk * (1 - e / lw) ** 2);
  });
}

/** A star glint as an upright billboard at (x, y, z). */
export function glint3(q, x, y, z, arm, c, k = 0.4, tip) {
  q.at(x, y, z, (pp) => glint(pp, 0, 0, arm, c, k, tip));
}

// ---- signed distances (px), for the solids
export const sdBox = (x, y, z, hx, hy, hz, r = 0) => {
  const a = (x < 0 ? -x : x) - hx + r, b = (y < 0 ? -y : y) - hy + r, c = (z < 0 ? -z : z) - hz + r;
  const ax = a > 0 ? a : 0, bx = b > 0 ? b : 0, cx = c > 0 ? c : 0, m = a > b ? (a > c ? a : c) : b > c ? b : c;
  return Math.sqrt(ax * ax + bx * bx + cx * cx) + (m < 0 ? m : 0) - r;
};
/** A cylinder about the vertical axis: radius rad, half height hy. */
export const sdCyl = (x, y, z, rad, hy, r = 0) => {
  const a = Math.sqrt(x * x + z * z) - rad + r, b = (y < 0 ? -y : y) - hy + r, ax = a > 0 ? a : 0, bx = b > 0 ? b : 0;
  return Math.min(a > b ? a : b, 0) + Math.sqrt(ax * ax + bx * bx) - r;
};
export const sdSeg = (x, y, z, ax, ay, az, bx, by, bz, r) => {
  const dx = bx - ax, dy = by - ay, dz = bz - az, u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / (dx * dx + dy * dy + dz * dz || 1)));
  return Math.hypot(x - ax - dx * u, y - ay - dy * u, z - az - dz * u) - r;
};
/** A torus in the x-y plane: ring radius R, tube radius r. */
export const sdTorus = (x, y, z, R, r) => Math.hypot(Math.hypot(x, y) - R, z) - r;
