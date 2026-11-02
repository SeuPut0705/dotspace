// The layered flame tongue is adapted from Sprite Fusion's open-source fire
// (https://www.spritefusion.com/pixel-art-vfx/fire), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, mix, hex, rand, clamp, smooth, space, TAU, WHITE } from "../../core/index.js";
import { noiseFor, hotFirst, flameTongue, smokePuff, looped, drift, floorLight, floorGlow, torus } from "./_lib.js";

export const meta = {
  name: "Candle",
  desc: "A wax candle in a brass dish: a calm flame with a blue root that sways and stretches, a halo of light, motes drifting in it, a bead of wax running down a drip.",
  tags: ["fire", "candle", "prop", "light", "calm", "ambient", "loop"],
  size: [56, 76],
  origin: [28, 64],
  duration: 4,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
    root: ["#1b2a8a", "#3a62e0", "#7fb4ff"],
    wax: ["#2e201e", "#5e4436", "#8e6e58", "#b8957a", "#d8b896", "#f0dcc0"],
    brass: ["#2a1a10", "#6a4a1e", "#b4862e", "#e8c060", "#fff0b0"],
    seed: 2,
  },
};

const D = meta.duration, NL = noiseFor(D), TOP = -16, WICK = TOP - 3;
// a calm flame: an orange rim round gold, yellow, a pale heart and a small white core low down
const CALM = [[1, 1, 5], [0.8, 0.88, 3], [0.6, 0.72, 2], [0.38, 0.52, 1], [0.18, 0.3, 0]];
// the bead runs down this drip, from the rim to its bulb
const DRIP = { x: 4, y0: TOP + 2, y1: -7 };

function dish(p, B, H, fl) {
  p.ellipse(0, 1, 10, 2.6, (d, a) => (d > 0.82 ? B[0] : Math.sin(a) < -0.2 ? (d > 0.6 ? mix(B[3], H[3], 0.3 * fl) : B[2]) : d > 0.55 ? B[1] : B[2]));
  p.rect(-8, 2, 17, 1, B[1]);
  p.rect(-7, 3, 15, 1, B[0]);
}

// the candle: a wax pillar with a dark outline, a highlight band on the lit side, a shadow side, a pool of
// melted wax lit by the flame, a long glossy drip down the right ending in a bulb and a short one on the left
function candle(p, X, H, fl) {
  const L = TOP, cols = [X[1], X[4], X[5], X[4], X[4], X[3], X[3], X[2], X[0]];
  for (let i = 0; i < 9; i++) {
    const x = i - 4;
    p.rect(x, L + 1, 1, -L - 2, cols[i]);
    if (i === 2) p.rect(x, -8, 1, 7, X[4]);
  }
  p.rect(-3, -1, 7, 1, X[2]);
  p.px(-4, -1, X[0]);
  p.px(4, -1, X[0]);
  // the rim and the pool of melted wax round the wick, lit by the flame
  p.rect(-3, L, 7, 1, mix(X[5], H[2], 0.25 * fl));
  p.px(-4, L, X[1]);
  p.px(4, L, X[1]);
  p.rect(-2, L + 1, 5, 1, mix(X[5], H[1], 0.5 * fl));
  p.rect(-1, L + 1, 3, 1, mix(X[4], H[2], 0.45 * fl));
  // the long drip: a lighter, glossy run down the right that bulges past the side into a bulb
  const y1 = DRIP.y1;
  p.rect(3, L + 1, 1, y1 - L - 1, X[4]);
  p.rect(4, L + 2, 1, y1 - L - 2, X[3]);
  p.px(5, L + 3, X[0]);
  p.rect(5, L + 4, 1, y1 - L - 4, X[0]);
  p.rect(3, y1, 2, 2, X[4]);
  p.px(5, y1, X[3]);
  p.px(5, y1 + 1, X[2]);
  p.px(6, y1, X[0]);
  p.px(6, y1 + 1, X[0]);
  p.rect(3, y1 + 2, 3, 1, X[0]);
  p.px(3, L + 2, X[5]);
  // the short drip on the left
  p.rect(-4, L + 1, 1, 4, X[4]);
  p.px(-5, L + 3, X[1]);
  p.px(-5, L + 4, X[1]);
  p.px(-4, L + 5, X[3]);
}

export function draw(p, t, o) {
  const F = fit(o.palette, 9), H = hotFirst(F), RT = fit(o.root, 3), X = fit(o.wax, 6), B = fit(o.brass, 5), S = o.seed;
  // calm: everything moves slowly, the flame now and then stretches tall
  const N = (rate, seed = 0, off = 0) => NL(t, rate * 0.35, seed, off);
  const fl = 0.86 + 0.08 * NL(t, 2, S + 1) + 0.06 * NL(t, 7, S + 2), stretch = Math.max(0, NL(t, 0.75, S + 3) - 0.3) * 0.6;
  const h = 12 * (1 + stretch) * (0.94 + 0.06 * fl), sway = NL(t, 0.5, S + 4) * 1.6 + NL(t, 1.5, S + 5) * 0.5;
  const GLOW = mix(mix(H[3], H[4], 0.5), WHITE, 0.3), cy = WICK - h * 0.4;

  // a pool of warm light on the floor and the halo behind the flame
  floorLight(p, 0, 1, 26, 5, GLOW, 0.3 * fl);
  p.glow(sway * 0.3, cy, 38 * fl, GLOW, 0.42 * fl);
  p.glowRing(sway * 0.3, cy, 10, 4, H[2], 0.12 * fl);
  dish(p, B, H, fl);
  candle(p, X, H, fl);
  // the bead of wax: it swells at the rim, runs down the drip and sets into its bulb
  const run = (t % D) / D, swell = smooth(0, 0.3, run), slide = smooth(0.3, 0.85, run), set = smooth(0.85, 1, run);
  if (set < 1 && swell > 0.15) {
    const by = Math.round(DRIP.y0 + (DRIP.y1 - DRIP.y0) * slide);
    p.px(DRIP.x, by, mix(X[5], H[1], 0.4 * fl));
    if (swell > 0.6 && set < 0.5) p.px(DRIP.x + 1, by, X[4]), p.px(DRIP.x + 1, by + 1, X[2]);
  }
  // the wick, glowing at its tip
  p.line(0, TOP, 0, WICK + 1, X[0]);
  p.px(0, WICK + 1, H[4]);
  // the flame and its blue root
  flameTongue(p, 0, WICK + 1, h, 2.6, sway, N, S * 31, H, CALM, 0.25, 0.6);
  for (let dx = -2; dx <= 2; dx++) {
    const a = 1 - Math.abs(dx) * 0.2;
    p.dot(dx, WICK + 1, Math.abs(dx) === 2 ? RT[0] : RT[1], a);
    if (Math.abs(dx) <= 1) p.dot(dx, WICK + 2, RT[0], 0.7);
  }
  p.px(0, WICK, RT[2]);
  // a thread of smoke now and then off the tip
  looped(t, D, 6, S + 300, (r) => ({ vx: r.range(-1.5, 1.5), vy: -r.range(8, 12), life: r.range(1.4, 2.2), s: r.range(0.8, 1.2) }), (q, age) => {
    const [x, y] = drift(sway, WICK - h, q.vx, q.vy, age, 1, -6, 1, 0.8);
    smokePuff(p, x + NL(t - age, 0.6, S + 60) * (1 + age * 2), y, 1 - age / q.life, q.s, 0, false, 0.6);
  });
  // motes drifting in the candlelight, catching it as they pass close
  looped(t, D, 10, S + 400, (r) => ({ x: r.range(-20, 20), y: r.range(-44, -8), vx: r.range(-3, 3), vy: r.range(-4, 2), life: r.range(2.5, 4), ph: r.range(0, 6.3) }), (q, age) => {
    const x = q.x + q.vx * age + Math.sin(age * 1.3 + q.ph) * 2, y = q.y + q.vy * age, d = Math.hypot(x, y - cy);
    const k = Math.min(1, age * 2, (q.life - age) * 2) * clamp(1.2 - d / 26);
    if (k > 0.15) p.dot(x, y, k > 0.6 ? H[1] : H[3], k), p.glow(x, y, 3, H[2], 0.2 * k);
  });
  // the hot core of the light
  p.glow(sway * 0.5, WICK - h * 0.3, 10, H[1], 0.35 * fl);
}

// 3D: a true round pillar of wax in a round brass dish, a pool of melted wax on top, drips down real sides of it; the flame
// is the same from every side and stays upright, its smoke and the motes in its light spread through the air all round.
const RW = 4.4;

export const three = {
  meta: { size: [72, 88], origin: [36, 76], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const F = fit(o.palette, 9), H = hotFirst(F), RT = fit(o.root, 3), X = fit(o.wax, 6), B = fit(o.brass, 5), S = o.seed, q = space(p, o);
    const N = (rate, seed = 0, off = 0) => NL(t, rate * 0.35, seed, off);
    const fl = 0.86 + 0.08 * NL(t, 2, S + 1) + 0.06 * NL(t, 7, S + 2), stretch = Math.max(0, NL(t, 0.75, S + 3) - 0.3) * 0.6;
    const h = 12 * (1 + stretch) * (0.94 + 0.06 * fl), sway = NL(t, 0.5, S + 4) * 1.6 + NL(t, 1.5, S + 5) * 0.5;
    const GLOW = mix(mix(H[3], H[4], 0.5), WHITE, 0.3), cy = WICK - h * 0.4;
    // how a point of a wall faces: screen right and towards the viewer, for its angle round the pillar
    const face = (g) => q.view(Math.cos(g), 0, Math.sin(g));
    const WAX = [X[1], X[4], X[5], X[4], X[4], X[3], X[3], X[2], X[0]];
    // the dish: a round tray, its lit rim, a dark underside, a floor of brass catching the flame
    for (let y = 0.6; y <= 3.6; y += 0.7) q.ring(0, y, 0, 10 - (y - 0.6) * 0.45, 2, (w, g) => (y > 2.7 ? B[0] : face(g)[0] < -0.1 ? B[2] : B[1]));
    torus(q, 0, 1.2, 0, 9, 2.6, (g, v) => (v > 0.85 ? B[0] : face(g)[0] < -0.1 ? mix(B[4], H[3], 0.3 * fl) : B[2]));
    q.plane(0, 0.3, 0, null, 10, (u, v) => {
      const d = Math.hypot(u, v) / 10;
      if (d > 0.82) return d > 0.95 ? B[0] : mix(B[3], H[3], 0.3 * fl);
      return d > 0.5 ? B[2] : mix(B[3], H[3], 0.2 * fl * (1 - d));
    });
    // the pillar: lit left, shadowed right, the 2D candle's nine columns turned round it
    q.beam(0, TOP + RW, 0, 0, -RW, 0, RW * 2, X[4]);
    for (let y = TOP; y <= -0.4; y += 0.5)
      q.ring(0, y, 0, RW, 1.9, (w, g) => {
        const [nx, , nz] = face(g);
        return nz < 0.12 ? X[0] : y > -8 && y < -1 && nx < -0.35 && nx > -0.85 ? X[4] : WAX[Math.max(0, Math.min(8, Math.round((nx + 1) * 4)))];
      });
    q.ring(0, -0.5, 0, RW + 0.8, 1.2, X[2]);
    // the rim and the pool of melted wax round the wick, lit by the flame
    q.plane(0, TOP, 0, null, RW + 0.4, (u, v) => {
      const d = Math.hypot(u, v) / (RW + 0.4);
      return d > 0.88 ? X[1] : d > 0.55 ? mix(X[5], H[2], 0.25 * fl) : mix(X[4], H[2], 0.45 * fl);
    });
    // the long drip, a bulb at its foot, and a short one on the other side
    const dr = (a, len, w, bulb) => {
      const x = Math.cos(a) * (RW + 0.1), z = Math.sin(a) * (RW + 0.1);
      q.beam(x, TOP + 0.5, z, x, TOP + len, z, w, (u, v) => (v > 0.7 ? X[3] : X[4]));
      if (bulb) q.ball(x * 1.12, TOP + len + 0.4, z * 1.12, 1.7, (nx, ny, nz) => (nz < 0.3 ? X[3] : nx < -0.2 && ny < 0 ? X[5] : X[4]));
    };
    dr(0.5, 9, 1.6, true);
    dr(2.9, 4, 1.3, false);
    // the bead of wax: it swells at the rim, runs down the drip and sets into its bulb
    const run = (t % D) / D, swell = smooth(0, 0.3, run), slide = smooth(0.3, 0.85, run), set = smooth(0.85, 1, run);
    if (set < 1 && swell > 0.15) q.ball(Math.cos(0.5) * (RW + 0.8), TOP + 1 + (DRIP.y1 - DRIP.y0) * slide + 1, Math.sin(0.5) * (RW + 0.8), 0.9, mix(X[5], H[1], 0.4 * fl));
    // the wick, glowing at its tip
    q.beam(0, TOP, 0, 0, WICK + 1, 0, 0.9, X[0]);
    q.px(0, WICK + 1, 0, H[4]);
    // the flame and its blue root: upright, the same from every side
    q.at(sway * 0.3, WICK + 1, 0, (pp) => {
      flameTongue(pp, 0, 0, h, 2.6, sway, N, S * 31, H, CALM, 0.25, 0.6);
      for (let dx = -2; dx <= 2; dx++) {
        const a = 1 - Math.abs(dx) * 0.2;
        pp.dot(dx, 0, Math.abs(dx) === 2 ? RT[0] : RT[1], a);
        if (Math.abs(dx) <= 1) pp.dot(dx, 1, RT[0], 0.7);
      }
      pp.px(0, -1, RT[2]);
    });
    // a pool of warm light on the floor, the halo round the flame and its hot core
    floorGlow(q, 0, 0, 28, GLOW, 0.3 * fl);
    q.glow(sway * 0.3, cy, 0, 38 * fl, GLOW, 0.42 * fl);
    q.at(sway * 0.3, cy, 0, (pp) => pp.glowRing(0, 0, 10, 4, H[2], 0.12 * fl));
    q.glow(sway * 0.5, WICK - h * 0.3, 0, 10, H[1], 0.35 * fl);
    // motes drifting in the candlelight, catching it as they pass close
    looped(t, D, 14, S + 400, (r) => {
      const a = r.range(0, TAU), d = Math.sqrt(r.next()) * 22;
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, y: r.range(-44, -8), vx: r.range(-3, 3), vz: r.range(-3, 3), vy: r.range(-4, 2), life: r.range(2.5, 4), ph: r.range(0, 6.3) };
    }, (m, age) => {
      const x = m.x + m.vx * age + Math.sin(age * 1.3 + m.ph) * 2, y = m.y + m.vy * age, z = m.z + m.vz * age + Math.cos(age * 1.1 + m.ph) * 2, d = Math.hypot(x, y - cy, z);
      const k = Math.min(1, age * 2, (m.life - age) * 2) * clamp(1.2 - d / 26);
      if (k > 0.15) q.dot(x, y, z, k > 0.6 ? H[1] : H[3], k), q.glow(x, y, z, 3, H[2], 0.2 * k);
    });
    // a thread of smoke now and then off the tip, drifting every way
    const smoke = [];
    looped(t, D, 6, S + 300, (r) => ({ a: r.range(0, TAU), vx: r.range(-1.5, 1.5), vy: -r.range(8, 12), life: r.range(1.4, 2.2), s: r.range(0.8, 1.2) }), (m, age) => {
      const [x, y] = drift(sway, WICK - h, m.vx, m.vy, age, 1, -6, 1, 0.8), w = NL(t - age, 0.6, S + 60) * (1 + age * 2);
      smoke.push([x + w * Math.cos(m.a) + Math.cos(m.a) * age * 2, y, w * Math.sin(m.a) + Math.sin(m.a) * age * 2, 1 - age / m.life, m.s]);
    });
    for (const [x, y, z, k, s] of q.sort(smoke, (e) => e)) q.at(x, y, z, (pp) => smokePuff(pp, 0, 0, k, s, 0, false, 0.6));
  },
};
