// The orb's shading and its glow follow Sprite Fusion's open-source pickup orb
// (https://www.spritefusion.com/pixel-art-vfx/pickup), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, rand, cycle, space, TAU, WHITE, hex } from "../../core/index.js";
import { glint, blobShadow, pool, floorShadow, floorPool, glint3 } from "./_lib.js";

export const meta = {
  name: "XP orb",
  desc: "A small glowing orb races a figure-eight, a comet tail tapering behind it along its path, flecks shed from the tail winking out, its light following it over the floor.",
  tags: ["pickup", "xp", "orb", "experience", "energy", "loop"],
  size: [72, 56],
  origin: [36, 48],
  duration: 1.8,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#0c1806", "#1e3a0a", "#36620e", "#5c9614", "#8cd024", "#c4f060", "#effcc0", "#ffffff"], seed: 2 },
};

const A = 16, B = 9, HOVER = 20, TAIL = 0.48, INK = hex("#0a1406");

// the figure-eight, as a function of time (one lap a loop), with a little lift and fall
const at = (t) => {
  const a = (t / meta.duration) * TAU;
  return [A * Math.sin(a), -HOVER + B * Math.sin(a) * Math.cos(a) - 1.2 * Math.cos(a * 2)];
};

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), [x, y] = at(t);
  // its shadow and its light slide over the floor beneath it
  blobShadow(p, x, 3.5, 0.55);
  pool(p, x, 0.5, 14, 3, C[5], 0.3);
  // flecks shed from the tail drift down and wink out
  cycle(t, meta.duration, 16, o.seed, (g) => g.range(0.35, 0.7), (age, life, r) => {
    const [fx, fy] = at(t - age), k = 1 - age / life, tw = Math.sin(age * r.range(20, 30) + r.range(0, TAU));
    const x2 = fx + r.range(-2, 2) + age * r.range(-6, 6), y2 = fy + r.range(-2, 2) + age * r.range(4, 10);
    if (tw * k > -0.2) p.px(x2, y2, tw > 0.6 && k > 0.5 ? WHITE : k > 0.5 ? C[6] : C[5]);
    p.glow(x2 + 0.5, y2 + 0.5, 3, C[5], 0.3 * k);
  });
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), [x, y] = at(t), beat = 0.5 + 0.5 * Math.sin((t / meta.duration) * TAU * 3);
  // the tail: the orb's own path just behind it, tapering and cooling down the ramp
  const n = 60;
  // an outer ribbon cooling down the ramp, then a bright core line down its middle
  for (let i = n; i >= 1; i--) {
    const u = i / n, [tx, ty] = at(t - u * TAIL), r = 3.1 * Math.pow(1 - u, 1.1);
    const c = u < 0.25 ? C[5] : u < 0.55 ? C[4] : C[3];
    if (r > 0.6) p.circle(tx, ty, r, c, u < 0.7 ? 1 : (1 - u) * 3.3);
    else p.dot(tx, ty, c, (1 - u) * 3);
    if (i % 6 === 0) p.glow(tx, ty, 7 * (1 - u) + 2, C[5], 0.24 * (1 - u));
  }
  for (let i = Math.floor(n * 0.6); i >= 1; i--) {
    const u = i / n, [tx, ty] = at(t - u * TAIL);
    p.dot(tx, ty, u < 0.2 ? WHITE : C[6], (0.6 - u) * 4);
  }
  // the orb: a dark rim, a bright body, a white heart and a highlight, pulsing with light
  const X = Math.round(x), Y = Math.round(y);
  p.circle(X, Y, 4.4, INK);
  p.circle(X, Y, 3.6, (d, a) => (d > 0.72 ? (Math.cos(a + 2.4) > 0.3 ? C[5] : C[3]) : d > 0.4 ? (Math.cos(a + 2.4) > -0.2 ? C[6] : C[5]) : WHITE));
  p.px(X - 2, Y - 2, WHITE), p.px(X - 1, Y - 2, C[7]);
  p.glow(x, y, 16 + 3 * beat, C[5], 0.36 + 0.14 * beat);
  // a glint now and then
  const g = ((t / meta.duration) * 3) % 1;
  if (g < 0.12) glint(p, X - 2, Y - 2, 2.4 * Math.sin((g / 0.12) * Math.PI), WHITE, 0.4);
}

// The same orb, racing a figure-eight that lies tilted in the air round the middle, so it swings out towards you and
// away behind; the tail is a tapering ribbon of light along that path in space, the flecks fall in every direction.
const TILT = 0.5;
const at3 = (t) => {
  const a = (t / meta.duration) * TAU, v = 20 * Math.sin(a) * Math.cos(a);
  return [A * Math.sin(a), -HOVER - v * Math.sin(TILT) - 1.2 * Math.cos(a * 2), v * Math.cos(TILT)];
};
export const three = {
  meta: { size: [80, 68], origin: [40, 54], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), [x, y, z] = at3(t), beat = 0.5 + 0.5 * Math.sin((t / meta.duration) * TAU * 3);
    // its shadow and its light slide over the floor beneath it
    floorShadow(q, x, z, 3.5, 0.55);
    floorPool(q, x, z, 14, C[5], 0.3);
    // the tail: the orb's own path just behind it, tapering and cooling down the ramp, as a ribbon in space
    const n = 40, pts = Array.from({ length: n + 1 }, (_, i) => at3(t - (i / n) * TAIL));
    for (let i = n - 1; i >= 0; i--) {
      const u = (i + 0.5) / n, r = 2.7 * Math.pow(1 - u, 1.1), c = u < 0.25 ? C[5] : u < 0.55 ? C[4] : C[3];
      q.beam(...pts[i], ...pts[i + 1], Math.max(1.2, r * 2), c, u < 0.7 ? 1 : (1 - u) * 3.3);
      if (i % 6 === 0) q.glow(...pts[i], 7 * (1 - u) + 2, C[5], 0.16 * (1 - u));
    }
    // a bright core line down its middle
    for (let i = 0; i < Math.floor(n * 0.6); i++) {
      const u = i / n;
      q.line(...pts[i], ...pts[i + 1], u < 0.2 ? WHITE : C[6], Math.min(1, (0.6 - u) * 4));
    }
    // flecks shed from the tail drift down and wink out, every way round
    cycle(t, meta.duration, 16, o.seed, (g) => g.range(0.35, 0.7), (age, life, r) => {
      const [fx, fy, fz] = at3(t - age), k = 1 - age / life, tw = Math.sin(age * r.range(20, 30) + r.range(0, TAU)), a = r.range(0, TAU), sp = r.range(2, 7);
      const x2 = fx + r.range(-2, 2) + Math.cos(a) * sp * age, y2 = fy + r.range(-2, 2) + age * r.range(4, 10), z2 = fz + r.range(-2, 2) + Math.sin(a) * sp * age;
      if (tw * k > -0.2) q.px(x2, y2, z2, tw > 0.6 && k > 0.5 ? WHITE : k > 0.5 ? C[6] : C[5]);
      q.glow(x2, y2, z2, 3, C[5], 0.3 * k);
    });
    // the orb: a dark rim, a bright body, a white heart and a highlight, pulsing with light
    q.ball(x, y, z, 4.1, (nx, ny, nz) => {
      const l = nx * -0.45 + ny * -0.6 + nz * 0.66;
      return nz < 0.4 ? INK : l > 0.8 ? WHITE : l > 0.55 ? C[6] : l > 0.2 ? C[5] : l > -0.15 ? C[4] : C[3];
    });
    q.at(x, y, z, (pp) => ((pp.z -= 4.4), pp.px(-2, -2, WHITE), pp.px(-1, -2, C[7])));
    q.glow(x, y, z, 16 + 3 * beat, C[5], 0.26 + 0.12 * beat);
    // a glint now and then
    const g = ((t / meta.duration) * 3) % 1;
    if (g < 0.12) glint3(q, x - 2 * q.cy + 5 * q.sy, y - 2 * q.cp - 5 * q.sp, z + 2 * q.sy + 5 * q.cy, 2.4 * Math.sin((g / 0.12) * Math.PI), WHITE, 0.4);
  },
};
