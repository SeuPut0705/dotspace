// The banded light (posterized steps from a white-hot core out to deep color, fine strands running through it,
// pulses travelling along, light laid over the top) is adapted from Sprite Fusion's open-source holy light
// (https://www.spritefusion.com/pixel-art-vfx/holy-light), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, smooth, rand, mix, space, TAU, WHITE, sparkle } from "../../core/index.js";
import { clip, rows, box, field, sample, bayer } from "./_lib.js";

export const meta = {
  name: "Aurora",
  desc: "Rippling curtains of green-to-violet light over a starfield: folding hems burn bright, rays shimmer up into violet, and the whole sky slowly breathes.",
  tags: ["weather", "aurora", "northern lights", "sky", "night", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 180],
  duration: 12,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#081a1e", "#0d3a36", "#13664e", "#1fa06a", "#3fd88e", "#9af7bf", "#e6fff0"],
    upper: ["#120b2a", "#26164f", "#41208a", "#6a34c0", "#9c62e8", "#d2b4ff", "#f6eeff"],
    seed: 3,
  },
};

const D = 12, W = 320, H = 180, BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const I = new Float32Array(W * H), HV = new Float32Array(W * H), BL = new Float32Array(W * H), TMP = new Float32Array(W * H);

// a curtain's light from its hem (v = 0) up its rays (v = 1): a bright hem, a body that holds, rays fading up
// into the dark. Tabled in steps of 1/200. Below the hem there's only a skirt of glow a few pixels deep.
const PROF = Float32Array.from({ length: 201 }, (_, i) => {
  const v = i / 200;
  return v < 0.035 ? 2.6 : v < 0.22 ? 1.15 - v : (1 - v) ** 1.5 * 0.9;
});

// a soft bloom of the light: a box blur of radius r, across then down, by running sums
function blur(src, dst, r) {
  const n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    let acc = 0;
    const o = y * W;
    for (let x = -r; x < W + r; x++) {
      if (x + r < W) acc += src[o + Math.min(W - 1, x + r)];
      if (x - r - 1 >= 0) acc -= src[o + x - r - 1];
      if (x >= 0 && x < W) TMP[o + x] = acc / n;
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y < H + r; y++) {
      if (y + r < H) acc += TMP[Math.min(H - 1, y + r) * W + x];
      if (y - r - 1 >= 0) acc -= TMP[(y - r - 1) * W + x];
      if (y >= 0 && y < H) dst[y * W + x] = acc / n;
    }
  }
}
const cyc = (t, c, ph = 0) => (TAU * c * t) / D + ph;

// the curtains, back to front: where each hangs, how it folds and ripples, how tall its rays reach
const CURTAINS = [
  { y: -132, slope: -0.08, amp: 8, lam: 210, fold: 14, flam: 150, height: 40, k: 0.6, s0: -210, s1: 210, rip: 1.6, c: [1, 1, 2], hue: 0.35 },
  { y: -88, slope: 0.22, amp: 13, lam: 250, fold: 19, flam: 165, height: 82, k: 1.5, s0: -195, s1: 180, rip: 2.4, c: [1, 2, 3], hue: 0 },
  { y: -38, slope: -0.05, amp: 5, lam: 150, fold: 10, flam: 110, height: 20, k: 0.45, s0: -210, s1: 210, rip: 1.4, c: [2, 1, 3], hue: 0 },
];

export function draw(p, t, o) {
  const q = clip(p, meta), B = box(meta), S = o.seed, G = fit(o.palette, 7), U = fit(o.upper, 7);
  stars(q, t, S, G, U);
  I.fill(0);
  HV.fill(0);
  const F = field(S * 5 + 1, 256, 128, [8, 16, 32]), breath = 0.75 + 0.25 * Math.sin(cyc(t, 1, -1.2));
  const rays = [];
  CURTAINS.forEach((c, n) => curtain(q, c, n, t, F, breath, rays, G));
  blur(I, BL, 5);
  // shade: hue by height (green at the hem, violet up the rays), brightness by intensity in posterized steps.
  // Faint light is only light, so the stars shine through it; the bright parts get crisp color too.
  const GM = G.map((g, i) => mix(g, U[i], 0.5));
  rows(p, meta, B.y0, -12, (y, R) => {
    const base = (Math.floor(y) - B.y0) * W, by = (Math.floor(y) & 3) << 2;
    for (let xi = 0; xi < W; xi++) {
      const i = base + xi, raw = I[i], bl = BL[i];
      let k = bl > 0.015 ? Math.min(0.4, bl * 0.6) : 0;
      if (raw >= 0.03) {
        const e = (raw * 1.5) / (1 + raw * 1.5), v = HV[i] / raw, th = e > 0.45 ? BAY[by | (xi & 3)] * 0.06 : 0;
        let lv = e > 0.86 + th ? 6 : e > 0.72 + th ? 5 : e > 0.56 + th ? 4 : e > 0.4 + th ? 3 : e > 0.24 ? 2 : 1;
        if (v > 0.35) lv = Math.min(lv, 5);
        const c = v < 0.3 ? G[lv] : v < 0.5 ? GM[lv] : U[lv];
        if (lv >= 3) {
          R.c[xi] = c;
          R.a[xi] = clamp((e - 0.3) * 2.2);
          R.b[xi] = lv < 5 ? 1 : 0;
        }
        R.l[xi] = lv >= 3 ? (v < 0.4 ? G[4] : U[4]) : c === G[lv] ? G[4] : c === U[lv] ? U[4] : GM[4];
        k += e * (lv >= 3 ? 0.28 : 0.72);
      } else R.l[xi] = G[4];
      R.k[xi] = k;
    }
  });
  // the brightest rays as fine strands of light, fading up into violet
  for (const r of rays) {
    const n = Math.round(r.h);
    for (let j = 1; j < n; j++) {
      const u = j / n;
      q.blend(r.x, r.hem - j, u < 0.35 ? G[5] : u < 0.6 ? mix(G[5], U[5], 0.5) : U[5], r.k * (1 - u) ** 1.3);
    }
    q.px(r.x, r.hem, G[6]);
  }
}

// one curtain: walk along it, drop each ray's light into the columns it covers; where it folds back on itself
// along the line of sight the light piles up, so folds burn brightest
function curtain(q, c, n, t, F, breath, rays, G) {
  const X0 = -160, Y0 = -180, fast = (256 * 2 * t) / D, slow = (256 * t) / D;
  let p1 = 0, p2 = 0, lastX = -999;
  for (let s = c.s0; s < c.s1; s += 0.5) {
    const x = s + c.fold * Math.sin((TAU * s) / c.flam + cyc(t, c.c[0], n * 2)) + 5 * Math.sin((TAU * s) / 64 + cyc(t, c.c[2], n));
    if (x < X0 - 2 || x >= X0 + W + 1) continue;
    const hem = c.y + c.slope * s + c.amp * Math.sin((TAU * s) / c.lam + cyc(t, c.c[1], n * 1.7)) + c.rip * Math.sin((TAU * s) / 23 - cyc(t, 7, n));
    const env = smooth(c.s0, c.s0 + 60, s) * (1 - smooth(c.s1 - 70, c.s1, s));
    // rays: fine strands drifting along the curtain, each with its own height; bright patches running along it
    const r1 = clamp((sample(F, s * 5 - fast + n * 40, 10 + n * 30) - 0.38) * 3.2), r2 = clamp((sample(F, s * 4.3 + fast * 0.7 + n * 90, 50 + n * 13) - 0.35) * 3);
    const patch = sample(F, s * 0.7 + slow + n * 17, 80 + n * 9);
    const k = c.k * env * breath * (0.2 + 0.8 * r1) * (0.3 + 1.4 * Math.max(0, patch - 0.3));
    if (k < 0.01) continue;
    const h = c.height * (0.45 + 0.75 * r2) * (0.75 + 0.5 * patch), xi = Math.floor(x - X0), fr = x - X0 - xi;
    // a ray peaks here: keep it as a strand; and a soft bloom along the bright hem
    if (p1 > 0.75 && p1 >= p2 && p1 >= r1 && Math.abs(x - lastX) > 2 && k > 0.25) (rays.push({ x, hem: hem - 1, h: h * 0.9, k: Math.min(0.85, k * 0.9) }), (lastX = x));
    p2 = p1;
    p1 = r1;
    if (xi < -1 || xi >= W) continue;
    const top = Math.max(0, Math.floor(hem - h - Y0)), bot = Math.min(H - 1, Math.floor(hem - Y0) + 3), inv = 1 / h, k0 = k * 0.5 * (1 - fr), k1 = k * 0.5 * fr;
    let v = (hem - Y0 - 0.5 - top) * inv;
    for (let yi = top; yi <= bot; yi++, v -= inv) {
      // above the hem: the ray; below it: a skirt of glow gone within three pixels
      const pr = v >= 0 ? PROF[Math.min(200, (v * 200) | 0)] : Math.max(0, 0.45 + v * h * 0.16), o = yi * W + xi, hv = v + c.hue < 0 ? 0 : v + c.hue > 1 ? 1 : v + c.hue;
      if (pr <= 0) continue;
      if (xi >= 0) (I[o] += k0 * pr), (HV[o] += k0 * pr * hv);
      if (xi + 1 < W) (I[o + 1] += k1 * pr), (HV[o + 1] += k1 * pr * hv);
    }
  }
}

// the starfield: dim specks, steady stars, a few bright ones that twinkle with a glint
function stars(q, t, S, G, U) {
  for (let i = 0; i < 150; i++) {
    const x = -160 + rand(S, i, 1) * 320, y = -180 + rand(S, i, 2) * 175, r = rand(S, i, 3), c = 1 + Math.floor(rand(S, i, 4) * 4);
    const tw = 0.5 + 0.5 * Math.sin(cyc(t, c, rand(S, i, 5) * TAU));
    const col = r < 0.6 ? mix(U[3], WHITE, 0.2) : r < 0.9 ? mix(U[5], WHITE, 0.5) : WHITE;
    if (r < 0.6) q.dot(x, y, col, 0.35 + 0.5 * tw);
    else if (r < 0.95) {
      q.px(x, y, col);
      q.glow(x + 0.5, y + 0.5, 3, U[5], 0.25 * tw);
    } else sparkle(q, x, y, 1 + Math.round(tw * 2), mix(U[5], WHITE, 0.6), U[4], 0.35 * tw);
  }
}

// ---- the 3D variant: the curtains hang in a real volume over the floor, each a curved sheet of vertical strands
// with a real path in x and z (its folds swing the sheet in and out), the second and third curtain behind and
// beside the first, and the green and violet light washing the floor under them.
const NB = 96, FR = 106;
// where each sheet hangs: radius of its path, the angle its middle faces, world px per 2D unit along it, the height
// of its hem above the floor, and how much of the 2D hem wander and ray height it keeps; fr: how far folds swing it
const A3 = [
  { ...CURTAINS[0], r: 96, a0: -0.55, sc: 0.8, hb: 72, hy: 0.7, hh: 1.05, fr: 0.5, lk: 0.5 },
  { ...CURTAINS[1], r: 70, a0: -1.75, sc: 0.64, hb: 56, hy: 0.5, hh: 0.8, fr: 0.5, lk: 1 },
  { ...CURTAINS[2], r: 48, a0: 1.1, sc: 0.5, hb: 30, hy: 0.6, hh: 1.3, fr: 0.45, lk: 0.6 },
];

export const three = {
  meta: { size: [268, 190], origin: [134, 166], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), S = o.seed, G = fit(o.palette, 7), U = fit(o.upper, 7), GM = G.map((g, i) => mix(g, U[i], 0.5));
    const F = field(S * 5 + 1, 256, 128, [8, 16, 32]), breath = 0.75 + 0.25 * Math.sin(cyc(t, 1, -1.2));
    stars3(q, t, S, G, U);
    const strands = [], prof = A3.map(() => new Float32Array(NB));
    A3.forEach((c, n) => curtain3(c, n, t, F, breath, strands, prof[n]));
    floorLight(q, prof, G, U);
    // the strands, far to near; where the sheet turns edge on to the eye they pile up into a bright fold
    for (const s of q.sort(strands, (e) => [e.x, e.y, e.z])) strand3(q, s, G, GM, U);
  },
};

// one sheet: walk along it, each strand a vertical ray hung from the hem; the same rays, patches, folds and hem
// ripples as the 2D curtain, with the 2D x now the way along a curved path and the fold a swing in and out of it
function curtain3(c, n, t, F, breath, out, prof) {
  const fast = (256 * 2 * t) / D, slow = (256 * t) / D, sway = 0.09 * Math.sin(cyc(t, 1, n * 2.1)), sum = new Float32Array(NB), cnt = new Uint16Array(NB);
  let p1 = 0, p2 = 0, lastS = -999;
  for (let s = c.s0; s < c.s1; s += 1) {
    const fold = c.fold * Math.sin((TAU * s) / c.flam + cyc(t, c.c[0], n * 2)) + 5 * Math.sin((TAU * s) / 64 + cyc(t, c.c[2], n));
    const hem = c.slope * s + c.amp * Math.sin((TAU * s) / c.lam + cyc(t, c.c[1], n * 1.7)) + c.rip * Math.sin((TAU * s) / 23 - cyc(t, 7, n));
    const env = smooth(c.s0, c.s0 + 60, s) * (1 - smooth(c.s1 - 70, c.s1, s));
    const r1 = clamp((sample(F, s * 5 - fast + n * 40, 10 + n * 30) - 0.38) * 3.2), r2 = clamp((sample(F, s * 4.3 + fast * 0.7 + n * 90, 50 + n * 13) - 0.35) * 3);
    const patch = sample(F, s * 0.7 + slow + n * 17, 80 + n * 9);
    const k = c.k * env * breath * (0.2 + 0.8 * r1) * (0.3 + 1.4 * Math.max(0, patch - 0.3)), b = Math.min(NB - 1, Math.floor(((s - c.s0) / (c.s1 - c.s0)) * NB));
    sum[b] += k;
    cnt[b]++;
    if (k < 0.01) continue;
    const rad = Math.min(FR - 2, c.r + fold * c.fr), a = c.a0 + sway + (s * c.sc) / c.r;
    const hy = -(c.hb + c.hy * hem), h = Math.min(c.height * c.hh * (0.45 + 0.75 * r2) * (0.75 + 0.5 * patch), 112 + hy);
    const ray = p1 > 0.75 && p1 >= p2 && p1 >= r1 && Math.abs(s - lastS) > 2.5 && k > 0.25;
    if (ray) lastS = s;
    p2 = p1;
    p1 = r1;
    out.push({ x: Math.cos(a) * rad, y: hy, z: Math.sin(a) * rad, h, k, hue: c.hue, ray, rk: Math.min(0.85, k * 0.9) });
  }
  for (let b = 0; b < NB; b++) prof[b] = cnt[b] ? (sum[b] / cnt[b]) * c.lk : 0;
}

// one strand: a screen-vertical run of translucent pixels up from the hem (bright hem, held body, rays fading up and
// turning violet), in the 2D curtain's banded colors, with a little light on each; the bright ones a fine crisp ray
function strand3(q, s, G, GM, U) {
  if (!q.project(s.x, s.y, s.z)) return;
  const p = q.p, bx = q.x, by = q.y, z0 = p.z, n = Math.max(2, Math.ceil(s.h * q.cp * q.k)), inv = 1 / n;
  p.z = q.d;
  for (let j = -3; j < n; j++) {
    const v = j * inv, pr = j < 0 ? Math.max(0, 0.45 + j * 0.16) : PROF[Math.min(200, (v * 200) | 0)], e = s.k * pr;
    if (e < 0.04) continue;
    const hv = clamp(v + s.hue), R = hv < 0.3 ? G : hv < 0.5 ? GM : U;
    const lv = e > 0.95 ? 6 : e > 0.7 ? 5 : e > 0.45 ? 4 : e > 0.26 ? 3 : e > 0.12 ? 2 : 1;
    p.blend(bx, by - j, R[lv], Math.min(0.9, 0.1 + e * 1.05));
    if (e > 0.1) p.light(bx, by - j, R[4], Math.min(0.4, e * 0.26));
  }
  if (s.ray)
    for (let j = 1; j < n; j++) {
      const u = j / n;
      p.blend(bx, by - j, u < 0.35 ? G[5] : u < 0.6 ? mix(G[5], U[5], 0.5) : U[5], s.rk * (1 - u) ** 1.3);
    }
  if (s.ray) p.px(bx, by, G[6]);
  p.z = z0;
}

// the light the sheets throw on the floor: under and between them, green with a breath of violet, brightest where
// the sheet above burns brightest (each sheet's light by the angle round the floor it hangs at)
function floorLight(q, prof, G, U) {
  const L = mix(G[4], U[4], 0.25);
  q.plane(0, 0, 0, null, FR, (u, v, out) => {
    const d = Math.hypot(u, v), a = Math.atan2(v, u);
    let acc = 0;
    for (let n = 0; n < A3.length; n++) {
      const c = A3[n], da = Math.atan2(Math.sin(a - c.a0), Math.cos(a - c.a0)), s = (da * c.r) / c.sc;
      if (s < c.s0 || s >= c.s1) continue;
      const dr = (d - c.r) / 38;
      const f = Math.max(0, Math.min(NB - 1.001, ((s - c.s0) / (c.s1 - c.s0)) * NB - 0.5)), i = f | 0, w = f - i;
      acc += (prof[n][i] * (1 - w) + prof[n][i + 1] * w) / (1 + dr * dr);
    }
    out.l = L;
    out.k = Math.min(0.5, acc * 0.32) * (1 - smooth(FR - 26, FR, d));
  });
}

// the starfield as a dome: stars at real places over a hemisphere, the near half dimmer so they never cover the scene
function stars3(q, t, S, G, U) {
  for (let i = 0; i < 150; i++) {
    const f = rand(S, i, 1) * TAU, e = Math.asin(0.1 + 0.9 * rand(S, i, 2)), r = rand(S, i, 3), c = 1 + Math.floor(rand(S, i, 4) * 4), Rs = 110;
    const x = Math.cos(e) * Math.sin(f) * Rs, y = -Math.sin(e) * Rs, z = Math.cos(e) * Math.cos(f) * Rs;
    const tw = 0.5 + 0.5 * Math.sin(cyc(t, c, rand(S, i, 5) * TAU)), near = 0.3 + 0.7 * smooth(30, -30, q.toward(x, y, z));
    const col = r < 0.6 ? mix(U[3], WHITE, 0.2) : r < 0.9 ? mix(U[5], WHITE, 0.5) : WHITE;
    if (r < 0.6) q.dot(x, y, z, col, (0.35 + 0.5 * tw) * near);
    else if (r < 0.95) {
      q.px(x, y, z, col);
      q.glow(x, y, z, 3, U[5], 0.25 * tw * near);
    } else q.at(x, y, z, (pp) => sparkle(pp, 0, 0, 1 + Math.round(tw * 2), mix(U[5], WHITE, 0.6), U[4], 0.35 * tw * near));
  }
}
