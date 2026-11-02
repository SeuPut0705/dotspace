// The banded fog (a baked tiling noise, warped, cut into a few translucent tones with Bayer edges, a lit crest
// wherever a band's top meets thinner fog) is adapted from Sprite Fusion's open-source fog
// (https://www.spritefusion.com/pixel-art-vfx/fog), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, smooth, mix, rand, space, TAU, WHITE } from "../../core/index.js";
import { rows, field, sample, bayer } from "./_lib.js";

export const meta = {
  name: "Fog",
  desc: "Slow banks of moonlit fog at three depths drift past each other, crests catching the light, while thin streaks of mist slide by in front.",
  tags: ["weather", "fog", "mist", "haze", "night", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 12,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#14121e", "#24213a", "#363250", "#4f4a6c", "#6d688b", "#918cab", "#bdb8d4", "#ece8f6"],
    seed: 5,
  },
};

const D = 12, W = 320;
const T = [0.3, 0.5, 0.7], BW = 0.06;
// far to near: where each bank's top thins out (top..base), how far down it reaches, noise scale (the tile it
// scrolls each loop is 256 / sx px wide), tiles a loop, how opaque, tones [thin, body, dense], crest tone
const BANKS = [
  { top: -84, base: -40, bot: -20, sx: 1.6, sy: 2.2, lap: 1, alpha: 0.24, tone: [2, 3, 4], crest: 5, warp: 16, crestFrom: 3 },
  { top: -62, base: -24, bot: -2, sx: 1.0667, sy: 2.5, lap: 1, alpha: 0.3, tone: [2, 3, 4], crest: 5, warp: 22, crestFrom: 2 },
  { top: -42, base: -8, bot: 10, sx: 0.8, sy: 2.8, lap: 1, alpha: 0.36, tone: [2, 3, 5], crest: 6, warp: 28, crestFrom: 1 },
];
const BR = new Float32Array(W);
const P1 = BANKS.map(() => new Float32Array(W)), P2 = BANKS.map(() => new Float32Array(W)), WARP = new Float32Array(W);

export function drawBack(p, t, o) {
  const S = o.seed, C = fit(o.palette, 8);
  bank(p, t, S, C, 0);
  bank(p, t, S, C, 1);
}

export function draw(p, t, o) {
  const S = o.seed, C = fit(o.palette, 8);
  bank(p, t, S, C, 2);
  streaks(p, t, S, C, 1);
}

function bank(p, t, S, C, n) {
  const B = BANKS[n], F = field(S * 7 + n, 256, 128), G = field(S * 7 + 11, 256, 128, [4, 8, 16]);
  const drift = (256 * B.lap * t) / D, boil = (128 * t) / D, prev1 = P1[n], prev2 = P2[n];
  const tones = B.tone.map((i) => C[i]), crest = mix(C[B.crest], WHITE, 0.12 + 0.08 * n);
  prev1.fill(0);
  prev2.fill(0);
  // the fog breathes: its top rises and falls a little along its length
  for (let i = 0; i < W; i++) BR[i] = 2 * Math.sin((TAU * t) / D + (i - 160) * 0.006 + n * 1.7);
  rows(p, meta, B.top - 2, B.bot, (y, R) => {
    const prof = smooth(B.top, B.base, y) * (1 - smooth(B.bot - (B.bot < 10 ? 14 : 4), B.bot + 1, y));
    for (let i = 0; i < W; i += 2) WARP[i] = WARP[i + 1] = sample(G, i * 0.35 + n * 70, y * 0.5 + boil) - 0.5;
    for (let i = 0; i < W; i++) {
      const x = i - 160 + 0.5, w = WARP[i];
      // the noise is pushed hard and clamped so it, not the height, shapes the fog: blobs, not stripes
      const nn = clamp((sample(F, x * B.sx + drift + w * B.warp, (y + BR[i]) * B.sy + w * 8) - 0.5) * 2.6 + 0.5) - 0.5;
      const f = prof <= 0.01 ? 0 : (prof * 0.72 + nn * 0.95) * (0.6 + 0.5 * prof);
      const above = prev2[i];
      prev2[i] = prev1[i];
      prev1[i] = f;
      if (f <= T[0]) continue;
      const th = bayer(i, y) * BW, band = f > T[2] + th ? 2 : f > T[1] + th ? 1 : 0, solid = f > T[2] ? 2 : f > T[1] ? 1 : 0;
      // a lit crest, one pixel thick, where this band's top meets thinner fog
      if (solid >= B.crestFrom && above < T[solid]) {
        R.c[i] = crest;
        R.a[i] = B.alpha * 0.95;
        R.l[i] = C[6];
        R.k[i] = 0.07;
      } else {
        // dense fog scatters the most moonlight: it's the brightest part, with a little glow
        R.c[i] = tones[band];
        R.a[i] = B.alpha * (0.55 + 0.25 * band);
        if (band === 2) (R.l[i] = C[5]), (R.k[i] = 0.03 + 0.02 * n);
      }
      R.b[i] = 1;
    }
  });
}

// thin streaks of mist sliding by faster than the banks, a few behind the near bank and a few in front
function streaks(p, t, S, C, front) {
  // one tile a loop: the back streaks slide at 43 px/s, the front ones at 53
  const F = field(S * 7 + 20 + front, 256, 128), drift = (256 * t) / D, sx = front ? 0.4 : 0.5, y0 = front ? -40 : -96, y1 = front ? 6 : -30;
  rows(p, meta, y0, y1, (y, R) => {
    const env = smooth(y0, y0 + 10, y) * (1 - smooth(y1 - 10, y1, y));
    for (let i = 0; i < W; i++) {
      const x = i - 160 + 0.5, s = (sample(F, x * sx + drift, y * 6.5 + 30) - 0.64) * 3 * env;
      if (s <= 0.05) continue;
      R.c[i] = s > 0.35 ? C[5] : C[4];
      R.a[i] = Math.min(0.4, s);
      R.b[i] = 1;
      R.l[i] = C[5];
      R.k[i] = s * 0.05;
    }
  });
}

// 3D: the fog as banks you stand among. A cylinder of mist (radius 100) with three sheets of the banded fog laid at
// different heights, patchy so the floor and the far side show through, each turning slowly (whole turns a loop,
// the low one one way, the high one the other) so the banks drift past each other; soft lit puffs heaped in banks
// that hug the floor and thin and lighten with height, and a few long low streaks of mist circling between them.
// Everything thins to nothing towards the rim so the canvas edge never cuts it.
const MOON = [-50, -96, -52];
// low to high (far to near for a camera above): height, radius, noise scale, patchiness, opacity, turns a loop, tones
const SLABS = [
  { y: -2, R: 100, sx: 0.9, dens: 0.3, alpha: 0.3, spin: 1, tone: [2, 3, 4], warp: 24 },
  { y: -14, R: 100, sx: 1.1, dens: 0.24, alpha: 0.2, spin: -1, tone: [3, 4, 5], warp: 20 },
  { y: -28, R: 94, sx: 1.3, dens: 0.2, alpha: 0.13, spin: 1, tone: [4, 5, 5], warp: 16 },
];
// banks of puffs: how many banks, puffs in each, height, radius, turns a loop, opacity, tones, how far a bank spreads
const HEAPS = [
  { banks: 5, per: 4, y: [-3, -9], r: [15, 23], spin: 1, alpha: 0.2, tone: [2, 3, 4], spread: 24 },
  { banks: 4, per: 3, y: [-9, -19], r: [13, 19], spin: -1, alpha: 0.15, tone: [3, 4, 5], spread: 22 },
  { banks: 3, per: 2, y: [-20, -30], r: [12, 17], spin: 1, alpha: 0.1, tone: [4, 5, 5], spread: 20 },
];

// one sheet of fog laid flat at height y: the same warped noise cut into three tones with Bayer edges, turning on
// the spot (the lit crests are the puffs' to carry: on a flat sheet they only scribble)
function sheet(q, t, S, C, B, n) {
  const F = field(S * 7 + n, 256, 128), G = field(S * 7 + 11, 256, 128, [4, 8, 16]);
  const a = (TAU * B.spin * t) / D, ca = Math.cos(a), sa = Math.sin(a), boil = (128 * t) / D;
  const tones = B.tone.map((i) => C[i]), R = B.R, R2 = R * R, r0 = R * 0.8, sc = B.sx, dens = B.dens, cut = T[0] / (dens + 0.475);
  q.plane(0, B.y, 0, null, R, (u, v, out) => {
    const r2 = u * u + v * v;
    if (r2 > R2) return;
    let e = 1;
    if (r2 > r0 * r0) {
      const s = (Math.sqrt(r2) - r0) / (R - r0);
      e = 1 - s * s * (3 - 2 * s);
      if (e <= cut) return;
    }
    const x = u * ca - v * sa, z = u * sa + v * ca;
    const w = sample(G, x * 0.35 + n * 70, z * 0.35 + boil) - 0.5;
    const nn = clamp((sample(F, x * sc + w * B.warp, z * sc + boil * 0.5 + w * 8) - 0.5) * 2.6 + 0.5) - 0.5;
    const f = (dens + nn * 0.95) * e;
    if (f <= T[0]) return;
    const th = bayer(u + 1000, v + 1000) * BW, band = f > T[2] + th ? 2 : f > T[1] + th ? 1 : 0;
    out.blend = true;
    out.c = tones[band];
    out.a = B.alpha * (0.55 + 0.25 * band);
    if (band === 2) (out.l = C[5]), (out.k = 0.03 + 0.015 * n);
  });
}

// a soft translucent puff: like q.disc, but fn(d2, up, out) gets the squared distance from the middle and how far
// up the rim it is (-1 top, 1 bottom) and sets out.c, out.a, so there is no angle to work out per pixel
const PUFF = { c: 0, a: 0 };
function puff(q, x, y, z, r, fn) {
  if (!q.project(x, y, z)) return;
  const p = q.p, cx = q.x, cy = q.y, d0 = q.d, R = r * q.k, R2 = R * R, z0 = p.z, o = PUFF;
  p.each(cx - R, cy - R, cx + R, cy + R, (lx, ly, sx, sy) => {
    const dx = lx - cx, dy = ly - cy, s = (dx * dx + dy * dy) / R2;
    if (s > 1) return;
    fn(s, dy / R, o);
    p.z = d0 - Math.sqrt(1 - s) * r;
    p.blendPx(sx, sy, o.c, o.a);
  });
  p.z = z0;
}

export const three = {
  meta: { size: [236, 150], origin: [118, 95], bg: "ground", camera: { pitch: 0.32 } },
  draw(p, t, o) {
    const q = space(p, o), S = o.seed, C = fit(o.palette, 8);
    SLABS.forEach((B, n) => sheet(q, t, S, C, B, n));
    // puffs heaped on the floor and wisps of mist, all circling, drawn far to near
    const items = [];
    HEAPS.forEach((L, j) => {
      for (let b = 0; b < L.banks; b++) {
        const RB = (k) => rand(S, 40 + j, b, k), ab = (b / L.banks) * TAU + (RB(1) - 0.5) * 0.7 + (TAU * L.spin * t) / D, rb = 26 + RB(2) * 56;
        const rx = Math.cos(ab), rz = Math.sin(ab);
        for (let i = 0; i < L.per; i++) {
          const R = (k) => rand(S, 50 + j, b * 10 + i, k), ang = R(1) * TAU, d = Math.sqrt(R(2)) * L.spread, lat = Math.sin(ang) * d * 0.8 + 5 * Math.sin((TAU * t) / D + R(3) * TAU), along = Math.cos(ang) * d * 1.7;
          const x = rx * (rb + lat) - rz * along, z = rz * (rb + lat) + rx * along, rho = Math.hypot(x, z);
          const r = (L.r[0] + R(4) * (L.r[1] - L.r[0])) * (1 + 0.05 * Math.sin((TAU * t) / D + R(5) * TAU));
          const y = L.y[0] + R(6) * (L.y[1] - L.y[0]) + 1.5 * Math.sin((TAU * t) / D + R(7) * TAU);
          const e = 1 - smooth(62, 100, rho);
          if (e > 0.02) items.push({ x, y, z, r, A: L.alpha * e, j });
        }
      }
    });
    // a few long low streaks of mist, gently curved, soft and three pixels thick
    for (let i = 0; i < 6; i++) {
      const R = (k) => rand(S, 60, i, k), rho = 30 + R(1) * 60, len = (50 + R(2) * 40) / rho, a = R(3) * TAU + (TAU * (R(4) < 0.5 ? 1 : -1) * t) / D;
      const e = 1 - smooth(62, 100, rho), y = -3 - R(5) * 14;
      if (e > 0.02) items.push({ wisp: true, x: Math.cos(a) * rho, y, z: Math.sin(a) * rho, rho, a, len, A: e, R2: R(6) });
    }
    for (const it of q.sort(items, (e) => [e.x, e.y, e.z])) {
      if (it.wisp) {
        // overlapping tiny low-alpha puffs along an arc: a soft band a few pixels thick that swells and thins away
        const n = Math.ceil((it.len * it.rho) / 3);
        for (let k = 0; k < n; k++) {
          const u = (k + 0.5) / n, g = it.a + (u - 0.5) * it.len, s = Math.sin(Math.PI * u), y = it.y + 1.5 * Math.sin(u * 4 + it.R2 * 9), A = 0.26 * s * it.A;
          puff(q, Math.cos(g) * it.rho, y, Math.sin(g) * it.rho, 3.2, (d2, up, out) => ((out.c = C[4]), (out.a = A * (1 - d2))));
        }
        continue;
      }
      // the low banks catch a lit crest along the top of the rim, the dense core is the brightest body
      const A = it.A, lit = it.j < 2, tn = HEAPS[it.j].tone.map((i) => C[i]), crest = mix(C[5], WHITE, 0.1 + 0.05 * it.j);
      puff(q, it.x, it.y, it.z, it.r, (s, up, out) => {
        if (lit && s > 0.36 && up < -0.4) {
          out.c = crest;
          out.a = A * 1.1 * (s > 0.64 ? 1 - (Math.sqrt(s) - 0.8) / 0.2 : 1);
          return;
        }
        out.c = s > 0.38 ? tn[0] : s > 0.1 ? tn[1] : tn[2];
        out.a = A * (s > 0.16 ? 0.5 + 0.5 * (1 - (Math.sqrt(s) - 0.4) / 0.6) : 1);
      });
    }
    // moonlight over it all
    q.glow(MOON[0], MOON[1], MOON[2], 130, C[4], 0.08);
    q.glow(MOON[0], MOON[1], MOON[2], 60, C[5], 0.06);
  },
};
