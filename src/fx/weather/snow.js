// The snow recipe (depth layers falling at their own speeds with a sway, a gusty wind, flakes that settle on a
// drift for a while) is adapted from Sprite Fusion's open-source snow (https://www.spritefusion.com/pixel-art-vfx/snow),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, smooth, rand, wrap, mix, space, fbm, noise2, TAU, WHITE } from "../../core/index.js";
import { clip, pass, trips, bakeFloor3, layFloor3 } from "./_lib.js";

export const meta = {
  name: "Snow",
  desc: "Snow at three depths in a gusty breeze: far specks, drifting flakes, big near crystals that spin and glow; they settle on a sparkling drift and melt away.",
  tags: ["weather", "snow", "winter", "cold", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 12,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#0c1020", "#161d36", "#24304f", "#3a4a72", "#5f74a3", "#93abd6", "#cfe0fa", "#ffffff"],
    seed: 6,
  },
};

const D = 12;
// the drift's top edge, and the gusts: a sway of the whole snowfall, periodic so the loop closes
const bank = (x) => -3 + 1.6 * Math.sin(x * 0.045 + 1.3) + 1.1 * Math.sin(x * 0.12 + 0.4) + 0.6 * Math.sin(x * 0.31 + 2);
const gust = (t) => 10 * Math.sin((TAU * t) / D + 0.6) + 4 * Math.sin((TAU * 2 * t) / D + 2.1);
// far to near: how many, falls a loop, share of a fall spent in the air (the rest lying on the drift), sway, wind
const LAYERS = [
  { n: 230, m: [1, 2], air: 1, sway: [1, 3], wind: 3, gust: 0.4 },
  { n: 140, m: [2, 3], air: 0.8, sway: [3, 7], wind: 6, gust: 0.7 },
  { n: 24, m: [2, 3], air: 0.74, sway: [8, 15], wind: 9, gust: 1 },
];

export function drawBack(p, t, o) {
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 8);
  // a cold haze, thicker low down, so the sky's stars don't read as snow
  const haze = mix(C[1], C[2], 0.4);
  pass(p, meta, -170, 9, (x, y, out) => {
    out.c = haze;
    out.a = 0.26 + 0.22 * smooth(-170, 0, y);
    out.b = 1;
  });
  layer(q, t, S, C, 0);
  drift(q, t, S, C);
  layer(q, t, S, C, 1);
}

export function draw(p, t, o) {
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 8);
  layer(q, t, S, C, 2);
}

function layer(q, t, S, C, L) {
  const Ly = LAYERS[L], sd = S * 13 + L;
  trips(t, D, Ly.n, sd, Ly.m[0], Ly.m[1], (u, k, m, i) => {
    const j = wrap(k, m), dur = D / m, R = (n) => rand(sd, i, j, n);
    const tf = dur * Ly.air, age = Math.min(u * dur, tf), sw = Ly.sway[0] + R(3) * (Ly.sway[1] - Ly.sway[0]), f = 0.25 + R(4) * 0.35, ph = R(5) * TAU;
    const xAt = (a) => -175 + R(2) * 350 + Ly.wind * a + (gust(t - u * dur + a) - gust(t - u * dur)) * Ly.gust + sw * Math.sin(TAU * f * a + ph);
    const x = xAt(age), xl = xAt(tf), y0 = -176, y1 = L ? bank(xl) - 0.5 : -110 + R(1) * 106;
    const y = y0 + (y1 - y0) * (age / tf), rest = u * dur - tf;
    if (L === 0) {
      // far: a speck, thinning out before it's gone
      const a = Math.min(1, (1 - u) * 6);
      q.dot(x, y, R(6) < 0.5 ? C[4] : C[5], a);
      return;
    }
    const fade = rest > 0 ? 1 - rest / (dur - tf) : 1;
    if (L === 1) {
      // a drifting flake: a point with a smaller one beside it, a plus when it's big
      const big = R(6) < 0.3;
      if (rest > 0) return void q.dot(xl, y1, C[7], fade * 0.9);
      q.px(x, y, big ? WHITE : C[7]);
      if (big) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) q.px(x + dx, y + dy, C[5]);
      else (q.px(x + 1, y, C[6]), q.px(x, y + 1, C[6]), q.px(x + 1, y + 1, C[5]));
      return;
    }
    // a near crystal: six arms with side branches, spinning, a white heart, a cold glow; it lies down on the drift
    const r = R(6) < 0.4 ? 3 : R(6) < 0.8 ? 4 : 5, spin = 1.5 + R(7) * 2.5;
    if (rest > 0) {
      q.dot(xl - 1, y1, C[6], fade);
      q.dot(xl, y1, WHITE, fade);
      q.dot(xl + 1, y1, C[6], fade);
      q.glow(xl, y1, 5, C[5], 0.25 * fade);
      return;
    }
    crystal(q, x, y, r, Math.floor(age * spin + R(8) * 2) % 2, C);
  });
}

// a near crystal, kept crisp: long arms on one set of four directions, short ones on the other, nubs near the
// tips; turning means trading which set is long. Plates are a ring round a bright heart.
const AXIS = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [-1, -1], [1, -1], [-1, 1]];
function crystal(q, x, y, r, turn, C) {
  const X = Math.round(x), Y = Math.round(y), long = turn ? DIAG : AXIS, short = turn ? AXIS : DIAG, R = turn ? r - 1 : r;
  // long arms with a white-blue tip; nubs only where they can't touch the next arm, so the gaps stay open
  for (const [dx, dy] of long) {
    for (let d = 1; d <= R; d++) q.px(X + dx * d, Y + dy * d, d === R ? WHITE : C[6]);
    const nubs = turn ? (R >= 3 ? [R - 1] : []) : R >= 5 ? [R - 1, R - 2] : R >= 4 ? [R - 1] : [];
    for (const n of nubs) {
      const ox = turn ? dx : dy, oy = turn ? -dy : -dx;
      q.px(X + dx * n + (turn ? 0 : ox), Y + dy * n + (turn ? oy : oy), C[4]);
      q.px(X + dx * n + (turn ? -dx : -ox) + (turn ? dx : 0), Y + dy * n + (turn ? dy * 0 : -oy), C[4]);
    }
  }
  for (const [dx, dy] of short) for (let d = 1; d <= (turn ? 1 : Math.max(1, Math.floor(R / 2))); d++) q.px(X + dx * d, Y + dy * d, d === 1 ? C[6] : C[5]);
  q.px(X, Y, WHITE);
  // a faint halo, wide enough not to fill the gaps between the arms
  q.glow(X + 0.5, Y + 0.5, r * 2.5 + 5, C[5], 0.13);
  q.light(X, Y, C[6], 0.4);
}

// the drift on the floor: a lumpy bank with a white crest, blue shade below, and glints that twinkle
function drift(q, t, S, C) {
  pass(q, meta, -7, 9, (x, y, out) => {
    const top = bank(x), d = y - top;
    if (d < 0) return;
    out.c = d < 1 ? WHITE : d < 2 ? C[7] : d < 3.5 ? C[6] : d < 6 ? C[5] : C[4];
    if (d < 1) (out.l = C[6]), (out.k = 0.12);
  });
  for (let i = 0; i < 18; i++) {
    const x = -156 + rand(S, i, 81) * 312, c = 1 + Math.floor(rand(S, i, 82) * 3), tw = Math.sin((TAU * c * t) / D + rand(S, i, 83) * TAU);
    if (tw < 0.55) continue;
    const y = Math.ceil(bank(x)) + Math.floor(rand(S, i, 84) * 3), k = (tw - 0.55) / 0.45;
    q.px(x, y, WHITE);
    if (k > 0.5) for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) q.px(x + dx, y + dy, C[6]);
    q.glow(x + 0.5, y + 0.5, 6, C[6], 0.35 * k);
  }
}

// ---- 3D: snow falling through a cylinder of air onto a lumpy snow floor, seen from any side. Specks, flakes and
// crystals are real points in x, y and z, drifting with the wind and swirling as they sway; near crystals are
// billboards of the 2D crystal; flakes that land lie on the floor, crystals lie down flat on it and melt.
const R3 = 96, H3 = 104;
const NEAR = [340, 200, 20];
const edgeFade = (x, z) => 1 - smooth(R3 * 0.85, R3 * 1.1, Math.hypot(x, z));

// a bank under it all, baked once: small lumps (10-18 px) lit from the upper left and the front: lit slopes a step
// brighter, shaded sides a step deeper, a thin pale crest only on the lit lip of a lump. Its edge is ragged: past
// 3/4 of the radius noise decides where it thins out, so the rim dissolves into the dark floor.
function snowFloor(S, C) {
  return bakeFloor3("snow" + S + C.join(), R3, (set) => {
    const h = (x, z) => 2.6 * noise2(x / 16, z / 16, S + 40) + 1.5 * noise2(x / 9, z / 9, S + 49) + 2 * fbm(x / 38, z / 38, S + 53, 2);
    for (let z = -R3; z <= R3; z++)
      for (let x = -R3; x <= R3; x++) {
        const r = Math.hypot(x, z) / R3;
        if (r > 1) continue;
        // the rim: more of it missing the further out, in lumps
        if (r > 0.74 && 0.9 * fbm(x / 15, z / 15, S + 61, 2) + 0.3 * noise2(x / 5, z / 5, S + 67) < -0.5 + ((r - 0.74) / 0.26) * 1.5) continue;
        const hx = (h(x + 1, z) - h(x - 1, z)) / 2, hz = (h(x, z + 1) - h(x, z - 1)) / 2;
        const d = 0.8 * hx - 0.7 * hz;
        set(x, z, d > 0.4 ? C[6] : d > 0.12 ? C[5] : d > -0.16 ? C[4] : C[3]);
      }
  });
}

function flakes3(q, t, S, C, L) {
  const Ly = LAYERS[L], sd = S * 13 + L;
  trips(t, D, NEAR[L], sd, Ly.m[0], Ly.m[1], (u, k, m, i) => {
    const j = wrap(k, m), dur = D / m, R = (n) => rand(sd, i, j, n);
    const tf = dur * Ly.air, age = Math.min(u * dur, tf), rest = u * dur - tf, born = t - u * dur;
    const sw = Ly.sway[0] + R(3) * (Ly.sway[1] - Ly.sway[0]), f = 0.25 + R(4) * 0.35, ph = R(5) * TAU;
    // where it started, anywhere in the disc, and where the wind and its sway have taken it
    const r0 = R3 * (L === 2 ? 0.74 : 1.02) * Math.sqrt(R(2)), g0 = R(12) * TAU, x0 = Math.cos(g0) * r0, z0 = Math.sin(g0) * r0;
    const at = (a) => {
      const dx = Ly.wind * (a - tf / 2) + (gust(born + a) - gust(born + tf / 2)) * Ly.gust + sw * Math.sin(TAU * f * a + ph);
      const dz = 0.45 * (gust(born + a + D / 4) - gust(born + tf / 2 + D / 4)) * Ly.gust + sw * 0.8 * Math.sin(TAU * f * a + ph + 1.6);
      return [x0 + dx, z0 + dz];
    };
    const [x, z] = at(age), [xl, zl] = at(tf), y1 = L ? -0.6 : -H3 + (0.55 + R(1) * 0.45) * H3;
    const y = -H3 + (y1 + H3) * (age / tf), top = smooth(0, 0.07, age / tf);
    if (L === 0) {
      // far: a speck, thinning out before it's gone; the nearer to the viewer, the brighter
      const a = Math.min(1, (1 - u) * 6) * top * edgeFade(x, z);
      if (a < 0.08) return;
      q.project(x, y, z);
      const n = clamp(0.5 - q.d / (2 * R3));
      q.dot(x, y, z, n > 0.62 ? C[5] : n > 0.3 ? C[4] : C[3], a);
      return;
    }
    const fade = rest > 0 ? 1 - rest / (dur - tf) : 1;
    if (L === 1) {
      // a drifting flake: a point with a smaller one beside it, a plus when it's big
      const big = R(6) < 0.3;
      if (rest > 0) {
        const a = fade * 0.9 * edgeFade(xl, zl);
        return void (a > 0.08 && q.dot(xl, y1, zl, C[7], a));
      }
      const a = top * edgeFade(x, z);
      if (a < 0.08) return;
      q.at(x, y, z, (pp) => {
        const put = (dx, dy, c) => (a > 0.95 ? pp.px(dx, dy, c) : pp.dot(dx, dy, c, a));
        put(0, 0, big ? WHITE : C[7]);
        if (big) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(dx, dy, C[5]);
        else (put(1, 0, C[6]), put(0, 1, C[6]), put(1, 1, C[5]));
      });
      return;
    }
    // a near crystal: spinning, a white heart, a cold glow; it lies down flat on the drift and melts
    const r = R(6) < 0.4 ? 3 : R(6) < 0.8 ? 4 : 5, spin = 1.5 + R(7) * 2.5, turn = Math.floor(age * spin + R(8) * 2) % 2;
    if (rest > 0) {
      const a = fade * edgeFade(xl, zl), rr = Math.max(2, Math.round(r * (1 - 0.55 * (rest / (dur - tf)))));
      if (a < 0.15) return;
      q.decal(xl, -0.6, zl, null, 8, (pp) => crystal(pp, 0, 0, rr, turn, C));
      q.glow(xl, -1, zl, 6, C[5], 0.25 * fade * a);
      return;
    }
    const a = top * edgeFade(x, z);
    if (a < 0.1) return;
    q.at(x, y, z, (pp) => {
      if (a > 0.95) return void crystal(pp, 0, 0, r, turn, C);
      // faint at the edge of the volume: the same crystal, dithered
      const soft = { px: (x, y, c) => pp.dot(x, y, c, a), glow: (x, y, r, c, k) => pp.glow(x, y, r, c, k * a), light: (x, y, c, k) => pp.light(x, y, c, k * a) };
      crystal(soft, 0, 0, r, turn, C);
    });
  });
}

export const three = {
  meta: { size: [248, 184], origin: [124, 142], bg: "ground", camera: { pitch: 0.4 } },
  draw(p, t, o) {
    const q = space(p, o), S = o.seed, C = fit(o.palette, 8);
    layFloor3(q, snowFloor(S, C));
    // glints on the drift that twinkle
    for (let i = 0; i < 24; i++) {
      const r = R3 * 0.9 * Math.sqrt(rand(S, i, 85)), g = rand(S, i, 86) * TAU, x = Math.cos(g) * r, z = Math.sin(g) * r;
      const c = 1 + Math.floor(rand(S, i, 82) * 3), tw = Math.sin((TAU * c * t) / D + rand(S, i, 83) * TAU);
      if (tw < 0.55) continue;
      const k = (tw - 0.55) / 0.45;
      q.at(x, -1, z, (pp) => {
        pp.px(0, 0, WHITE);
        if (k > 0.5) for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) pp.px(dx, dy, C[6]);
      });
      q.glow(x, -2, z, 6, C[6], 0.35 * k);
    }
    flakes3(q, t, S, C, 1);
    flakes3(q, t, S, C, 2);
    flakes3(q, t, S, C, 0);
  },
};
