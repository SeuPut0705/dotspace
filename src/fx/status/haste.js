// The banded after-images, the dotted speed lines with bright heads and the kicked-up dust are
// adapted from Sprite Fusion's open-source movement dash (https://www.spritefusion.com/pixel-art-vfx/movement),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { cycle, fit, hex, luma, rand, space, TAU } from "../../core/index.js";
import { shape, colorAt, travel, lift } from "./_lib.js";

export const meta = {
  name: "Haste",
  desc: "Sped up: striped after-images stream out behind, speed lines whip past, dust kicks off the heels and the leading edge catches the wind. Faces right.",
  tags: ["status", "haste", "speed", "fast", "buff", "directional", "loop"],
  size: [100, 56],
  origin: [64, 48],
  duration: 1.2,
  loop: true,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: ["#4c25ab", "#773ae4", "#5b6cff", "#5eb0ff", "#a3dcff", "#ccf6ff", "#ffffff"], dust: "#8a8090", seed: 4 },
};

const RUN = { turn: 0.25, lean: 4 };
const R1 = { ...RUN, crouch: 3, ffx: 12, ffy: -5, fbx: -10, fby: -8, toeB: true, fx: -7, fy: -19, bx: 12, by: -27 };
const R2 = { ...RUN, crouch: 1, ffx: 4, ffy: -8, fbx: -1, fby: -5, fx: 3, fy: -18, bx: 5, by: -19 };
const R3 = { ...RUN, crouch: 3, ffx: -10, ffy: -8, toeF: true, fbx: 12, fby: -5, fx: 14, fy: -27, bx: -5, by: -19 };
const R4 = { ...RUN, crouch: 1, ffx: -1, ffy: -5, fbx: 4, fby: -8, fx: 5, fy: -19, bx: 3, by: -18 };
export const act = {
  onBody: true,
  follow: 0,
  poses: [[0, R1], [0.1, R2, "snap"], [0.2, R3, "snap"], [0.3, R4, "snap"], [0.4, R1, "snap"], [0.5, R2, "snap"], [0.6, R3, "snap"], [0.7, R4, "snap"], [0.8, R1, "snap"], [0.9, R2, "snap"], [1, R3, "snap"], [1.1, R4, "snap"], [1.2, R1, "snap"]],
};

const D = meta.duration;

// the character's shading in three levels (dark outline, mid, light), for the after-images
const LEVELS = new WeakMap();
function levels(a) {
  let l = LEVELS.get(a.mask);
  if (l) return l;
  const S = shape(a);
  l = S.body.map(([x, y]) => {
    const v = luma(colorAt(a, x, y));
    return [x, y, v < 0.24 ? 1 : v < 0.66 ? 2 : 3];
  });
  LEVELS.set(a.mask, l);
  return l;
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 7), a = o.actor, L = levels(a), S = shape(a), f = Math.floor(t * 30);
  // three after-images trailing back, each a step colder and cut into thinner stripes that scroll, jittering
  for (let g = 3; g >= 1; g--) {
    const dx = -g * 14 - Math.round(rand(f >> 1, g, 3) * 1.6), every = [0, 3, 4, 0][g];
    // its outline, solid near, broken further back, and a few scrolling stripes across it
    p.outline(a.mask, a.x + dx, a.y, (mx, my) => (g === 3 && (mx + my) % 2 ? 0 : C[5 - g]));
    if (every)
      for (const [x, y, v] of L) {
        if ((((y + f) % every) + every) % every) continue;
        p.px(a.x + x + dx, a.y + y, C[Math.max(0, Math.min(6, 5 - g + v - 2))]);
      }
    p.glow(a.x + a.w / 2 + dx, a.y + a.h * 0.45, 16, C[3], 0.12 * (1 - g * 0.25));
  }
  // a smear streaming off the trailing edge
  for (const [x, y, dir] of S.side) {
    if (dir > 0 || (y + (f >> 1)) % 3) continue;
    const len = 3 + Math.floor(rand(y, f >> 1, 5) * 6);
    for (let d = 1; d <= len; d++) p.dot(a.x + x - d, a.y + y, d < 3 ? C[5] : C[4], 1 - d / (len + 1));
  }
  // speed lines whipping past behind
  lines(p, C, a, t, o.seed, false);
  // dust kicked off the heels, rolling away behind
  const dust = hex(o.dust);
  cycle(t, D, 12, o.seed + 5, (r) => r.range(0.45, 0.7), (age, life, r, i) => {
    const u = age / life, foot = i % 2 ? -7 : 3, x = foot + travel(-r.range(50, 100), 0, 3.5, age), y = -1.5 - travel(r.range(6, 18), 0, 3.5, age);
    const rad = r.range(2.6, 4.6) * (0.6 + 1 * u), k = Math.pow(1 - u, 1.2) * Math.min(1, u * 10);
    p.disc(x, y, rad, dust, k * 0.5);
    p.disc(x + rad * 0.05, y + rad * 0.08, rad * 0.74, dust, k * 0.62);
    p.disc(x - rad * 0.22, y - rad * 0.3, rad * 0.5, C[5], k * 0.25);
  });
}

// streaks: a bright head, a coloured body, a dotted tail thinning out behind (some cut across the body in front)
function lines(p, C, a, t, seed, front) {
  cycle(t, D, front ? 5 : 11, seed + (front ? 9 : 7), (r) => r.range(0.12, 0.26), (age, life, r) => {
    const u = age / life, y = a.y + r.range(2, a.h - 3), len = r.range(10, 26) * (front ? 0.7 : 1);
    const x = r.range(-14, 4) - age * r.range(160, 240);
    for (let d = 0; d < len; d++) {
      if (d > len * 0.45 && d % 2) continue;
      p.dot(x + d, y, d < 2 ? C[6] : d < len * 0.4 ? C[5] : C[3], (1 - d / len) * (1 - u) * (front ? 0.7 : 1.1));
    }
    p.light(x, y, C[4], 0.4 * (1 - u));
  });
}

export function draw(p, t, o) {
  const C = fit(o.palette, 7), a = o.actor, S = shape(a);
  // the leading edge catches the wind: a bright rim, flickering
  for (const [x, y, dir] of S.side) if (dir > 0 && rand(x, y, Math.floor(t * 15)) < 0.85) p.px(a.x + x, a.y + y, rand(y, Math.floor(t * 15), 2) < 0.3 ? C[6] : C[5]);
  lines(p, C, a, t, seed(o), true);
  // a cool glow streaming off the back
  p.glow(-6, a.y + a.h * 0.5, 22, C[3], 0.16);
  p.glow(0, a.y + a.h * 0.45, 30, C[3], 0.16);
  p.glow(a.x + a.w, a.y + a.h * 0.5, 10, C[5], 0.12 + 0.06 * Math.sin((t / D) * TAU * 3));
}
const seed = (o) => o.seed;

// 3D: it runs towards +x. The striped after-images are upright copies of the body strung out behind it along the
// run; speed lines whip past in the whole volume round it (some in front of him, some behind), a pair of wind
// ribbons spiral off the back, streaks scroll over the floor and the dust fans out behind the heels.
export const three = {
  meta: { size: [140, 100], origin: [70, 76], bg: "ground", camera: { pitch: 0.28 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 7), a = o.actor, S = shape(a), L = levels(a), f = Math.floor(t * 30), cy = lift(q, a.y + a.h * 0.45);
    // the leading edge catches the wind: a bright rim, flickering
    for (const [x, y, dir] of S.side) if (dir > 0 && rand(x, y, Math.floor(t * 15)) < 0.85) p.px(a.x + x, a.y + y, rand(y, Math.floor(t * 15), 2) < 0.3 ? C[6] : C[5]);
    // three after-images trailing back along the run, each a step colder and cut into thinner stripes that scroll
    for (let g = 3; g >= 1; g--) {
      const dx = -g * 14 - Math.round(rand(f >> 1, g, 3) * 1.6), every = [0, 3, 4, 0][g];
      q.at(dx, 0, 0, (pp) => {
        pp.z += 1;
        pp.outline(a.mask, a.x, a.y, (mx, my) => (g === 3 && (mx + my) % 2 ? 0 : C[5 - g]));
        if (every)
          for (const [x, y, v] of L) {
            if ((((y + f) % every) + every) % every) continue;
            pp.px(a.x + x, a.y + y, C[Math.max(0, Math.min(6, 5 - g + v - 2))]);
          }
      });
    }
    // a smear streaming off the trailing edge
    for (const [x, y, dir] of S.side) {
      if (dir > 0 || (y + (f >> 1)) % 3) continue;
      const len = 3 + Math.floor(rand(y, f >> 1, 5) * 6);
      for (let d = 1; d <= len; d++) q.dot(a.x + x - d, lift(q, a.y + y), 0, d < 3 ? C[5] : C[4], 1 - d / (len + 1));
    }
    // three ribbons of wind spiralling off the back, thinning and breaking into dots
    for (let h = 0; h < 3; h++) {
      let prev = null;
      for (let s = 0; s <= 56; s += 2) {
        const r = 15 + s * 0.1, ang = (h * TAU) / 3 + s * 0.13 - (t / D) * TAU * 2, cur = [-6 - s, Math.min(-3, cy + Math.cos(ang) * r * 0.8), Math.sin(ang) * r], u = s / 56;
        if (prev && (s < 22 || s % 6 < 4)) q.beam(...prev, ...cur, 1.5 - u, s < 18 ? C[6] : s < 34 ? C[5] : C[4], (1 - u) * 1.1);
        prev = cur;
      }
    }
    // speed lines whipping past all round: a bright head, a coloured body, a dotted tail (some in front, some behind)
    for (const front of [false, true])
      cycle(t, D, front ? 8 : 16, o.seed + (front ? 9 : 7), (r) => r.range(0.12, 0.26), (age, life, r) => {
        const u = age / life, y = lift(q, a.y + r.range(2, a.h - 3)), len = r.range(10, 26) * (front ? 0.7 : 1), z = (front ? 1 : -1) * r.range(4, 24);
        const x = r.range(-12, 4) - age * r.range(130, 190);
        for (let d = 0; d < len; d++) {
          if (d > len * 0.45 && d % 2) continue;
          q.dot(x + d, y, z, d < 2 ? C[6] : d < len * 0.4 ? C[5] : C[3], (1 - d / len) * (1 - u) * (front ? 0.7 : 1.1));
        }
        q.light(x, y, z, C[4], 0.4 * (1 - u));
      });
    // streaks scrolling over the floor: the ground rushing by
    cycle(t, D, 9, o.seed + 11, (r) => r.range(0.25, 0.4), (age, life, r) => {
      const u = age / life, z = r.range(-28, 28), len = r.range(8, 20), x = r.range(-10, 14) - age * r.range(120, 170);
      for (let d = 0; d < len; d++) q.dot(x + d, -0.5, z, d < 2 ? C[5] : C[3], (1 - d / len) * Math.sin(Math.PI * u) * 0.8);
    });
    // dust kicked off the heels, rolling away behind and fanning out
    const dust = hex(o.dust), puffs = [];
    cycle(t, D, 12, o.seed + 5, (r) => r.range(0.45, 0.7), (age, life, r, i) => {
      const u = age / life, foot = i % 2 ? -7 : 3, x = foot + travel(-r.range(50, 100), 0, 3.5, age), y = -1.5 - travel(r.range(6, 18), 0, 3.5, age);
      const z = (i % 3 - 1) * 3 + travel(r.range(-30, 30), 0, 3.5, age);
      puffs.push([x, y, z, r.range(2.6, 4.6) * (0.6 + 1 * u), Math.pow(1 - u, 1.2) * Math.min(1, u * 10)]);
    });
    for (const [x, y, z, rad, k] of q.sort(puffs, (e) => e))
      q.at(x, y, z, (pp) => {
        pp.disc(0, 0, rad, dust, k * 0.5);
        pp.disc(rad * 0.05, rad * 0.08, rad * 0.74, dust, k * 0.62);
        pp.disc(-rad * 0.22, -rad * 0.3, rad * 0.5, C[5], k * 0.25);
      });
    // light: a cool glow streaming off the back, one round him, the wind-catching edge
    for (let g = 3; g >= 1; g--) q.glow(-g * 14, cy, 0, 16, C[3], 0.12 * (1 - g * 0.25));
    q.glow(-6, cy, 0, 22, C[3], 0.16);
    q.glow(0, cy, 0, 30, C[3], 0.16);
    q.glow(a.x + a.w, cy, 0, 10, C[5], 0.12 + 0.06 * Math.sin((t / D) * TAU * 3));
  },
};
