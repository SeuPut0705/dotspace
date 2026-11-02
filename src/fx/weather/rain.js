// The rain recipe (depth layers of two-tone streaks, far drops that end in the air, near ones that splash and
// throw droplets, mist low on the ground) is adapted from Sprite Fusion's open-source rain
// (https://www.spritefusion.com/pixel-art-vfx/rain), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, smooth, rand, wrap, mix, space, TAU, WHITE } from "../../core/index.js";
import { clip, pass, field, sample, trips, crown, bayer, splash3 } from "./_lib.js";

export const meta = {
  name: "Rain",
  desc: "Slanted rain at four depths: far drops fade into the dark, near ones glint and splash, drops ring the puddles and a low mist drifts over the wet floor.",
  tags: ["weather", "rain", "storm", "water", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 8,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#0e1322", "#1a2440", "#283a5e", "#3a5482", "#5674a8", "#84a6d6", "#c0dcf8", "#f2f8ff"],
    density: 1,
    seed: 4,
  },
};

const D = 8, SLANT = -0.2, UX = SLANT / Math.hypot(SLANT, 1), UY = 1 / Math.hypot(SLANT, 1);
// the depths, far to near: how many, falls a loop (speed), streak length, colors (tail, body, head), where
// they end (in the air, or on the floor at depth z), how big their splash
const LAYERS = [
  { n: 200, m: [10, 13], len: 2, col: [2, 2, 3], stop: [-80, -6] },
  { n: 150, m: [14, 17], len: 4, col: [2, 3, 4], stop: [-45, -2] },
  { n: 96, m: [19, 23], len: 7, col: [3, 4, 5], z: [0, 1.4], size: [0.15, 0.4] },
  { n: 42, m: [25, 29], len: 13, col: [3, 5, 7], z: [2, 6.5], size: [0.6, 1], near: true },
];

// puddles on the wet floor: long thin strips that hold the sky, at depth y, from x0 to x1
function pools(S) {
  return Array.from({ length: 5 }, (_, i) => {
    const x = -150 + i * 66 + rand(S, i, 61) * 30, w = 16 + rand(S, i, 63) * 26;
    return { x0: x, x1: x + w, y: 3 + Math.floor(rand(S, i, 62) * 3) };
  });
}
const poolAt = (P, x, y) => P.find((p) => x >= p.x0 + 2 && x <= p.x1 - 2 && Math.abs(y - p.y) < 1.5);

export function drawBack(p, t, o) {
  t = Math.round(t * 3e4) / 3e4;
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 8), P = pools(S);
  // an overcast haze, thicker toward the ground, that hides the stars
  const haze = mix(C[0], C[1], 0.6);
  pass(p, meta, -170, -0.5, (x, y, out) => {
    out.c = haze;
    out.a = 0.3 + 0.26 * smooth(-170, 0, y);
    out.b = 1;
  });
  floor(q, t, S, C, P);
  for (let L = 0; L < 3; L++) layer(q, t, S, C, P, L, o.density);
  mist(p, t, S, C);
}

export function draw(p, t, o) {
  t = Math.round(t * 3e4) / 3e4;
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 8), P = pools(S);
  layer(q, t, S, C, P, 3, o.density);
}

// one depth of rain: each slot falls a whole number of times a loop, somewhere new each time
function layer(q, t, S, C, P, L, density) {
  const Ly = LAYERS[L], sd = S * 11 + L, [c0, c1, c2] = Ly.col.map((i) => C[i]), len = Ly.len;
  const n = Math.round(Ly.n * density), G = field(S + 21, 256, 128, [4, 8, 16]), sweep = (256 * t) / D;
  trips(t, D, n, sd, Ly.m[0], Ly.m[1], (u, k, m, i) => {
    const j = wrap(k, m);
    // gusts: sheets of heavier and lighter rain sweep across with the wind
    if (L < 2 && rand(sd, i, j, 7) > 0.35 + 1.3 * (sample(G, (-166 + rand(sd, i, j, 2) * 332) * 0.8 + sweep, 9 + L * 40) - 0.32)) return;
    const end = Ly.z ? Ly.z[0] + rand(sd, i, j, 1) * (Ly.z[1] - Ly.z[0]) : Ly.stop[0] + rand(sd, i, j, 1) * (Ly.stop[1] - Ly.stop[0]);
    const y0 = -172 - len, y = y0 + (end - y0) * u, x = -166 + rand(sd, i, j, 2) * 332 - (end - y) * SLANT;
    // far drops thin out before they end; near ones are whole
    const a = Ly.z ? 1 : Math.min(1, (1 - u) * 5);
    if (len <= 2) q.dot(x, y, c2, a), q.dot(x - UX, y - UY, c1, a * 0.8);
    else {
      q.line(x - UX * len, y - UY * len, x - UX * len * 0.45, y - UY * len * 0.45, c0, (v) => a * (0.35 + 0.65 * v));
      q.line(x - UX * len * 0.45, y - UY * len * 0.45, x - UX, y - UY, c1, a);
      q.dot(x, y, c2, a);
    }
    // near drops catch the light
    if (Ly.near) q.glow(x, y - 2, 4, C[5], 0.12);
    if (!Ly.z) return;
    // the drops before this one landed: a crown on the ground, or rings sliding apart along a puddle
    const dur = D / m;
    for (let back = 1; back < 4; back++) {
      const age = u * dur + (back - 1) * dur;
      if (age > 0.7) break;
      const jp = wrap(k - back, m), z = Ly.z[0] + rand(sd, i, jp, 1) * (Ly.z[1] - Ly.z[0]), xp = -166 + rand(sd, i, jp, 2) * 332;
      if (rand(sd, i, jp, 5) > (Ly.near ? 1 : 0.7)) continue;
      const size = Ly.size[0] + ((z - Ly.z[0]) / (Ly.z[1] - Ly.z[0])) * (Ly.size[1] - Ly.size[0]), pool = Ly.near && poolAt(P, xp, z);
      if (pool) rings(q, xp, pool, age, C);
      else if (crown(q, xp, z, age, size, { hot: C[6], cool: C[4], white: WHITE }, rand(sd, i, jp, 4)) && Ly.near && age < 0.1) q.glow(xp, z - 1, 5, C[5], 0.3 * (1 - age / 0.1));
    }
  });
}

// a drop in a puddle: a bright point, then rings seen edge-on, so two short dashes sliding apart, twice
function rings(q, x, pool, age, C) {
  const X = Math.round(x), y = pool.y;
  if (age < 0.05) q.px(X, y, C[7]);
  for (let r = 0; r < 2; r++) {
    const a = age - r * 0.16, u = a / 0.5;
    if (u <= 0 || u >= 1) continue;
    const w = Math.round(1 + 7 * Math.sqrt(u)), c = u < 0.4 && !r ? C[6] : C[5];
    for (const s of [-1, 1])
      for (let d = 0; d < (u < 0.6 ? 2 : 1); d++) {
        const px = X + s * (w - d);
        if (px > pool.x0 && px < pool.x1) q.px(px, y, c);
      }
  }
}

// the wet floor: a clean wet edge (a lit lip over a dark line), a dark sheen, puddle strips holding the sky
function floor(q, t, S, C, P) {
  pass(q, meta, 0, 9.5, (x, y, out) => {
    if (y < 1) return void ((out.c = C[4]), (out.l = C[5]), (out.k = 0.08));
    if (y < 2) return void (out.c = C[1]);
    out.c = C[0];
    out.a = 0.55;
    out.b = 1;
    for (const p of P)
      if (x >= p.x0 && x < p.x1 && Math.floor(y) === p.y) {
        const edge = x < p.x0 + 2 || x >= p.x1 - 2;
        out.c = edge ? C[3] : C[4];
        out.a = 1;
        out.b = 0;
        out.l = C[5];
        out.k = 0.06;
      }
  });
  // a glint that slides slowly along each puddle
  P.forEach((p, i) => {
    const gx = Math.round(p.x0 + 3 + (p.x1 - p.x0 - 6) * (0.5 + 0.5 * Math.sin((Math.PI * 2 * t) / D + i * 1.9)));
    q.px(gx, p.y, C[6]);
    q.glow(gx, p.y, 4, C[5], 0.2);
  });
}

// mist kicked up by the rain, drifting low along the ground: soft bands with lit crests
function mist(p, t, S, C) {
  const M = field(S + 9, 256, 128, [4, 8, 16, 32]), drift = (256 * t) / D, crest = mix(C[4], C[5], 0.5);
  const dens = (x, y) => {
    const prof = smooth(-22, -4, y) * (1 - smooth(7, 10, y));
    return prof * (0.62 + (sample(M, x * 0.45 + drift, y * 4 + 30) - 0.5) * 2);
  };
  pass(p, meta, -20, 9, (x, y, out) => {
    const d = dens(x, y);
    if (d < 0.28) return;
    const th = bayer(x, y) * 0.06;
    out.b = 1;
    if (d > 0.46 + th && dens(x, y - 1) < 0.43) (out.c = crest), (out.a = 0.5);
    else (out.c = d > 0.58 + th ? C[4] : C[3]), (out.a = clamp((d - 0.28) * 1.6) * 0.5);
    out.l = C[4];
    out.k = (d - 0.3) * 0.1;
  });
}

// ---- 3D: a column of rain through a cylinder of air (radius R3, height H3, origin at the floor's center) that lands
// on a round wet floor. Drops are streaks at real x, y, z, slanted with the wind; the nearer layers splash into true
// rings and droplets on the floor, rings run over the puddles, and low mist is a handful of soft discs drifting
// along the ground. Everything fades by its distance from the axis so the cylinder never ends in a hard line.
const R3 = 96, H3 = 108;
const L3 = [
  { n: 260, m: [14, 17], len: 2, col: [2, 2, 3] },
  { n: 190, m: [18, 22], len: 4, col: [2, 3, 4] },
  { n: 110, m: [24, 29], len: 7, col: [3, 4, 5], size: [0.15, 0.4], splash: 0.45 },
  { n: 52, m: [32, 38], len: 13, col: [3, 5, 7], size: [0.6, 1], splash: 1, near: true },
];
const edge3 = (x, z, r = R3) => clamp((r - 5 - Math.sqrt(x * x + z * z)) / 14);

// round puddles on the floor
function pools3(S) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = rand(S, i, 64) * TAU, d = (R3 - 34) * Math.sqrt(rand(S, i, 65));
    return { x: Math.cos(a) * d, z: Math.sin(a) * d, r: 10 + rand(S, i, 63) * 9, sx: 1 + rand(S, i, 66) * 0.7, ph: i * 1.9 };
  });
}
const poolAt3 = (P, x, z) => P.find((p) => Math.hypot((x - p.x) / p.sx, z - p.z) < p.r - 2);

function floor3(q, t, S, C, P) {
  const F = field(S + 21, 256, 128, [4, 8, 16, 32]);
  // a dark wet sheen with a lit lip all round
  q.plane(0, 0, 0, null, R3 + 1, (u, v, o) => {
    const d = Math.hypot(u, v) / R3;
    if (d > 1) return;
    if (d > 0.975) return void ((o.c = d > 0.99 ? C[2] : C[3]), (o.l = C[4]), (o.k = 0.06));
    const wet = sample(F, u * 1.1 + 40, v * 1.1 + 12);
    o.c = wet > 0.52 ? C[1] : C[0];
    o.a = 0.42 + 0.3 * smooth(0.5, 0.95, wet);
    o.blend = true;
  });
  // puddles hold the sky, with a glint that slides across each
  P.forEach((pp) => {
    const gl = pp.r * 0.6 * Math.sin((TAU * t) / D + pp.ph);
    q.plane(pp.x, 0, pp.z, null, pp.r * pp.sx + 1, (u, v, o) => {
      const d = Math.hypot(u / pp.sx, v);
      if (d > pp.r) return;
      const rim = d > pp.r - 1.6, g = Math.abs(u * 0.6 + v * 0.8 - gl);
      o.c = rim ? C[3] : g < 1.2 ? C[4] : d < pp.r * 0.5 ? mix(C[2], C[3], 0.5) : C[2];
      o.l = C[4];
      o.k = rim ? 0.06 : g < 1.2 ? 0.1 : 0.03;
    });
  });
}

// a drop in a puddle: a bright point, then two rings spreading out, a little apart
function ripple3(q, x, z, age, a, C) {
  if (age < 0.05) q.px(x, -0.6, z, C[7]);
  for (let r = 0; r < 2; r++) {
    const u = (age - r * 0.16) / 0.5;
    if (u <= 0 || u >= 1) continue;
    const rad = 1 + 8 * Math.sqrt(u), n = Math.ceil(rad * 6), c = u < 0.4 && !r ? C[6] : C[5];
    for (let j = 0; j < n; j++) {
      const g = (j / n) * TAU;
      q.dot(x + Math.cos(g) * rad, -0.6, z + Math.sin(g) * rad, c, a * 0.8 * (u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4));
    }
  }
}

// one depth of rain: each slot falls a whole number of times a loop, somewhere new each time
function layer3(q, t, S, C, P, L, density) {
  const Ly = L3[L], sd = S * 11 + L + 100, [c0, c1, c2] = Ly.col.map((i) => C[i]), len = Ly.len, n = Math.round(Ly.n * density);
  const at = (i, j) => {
    const g = rand(sd, i, j, 6) * TAU, r = (R3 - 10) * Math.sqrt(rand(sd, i, j, 2));
    return [Math.cos(g) * r, Math.sin(g) * r];
  };
  const G = field(S + 21, 256, 128, [4, 8, 16]), sweep = (256 * t) / D;
  trips(t, D, n, sd, Ly.m[0], Ly.m[1], (u, k, m, i) => {
    const j = wrap(k, m), [xm, zm] = at(i, j), y = (-H3 - len) * (1 - u);
    // gusts: sheets of heavier and lighter rain sweep across with the wind
    const gust = L < 2 ? rand(sd, i, j, 7) <= 0.35 + 1.3 * (sample(G, (xm + 100) * 0.8 + sweep, 9 + L * 40 + zm * 0.5) - 0.32) : true;
    const x = xm - (-H3 / 2 - y) * SLANT, f = gust ? edge3(x, zm) * smooth(-H3, -H3 + 16, y) : 0;
    if (f > 0.02) {
      const dk = clamp((q.depth(x, y, zm) + R3) / (2 * R3)), a = f * (1 - 0.5 * dk);
      if (len <= 2) (q.dot(x, y, zm, c2, a), q.dot(x - UX, y - UY, zm, c1, a * 0.8));
      else {
        q.line(x - UX * len, y - UY * len, zm, x - UX * len * 0.45, y - UY * len * 0.45, zm, c0, (v) => a * (0.35 + 0.65 * v));
        q.line(x - UX * len * 0.45, y - UY * len * 0.45, zm, x - UX, y - UY, zm, c1, a);
        q.dot(x, y, zm, c2, a);
      }
      if (Ly.near) q.glow(x, y - 2, zm, 4, C[5], 0.12 * f);
    }
    if (!Ly.size) return;
    // the drops before this one landed: a splash on the floor, or rings running over a puddle
    const dur = D / m;
    for (let back = 1; back < 4; back++) {
      const age = u * dur + (back - 1) * dur;
      if (age > 0.5) break;
      const jp = wrap(k - back, m), [xp0, zp] = at(i, jp), xp = xp0 - (-H3 / 2) * SLANT, fl = edge3(xp, zp);
      if (fl <= 0.02 || rand(sd, i, jp, 5) > Ly.splash) continue;
      const size = Ly.size[0] + rand(sd, i, jp, 8) * (Ly.size[1] - Ly.size[0]), pool = poolAt3(P, xp, zp);
      if (pool) ripple3(q, xp, zp, age, fl, C);
      else if (splash3(q, xp, zp, age, size, { hot: C[6], cool: C[4] }, rand(sd, i, jp, 4), fl) && Ly.near && age < 0.1) q.glow(xp, -2, zp, 5, C[5], 0.3 * (1 - age / 0.1) * fl);
    }
  });
}

// mist kicked up by the rain: soft discs hugging the floor, drifting along it with the wind and thinning at each end
const RM = 76;
function mist3(q, t, S, C) {
  const crest = mix(C[4], C[5], 0.5), items = [];
  for (let i = 0; i < 18; i++) {
    const z = (rand(S, i, 81) * 2 - 1) * (RM - 12), half = Math.sqrt(RM * RM - z * z), f = (rand(S, i, 82) + t / D) % 1;
    items.push({ x: half * (1 - 2 * f), y: -(3 + rand(S, i, 83) * 7), z, r: 9 + rand(S, i, 84) * 8, a: Math.sin(Math.PI * f) });
  }
  for (const m of q.sort(items, (e) => [e.x, e.y, e.z]))
    q.disc(m.x, m.y, m.z, m.r, (d, g) => (g < -0.4 && d > 0.45 ? crest : C[3]), (d) => (1 - d) ** 1.2 * 0.5 * m.a * edge3(m.x, m.z, RM + 4));
}

export const three = {
  meta: { size: [224, 180], origin: [112, 142], bg: "ground", camera: { pitch: 0.34 } },
  draw(p, t, o) {
    t = Math.round(t * 3e4) / 3e4;
    const q = space(p, o), S = o.seed, C = fit(o.palette, 8), P = pools3(S);
    floor3(q, t, S, C, P);
    for (let L = 0; L < 4; L++) layer3(q, t, S, C, P, L, o.density);
    mist3(q, t, S, C);
  },
};
