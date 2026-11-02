// Snow driven near-flat by the wind (depth layers of streaks, a gusty wind) after Sprite Fusion's open-source snow
// (https://www.spritefusion.com/pixel-art-vfx/snow), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, smooth, rand, wrap, mix, space, lit, TAU, WHITE } from "../../core/index.js";
import { clip, rows, field, sample, trips } from "./_lib.js";

export const meta = {
  name: "Blizzard",
  desc: "Snow driven almost flat by a gale: streaks at three depths race past, gusts throw translucent sheets of snow across the sky and spindrift streams off the drifts.",
  tags: ["weather", "blizzard", "snow", "wind", "storm", "winter", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 8,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#0d111f", "#182035", "#27324d", "#3e4d6e", "#64779c", "#9cb0d0", "#d8e4f6", "#ffffff"],
    seed: 9,
  },
};

const D = 8;
// gusts: waves of wind rolling left to right, a whole number a loop
const gustAt = (x, t) => 0.5 + 0.5 * Math.sin(TAU * ((x + 160) / 400 - (2 * t) / D) + 0.8);
const bank = (x) => -2 + 1.2 * Math.sin(x * 0.05 + 2) + 0.8 * Math.sin(x * 0.15 + 1);
// far to near: how many, crossings a loop, streak length, fall while crossing, colors (tail, body, head)
const LAYERS = [
  { n: 240, m: [3, 4], len: [2, 4], drop: [10, 40], col: [3, 4, 5] },
  { n: 130, m: [4, 5], len: [5, 8], drop: [20, 60], col: [4, 5, 6] },
  { n: 34, m: [6, 7], len: [10, 16], drop: [30, 70], col: [4, 6, 7], near: true },
];

export function drawBack(p, t, o) {
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 8);
  sheets(p, t, S, C, 0);
  streaks(q, t, S, C, 0);
  streaks(q, t, S, C, 1);
  ground(p, q, t, S, C);
}

export function draw(p, t, o) {
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 8);
  sheets(p, t, S, C, 1);
  streaks(q, t, S, C, 2);
}

// streaks: each slot crosses the canvas a whole number of times a loop at its own height, dipping as it goes;
// the gusts stretch and brighten it
function streaks(q, t, S, C, L) {
  const Ly = LAYERS[L], sd = S * 17 + L, [c0, c1, c2] = Ly.col.map((i) => C[i]);
  trips(t, D, Ly.n, sd, Ly.m[0], Ly.m[1], (u, k, m, i) => {
    const j = wrap(k, m), R = (n) => rand(sd, i, j, n), drop = Ly.drop[0] + R(3) * (Ly.drop[1] - Ly.drop[0]);
    const x = -190 + 380 * u, y = -178 + R(1) * 182 + drop * u + 3 * Math.sin(u * TAU * (1 + R(5)) + R(6) * 6);
    if (y > bank(x) - 1) return;
    const g = gustAt(x, t);
    // between gusts the far snow thins out; in a gust it's everywhere
    if (!Ly.near && R(7) > 0.45 + 0.75 * g) return;
    const L = (Ly.len[0] + R(2) * (Ly.len[1] - Ly.len[0])) * (0.7 + 0.6 * g), dx = 380 / (D / m), dy = drop / (D / m), l = Math.hypot(dx, dy);
    const ux = dx / l, uy = dy / l;
    q.line(x - ux * L, y - uy * L, x - ux * L * 0.45, y - uy * L * 0.45, c0, (v) => 0.3 + 0.7 * v);
    q.line(x - ux * L * 0.45, y - uy * L * 0.45, x - ux, y - uy, c1);
    q.px(x, y, g > 0.6 && Ly.near ? WHITE : c2);
    if (Ly.near) q.glow(x, y, 5, C[5], 0.12 + 0.12 * g);
  });
}

// sheets of blown snow: long thin translucent bands racing with the wind, thick in a gust and thin between
const GX = new Float32Array(320), WV = new Float32Array(320);
function sheets(p, t, S, C, near) {
  const F = field(S * 3 + 7 + near, 256, 128), shift = (256 * (near ? 3 : 2) * t) / D, c = near ? C[6] : C[5], y0 = near ? -110 : -170, haze = mix(C[2], C[3], 0.5);
  const sy = near ? 4.5 : 3.2, th = near ? 0.58 : 0.54;
  for (let i = 0; i < 320; i++) (GX[i] = gustAt(i - 160 + 0.5, t)), (WV[i] = 5 * Math.sin((i - 160) * 0.021 - (TAU * t) / D + near * 2));
  rows(p, meta, y0, 4, (y, R) => {
    const fade = near ? smooth(-110, -40, y) : 1;
    for (let i = 0; i < 320; i++) {
      const g = GX[i], n = sample(F, (i - 160) * 0.16 - shift, (y + WV[i]) * sy + 40), d = (n - th) * 2.2 * (0.35 + g) * fade;
      // the far pass is also the whiteout haze behind everything, thicker in a gust
      if (near) {
        if (d <= 0.02) continue;
        R.c[i] = c;
        R.a[i] = Math.min(0.5, d);
      } else {
        R.c[i] = d > 0.08 ? c : haze;
        R.a[i] = 0.3 + 0.12 * g + Math.min(0.42, Math.max(0, d));
      }
      R.b[i] = 1;
      if (d > 0.05) (R.l[i] = C[5]), (R.k[i] = d * 0.08);
    }
  });
}

// the ground: a low drift with a white crest, spindrift streaming low along it, plumes blown off the crest
function ground(p, q, t, S, C) {
  const F = field(S * 5 + 1, 256, 128), shift = (256 * 4 * t) / D;
  for (let i = 0; i < 320; i++) (GX[i] = gustAt(i - 160 + 0.5, t)), (WV[i] = bank(i - 160 + 0.5));
  rows(p, meta, -16, 9, (y, R) => {
    for (let i = 0; i < 320; i++) {
      const x = i - 160 + 0.5, top = WV[i], d = y - top;
      if (d >= 0) {
        R.c[i] = d < 1 ? WHITE : d < 2 ? C[6] : d < 4 ? C[5] : C[4];
        if (d < 1) (R.l[i] = C[6]), (R.k[i] = 0.1);
        continue;
      }
      // spindrift: a low, fast, streaky haze hugging the drift
      if (y < -14) continue;
      const n = sample(F, x * 0.5 - shift, y * 3 + 9), s = (n - 0.5) * 3 * smooth(-14, -1, y) * (0.4 + GX[i]);
      if (s > 0.02) (R.c[i] = C[6]), (R.a[i] = Math.min(0.55, s)), (R.b[i] = 1);
    }
  });
  // grains skipping along the crest
  trips(t, D, 40, S * 23, 8, 10, (u, k, m, i) => {
    const j = wrap(k, m), x = -175 + 350 * u, y = bank(x) - 1 - rand(S, i, j, 1) * 6 * Math.abs(Math.sin(u * 9 + i));
    q.px(x, y, rand(S, i, j, 2) < 0.5 ? WHITE : C[6]);
    q.px(x - 1, y, C[5]);
  });
}

// ---- 3D: the gale blows along +x through a cylinder of air (radius R3, height H3) over a round snowfield. Streaks
// cross it at real depths, each one's z weaving a little; gusts are slabs of blown snow sliding across the volume,
// thick where the wind is, with soft haze discs that whiten the far side; dunes of snow whip on the floor and grains
// skip along them. Wherever it ends, snow fades out by its distance from the axis.
const R3 = 96, H3 = 100;
const L3 = [
  { n: 300, m: [4, 6], len: [2, 4], drop: [10, 40], col: [3, 4, 5] },
  { n: 220, m: [6, 8], len: [5, 8], drop: [20, 60], col: [4, 5, 6] },
  { n: 90, m: [10, 13], len: [10, 16], drop: [30, 70], col: [5, 6, 7], near: true },
];
const edge3 = (x, z, r = R3) => clamp((r - 5 - Math.sqrt(x * x + z * z)) / 14);

// streaks: each slot crosses the volume a whole number of times a loop at its own height and depth, dipping as it
// goes; the gusts stretch and brighten it
function streaks3(q, t, S, C, L) {
  const Ly = L3[L], sd = S * 17 + L + 40, [c0, c1, c2] = Ly.col.map((i) => C[i]);
  trips(t, D, Ly.n, sd, Ly.m[0], Ly.m[1], (u, k, m, i) => {
    const j = wrap(k, m), R = (n) => rand(sd, i, j, n), drop = Ly.drop[0] + R(3) * (Ly.drop[1] - Ly.drop[0]);
    const z0 = (R(8) * 2 - 1) * (R3 - 6), X = Math.sqrt(R3 * R3 - z0 * z0), ph = u * TAU * (1 + R(5)) + R(6) * 6, per = D / m;
    const x = -X + 2 * X * u, y = -(3 + R(1) * (H3 - 3)) + drop * u + 3 * Math.sin(ph), z = z0 + 4 * Math.sin(ph + 1.3);
    if (y > -1) return;
    const g = gustAt(x, t);
    if (!Ly.near && R(7) > 0.45 + 0.75 * g) return;
    const fa = edge3(x, z);
    if (fa < 0.02) return;
    const len = (Ly.len[0] + R(2) * (Ly.len[1] - Ly.len[0])) * (0.7 + 0.6 * g), dx = (2 * X) / per, dy = drop / per, dz = (4 * Math.cos(ph + 1.3) * TAU * (1 + R(5))) / per;
    const l = Math.hypot(dx, dy, dz), ux = dx / l, uy = dy / l, uz = dz / l, dk = clamp((q.depth(x, y, z) + R3) / (2 * R3)), a = fa * (1 - 0.5 * dk);
    q.line(x - ux * len, y - uy * len, z - uz * len, x - ux * len * 0.45, y - uy * len * 0.45, z - uz * len * 0.45, c0, (v) => a * (0.3 + 0.7 * v));
    q.line(x - ux * len * 0.45, y - uy * len * 0.45, z - uz * len * 0.45, x - ux, y - uy, z - uz, c1, a);
    q.dot(x, y, z, g > 0.6 && Ly.near ? WHITE : c2, a);
    if (Ly.near) q.glow(x, y, z, 5, C[5], (0.12 + 0.12 * g) * fa);
  });
}

// the floor's height: low dunes lying along the wind (long in x, narrow in z), swelling and settling with the gusts
const snowH = (F, u, v, amp) => sample(F, u * 0.055 + 11, v * 0.42 + 5) * amp;

// spindrift ribbons whipped off the dune crests, streaming down the wind and thinning
function crests3(q, t, S, C) {
  const F = field(S * 5 + 1, 256, 128), amp = 1;
  for (let i = 0; i < 26; i++) {
    const a = rand(S, i, 91) * TAU, d = (R3 - 30) * Math.sqrt(rand(S, i, 92)), u0 = Math.cos(a) * d - 8, v0 = Math.sin(a) * d;
    let vc = v0, hb = -1;
    for (let k = -4; k <= 4; k++) {
      const h = snowH(F, u0, v0 + k * 1.5, amp);
      if (h > hb) (hb = h), (vc = v0 + k * 1.5);
    }
    for (let n = 0; n < 2; n++) {
      const f = (rand(S, i, n, 95) + (3 * t) / D + n * 0.5) % 1, px = u0 + f * 46, pz = vc + (rand(S, i, n, 98) - 0.5) * 2;
      const py = -1.5 - f * (3 + rand(S, i, 97) * 6) * Math.sin(Math.PI * Math.min(1, f * 1.5)), fa = Math.sin(Math.PI * f) ** 0.6 * edge3(px, pz);
      if (fa < 0.05) continue;
      const len = 6 + rand(S, i, 99) * 8;
      q.line(px - len, py + 0.5, pz, px, py, pz, C[5], (v) => fa * (0.2 + 0.8 * v));
      q.dot(px, py, pz, C[7], fa);
    }
  }
}

// gust strength and sheet sway by x, a column at a time (the plane shaders below run a pixel at a time)
const GT = new Float32Array(200), WT = new Float32Array(200);
const gustCol = (t) => {
  for (let i = 0; i < 200; i++) GT[i] = gustAt(i - 99.5, t);
  return (u) => GT[u < -100 ? 0 : u >= 100 ? 199 : Math.floor(u + 100)];
};

// the snowfield: dark, quiet, wind-combed snow lit along the dune crests, dissolving into the dark ground at its edge
function field3(q, t, S, C) {
  const F = field(S * 5 + 1, 256, 128), G = field(S * 5 + 2, 256, 128, [4, 8, 16]), R2 = R3 * R3;
  q.plane(0, 0, 0, null, R3 + 1, (u, v, o) => {
    const d2 = u * u + v * v;
    if (d2 > R2) return;
    const d = Math.sqrt(d2) / R3, e = 0.9 + (sample(G, u * 0.45 + 30, v * 0.45 + 12) - 0.5) * 0.5, a = 1 - smooth(e - 0.16, e, d);
    if (a < 0.04) return;
    const h = snowH(F, u, v, 1), s = snowH(F, u - 1.4, v + 1.4, 1) - h, ss = snowH(F, u + 1.4, v - 1.4, 1) - h;
    // faces the light (low towards it), faces away, or flat
    o.c = s < -0.012 ? C[4] : s < -0.006 ? C[3] : ss < -0.008 ? C[1] : h > 0.5 ? C[3] : C[2];
    o.a = a;
    o.blend = a < 0.97;
    if (s < -0.012) (o.l = C[4]), (o.k = 0.04 * a);
  });
}

// grains skipping along the dunes in the wind, low over the floor
function grains3(q, t, S, C) {
  trips(t, D, 70, S * 23 + 3, 8, 10, (u, k, m, i) => {
    const j = wrap(k, m), z = (rand(S, i, j, 3) * 2 - 1) * (R3 - 8), X = Math.sqrt(R3 * R3 - z * z), x = -X + 2 * X * u;
    const y = -1 - rand(S, i, j, 1) * 6 * Math.abs(Math.sin(u * 9 + i)), a = edge3(x, z);
    if (a < 0.02) return;
    q.dot(x, y, z, rand(S, i, j, 2) < 0.5 ? WHITE : C[6], a);
    q.dot(x - 1, y, z, C[5], a);
  });
}

// gusts: slabs of blown snow sliding along the wind, thick where a gust is and thin between, all through the volume
function sheets3(q, t, S, C) {
  const gust = gustCol(t), R2 = R3 * R3;
  [[-24, 0, C[5]], [-62, 1, C[6]]].forEach(([y, k, c]) => {
    const F = field(S * 3 + 7 + k, 256, 128), shift = (256 * (2 + (k & 1)) * t) / D, th = 0.54 + 0.02 * k;
    for (let i = 0; i < 200; i++) WT[i] = 5 * Math.sin((i - 99.5) * 0.021 - (TAU * t) / D + k * 2);
    q.plane(0, y, 0, null, R3, (u, v, o) => {
      const d2 = u * u + v * v;
      if (d2 > R2) return;
      const w = WT[u < -100 ? 0 : u >= 100 ? 199 : Math.floor(u + 100)], s0 = (sample(F, u * 0.16 - shift, (v + w) * 0.45 + 40 * k) - th) * 2.2 * (0.35 + gust(u));
      if (s0 <= 0.02) return;
      const s = s0 * (1 - smooth(0.78, 1, Math.sqrt(d2) / R3));
      if (s <= 0.02) return;
      o.c = c;
      o.a = Math.min(0.45, s);
      o.blend = true;
      if (s > 0.05) (o.l = C[5]), (o.k = s * 0.08);
    });
  });
}

// the whiteout: big soft discs of haze rolling through, thicker and whiter the nearer they are to the viewer
function haze3(q, t, S, C) {
  const items = [];
  for (let i = 0; i < 11; i++) {
    const z = (rand(S, i, 71) * 2 - 1) * (R3 - 30), X = Math.sqrt(R3 * R3 - z * z), f = (rand(S, i, 72) + (2 * t) / D) % 1;
    items.push({ x: X * (2 * f - 1), y: -(10 + rand(S, i, 73) * 70), z, r: 24 + rand(S, i, 74) * 14, a: Math.sin(Math.PI * f) });
  }
  for (const h of q.sort(items, (e) => [e.x, e.y, e.z])) {
    const dk = clamp((q.depth(h.x, h.y, h.z) + R3) / (2 * R3)), g = gustAt(h.x, t), c = mix(C[4], C[6], 0.3 + 0.5 * (1 - dk));
    q.disc(h.x, h.y, h.z, h.r, c, (d) => (1 - d) ** 1.2 * 0.36 * (0.5 + g) * (1.25 - 0.7 * dk) * h.a * edge3(h.x, h.z, 74));
  }
}

export const three = {
  meta: { size: [224, 168], origin: [112, 130], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), S = o.seed, C = fit(o.palette, 8);
    field3(q, t, S, C);
    crests3(q, t, S, C);
    for (let L = 0; L < 3; L++) streaks3(q, t, S, C, L);
    grains3(q, t, S, C);
    sheets3(q, t, S, C);
    haze3(q, t, S, C);
  },
};
