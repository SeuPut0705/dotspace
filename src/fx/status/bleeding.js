// The beads, drops, drying splats and crowns are
// adapted from Sprite Fusion's open-source blood (https://www.spritefusion.com/pixel-art-vfx/blood),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, rand, smooth, space, TAU } from "../../core/index.js";
import { shape, travel, lift, softRing } from "./_lib.js";

export const meta = {
  name: "Bleeding",
  desc: "Bleeding out: beads swell at three wounds, run, let go and fall to spatter into a glossy pool that ripples; each heartbeat spurts a little and flashes the body red.",
  tags: ["status", "bleed", "blood", "dot", "debuff", "wound", "loop"],
  size: [60, 56],
  origin: [30, 46],
  duration: 2.4,
  loop: true,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: ["#350711", "#5e0c1b", "#931327", "#c71e33", "#f2384a", "#ff8a7a"], seed: 5 },
};

const CLUTCH = { turn: 0.7, crouch: 3, lean: 2, fx: 2, fy: -21, bx: 8, by: -14, ffx: 3, fbx: -3 };
const BEAT_ = { ...CLUTCH, crouch: 5, lean: 4, hy: 1 };
export const act = {
  onBody: true,
  poses: [[0, BEAT_], [0.18, CLUTCH], [1.2, CLUTCH], [1.2, BEAT_, "snap"], [1.38, CLUTCH], [2.4, CLUTCH], [2.4, BEAT_, "snap"]],
};

const D = meta.duration, BEAT = D / 2, G = 900;

// the wounds: two on the edges of the arms and one on the front of the body. Blood runs down the body from each
// and beads at the end of the run; drops fall in front of the body to the floor
const WOUNDS = new WeakMap();
function wounds(a) {
  let w = WOUNDS.get(a.mask);
  if (w) return w;
  const S = shape(a), H = S.h, W = S.w;
  const make = (mx, my, drops, phase) => {
    let run = 1;
    while (run < 3 && S.on(mx, my + run + 1)) run++;
    return { x: a.x + mx + 0.5, mx, y0: a.y + my, yb: a.y + my + run + 1, drops, phase, side: mx < W / 2 ? -1 : 1 };
  };
  const edge = (q, side) => {
    const my = Math.round(H * q), [l, r] = S.rows[my];
    return [side < 0 ? l + 1 : r - 1, my];
  };
  const front = S.body.filter(([x, y]) => y > H * 0.5 && y < H * 0.62 && x > W * 0.55 && x < W * 0.75 && S.on(x, y + 3))[0] ?? edge(0.55, 1);
  w = [make(...edge(0.57, -1), 3, 0), make(...front, 2, 0.35), make(...edge(0.6, 1), 2, 0.7)];
  WOUNDS.set(a.mask, w);
  return w;
}

// a drop in flight: a bead with a tail when it is fast (Hugo's drop)
function drop(p, C, x, y, v, s) {
  const tail = Math.min(5, v * 0.012);
  if (tail >= 1) p.line(x, y - tail, x, y - 1, s >= 2 ? C[3] : C[2]);
  if (s >= 2) {
    p.px(x, y, C[5]);
    p.px(x + 1, y, C[4]);
    p.px(x, y + 1, C[3]);
    p.px(x + 1, y + 1, C[2]);
  } else p.px(x, y, C[4]);
}

// a splat where a drop lands: it spreads, throws a crown of droplets, then dries darker and fades
function splat(p, C, x, ground, age, big, seed) {
  const life = D * 0.85;
  if (age < 0 || age > life) return;
  const spread = smooth(0, 0.1, age), hw = (big ? 2.2 : 1.4) * (0.5 + 0.5 * spread), fade = 1 - smooth(life - 0.5, life, age);
  const dry = age < 0.35 ? 4 : age < 1 ? 3 : 2;
  for (let xx = Math.floor(x - hw); xx <= Math.ceil(x + hw); xx++) p.dot(xx, ground - 1, Math.abs(xx + 0.5 - x) > hw * 0.75 ? C[dry - 1] : C[dry], fade);
  if (age < 0.3) p.px(x - 0.5, ground - 1, C[5]);
  // the crown
  if (age < 0.4)
    for (let j = 0; j < (big ? 3 : 2); j++) {
      const vx = (j % 2 ? 1 : -1) * (18 + 24 * rand(seed, j, 1)), vy = -(40 + 40 * rand(seed, j, 2)), tt = age;
      const dx = vx * tt, dy = vy * tt + 0.5 * G * tt * tt;
      if (dy <= 0) p.px(x + dx, ground - 1 + dy, j ? C[3] : C[4]);
    }
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 6), a = o.actor, W = wounds(a);
  // the pool under the lowest wounds: dark and glossy, a ripple where each drop lands in it
  const px = (W[0].x + W[2].x) / 2 - 1, rx = 6.5, beat = Math.exp(-((((t % BEAT) + BEAT) % BEAT) / 0.25));
  for (let x = Math.floor(px - rx - 1); x <= px + rx + 1; x++) {
    const q = Math.abs(x + 0.5 - px) / rx;
    if (q > 1.1) continue;
    p.px(x, -1, q > 0.85 ? C[2] : C[1]);
    if (q < 0.8) p.px(x, 0, q < 0.5 ? C[1] : C[0]);
    if (q < 0.45) p.px(x, 1, C[0]);
  }
  p.px(px - 2, -1, C[4]);
  p.px(px - 1, -1, C[3]);
  p.px(px + 3, -1, C[3]);
  p.glow(px, -1, 8, C[3], 0.06 + 0.04 * beat);
}

export function draw(p, t, o) {
  paint(p, t, o, null);
}

// Everything the body wears: the flash, the wounds, the runs and the beads. In 2D the drops, splats and spurt are
// drawn here too; the 3D variant passes a hook that takes the falling drops and the splats instead (and its own spurt).
function paint(p, t, o, hook) {
  const C = fit(o.palette, 6), a = o.actor, W = wounds(a), S = shape(a);
  // each heartbeat flashes the body red for a moment
  const ph = ((t % BEAT) + BEAT) % BEAT, hurt = Math.max(0, 1 - ph / 0.12);
  if (hurt > 0) for (const [mx, my] of S.body) p.blend(a.x + mx, a.y + my, C[4], 0.26 * hurt);
  for (const [wi, w] of W.entries()) {
    // the wound, a dark gash with a wet lip, and the blood running down from it
    p.px(w.x, w.y0 - 1, C[1]);
    p.px(w.x - w.side, w.y0 - 1, C[0]);
    p.px(w.x - w.side, w.y0, C[2]);
    for (let y = w.y0; y < w.yb; y++) p.px(w.x, y, y === w.y0 ? C[4] : y >= w.yb - 1 ? C[3] : C[2]);
    // drops: a bead swells, sags, lets go, falls, splats
    const period = D / w.drops;
    for (let k = 0; k < w.drops; k++) {
      const born = w.phase * period + k * period, age = (((t - born) % D) + D) % D, swell = period * 0.62, big = (k + w.mx) % 2 === 0;
      const fallH = Math.max(1, -1 - w.yb), fall = Math.sqrt((2 * fallH) / G), ground = 0;
      if (age < swell) {
        // a bead gathers at the end of the run, sags and stretches
        const u = age / swell, len = u < 0.35 ? 1 : u < 0.75 ? 2 : 3;
        for (let j = 0; j < len; j++) p.px(w.x, w.yb + j, j === len - 1 ? C[2] : C[3]);
        if (len === 3) p.px(w.x - 1, w.yb + 2, C[1]);
        p.px(w.x, w.yb + len - 2, u > 0.5 ? C[5] : C[4]);
      } else if (age < swell + fall) {
        const f = age - swell;
        if (hook) hook.fall(wi, w, k, f, fall, big);
        else drop(p, C, w.x, w.yb + 2 + 0.5 * G * f * f, G * f, big ? 2 : 1);
      } else if (hook) hook.splat(wi, w, k, age - swell - fall, big, w.mx * 31 + k);
      else splat(p, C, w.x, ground, age - swell - fall, big, w.mx * 31 + k);
    }
  }
  // the heartbeat squeezes a little spurt from the first wound: droplets streak out and fall
  const w = W[0];
  if (!hook && ph < 0.5)
    for (let j = 0; j < 7; j++) {
      const vx = w.side * (18 + 42 * rand(j, 7)), vy = -(15 + 50 * rand(j, 8)), tt = ph - j * 0.012;
      if (tt <= 0) continue;
      const x = w.x + travel(vx, 0, 1.2, tt), y = w.y0 + travel(vy, G * 0.8, 0.6, tt);
      const x2 = w.x + travel(vx, 0, 1.2, tt - 0.02), y2 = w.y0 + travel(vy, G * 0.8, 0.6, tt - 0.02);
      if (y >= -1) continue;
      p.line(x2, y2, x, y, j % 3 ? C[3] : C[2]);
      p.px(x, y, j % 2 ? C[5] : C[4]);
    }
  p.glow(w.x, w.y0, 6, C[4], 0.25 * hurt);
}

// 3D: drops let go of the wounds and fall to the floor round the body, where each spatters into a decal that spreads,
// throws a crown of droplets and dries; under them a glossy true-circle pool with rippling rings; the heartbeat
// spurts out in a fan.
const WZ = [3, 7, -4]; // each wound's depth: the left arm, the front of the body, the right arm
const OUT = [[-1, 0], [0, 1], [1, 0]]; // and the way its drops spill outward on landing
export const three = {
  meta: { size: [88, 76], origin: [44, 60], bg: "ground", camera: { pitch: 0.4 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 6), a = o.actor, W = wounds(a);
    const ph = ((t % BEAT) + BEAT) % BEAT, hurt = Math.max(0, 1 - ph / 0.12), beat = Math.exp(-ph / 0.25);
    const falls = [], splats = [], life = D * 0.85;
    // where drop k of wound wi lands: a little outward of the wound
    const land = (wi, w, k) => [w.x + OUT[wi][0] * 7 * rand(w.mx, k, 41) + (rand(w.mx, k, 42) - 0.5) * 2.5, WZ[wi] + OUT[wi][1] * 7 * rand(w.mx, k, 43) + (rand(w.mx, k, 44) - 0.5) * 2.5];
    paint(p, t, o, {
      fall: (wi, w, k, f, fall, big) => falls.push({ wi, w, k, f, fall, big }),
      splat: (wi, w, k, age, big, seed) => age >= 0 && age <= life && splats.push({ wi, w, k, age, big, seed }),
    });
    // the pool under the wounds: dark and glossy, a ripple running out of it on every beat
    const px = (W[0].x + W[2].x) / 2 - 1, R = 9, rip = smooth(0, 1, ph / 0.55) * R * 1.05;
    q.plane(px, 0, 0, null, R + 1, (u, v) => {
      const r = Math.hypot(u, v), ang = Math.atan2(v, u), edge = R * (1 + 0.07 * Math.sin(ang * 3 + 1) + 0.05 * Math.sin(ang * 5));
      if (r > edge) return;
      const f = r / edge;
      // wet highlights: an arc inside the near lip, one on the far lip, and a glint
      if (r > edge * 0.55 && r < edge * 0.75 && ((ang > 0.9 && ang < 2.2) || (ang > -2.6 && ang < -1.5))) return r < edge * 0.63 ? C[4] : C[3];
      if (Math.abs(u + 3.5) < 0.9 && Math.abs(v - 2) < 0.7) return C[5];
      if (ph < 0.55 && Math.abs(r - rip) < 0.9) return C[3];
      return f > 0.85 ? C[2] : f > 0.5 ? C[1] : C[0];
    });
    // the drops that fall: a bead with a tail, straight from the wound to its landing
    for (const d of falls) {
      const { wi, w, k, f, fall, big } = d, [lx, lz] = land(wi, w, k), s = Math.min(1, f / fall), y0 = lift(q, w.yb + 2);
      q.at(w.x + (lx - w.x) * s, y0 * (1 - s * s), WZ[wi] + (lz - WZ[wi]) * s, (pp) => drop(pp, C, 0, 0, G * f, big ? 2 : 1));
    }
    // the spurt: a fan of droplets streaking out and falling, spread round the outward direction
    const w0 = W[0], y0 = lift(q, w0.y0);
    if (ph < 0.5)
      for (let j = 0; j < 10; j++) {
        const h = 18 + 42 * rand(j, 7), vy = -(15 + 50 * rand(j, 8)), tt = ph - j * 0.012, psi = (j / 9 - 0.5) * 1.9 + (rand(j, 9) - 0.5) * 0.3;
        if (tt <= 0) continue;
        const pos = (s) => [w0.x + w0.side * Math.cos(psi) * travel(h, 0, 1.2, s), y0 + travel(vy, G * 0.8, 0.6, s), WZ[0] + Math.sin(psi) * travel(h, 0, 1.2, s)];
        const [x, y, z] = pos(tt), [x2, y2, z2] = pos(tt - 0.02);
        if (y >= -1) continue;
        q.line(x2, y2, z2, x, y, z, j % 3 ? C[3] : C[2]);
        q.px(x, y, z, j % 2 ? C[5] : C[4]);
      }
    // the splats, flat on the floor: they spread, throw a crown of droplets and dry
    for (const s of splats) {
      const [x, z] = land(s.wi, s.w, s.k), age = s.age, spread = smooth(0, 0.1, age), hw = (s.big ? 2.2 : 1.4) * (0.5 + 0.5 * spread) * 1.3, fade = 1 - smooth(life - 0.5, life, age);
      const dry = age < 0.35 ? 4 : age < 1 ? 3 : 2;
      q.plane(x, 0, z, null, hw + 1, (u, v, out) => {
        const d = Math.hypot(u, v);
        if (d > hw) return;
        out.c = d > hw * 0.75 ? C[dry - 1] : C[dry];
        out.a = fade;
        out.blend = fade < 0.98;
      });
      if (age < 0.3) q.px(x - 0.5, -0.4, z, C[5]);
      if (age < 0.4)
        for (let j = 0; j < (s.big ? 3 : 2); j++) {
          const ang = rand(s.seed, j, 3) * TAU, vr = 18 + 24 * rand(s.seed, j, 1), vy = -(40 + 40 * rand(s.seed, j, 2)), dy = vy * age + 0.5 * G * age * age;
          if (dy <= 0) q.px(x + Math.cos(ang) * vr * age, -1 + dy, z + Math.sin(ang) * vr * age, j ? C[3] : C[4]);
        }
    }
    // light after the solids: the pool's sheen
    q.glow(px, -2, 0, 9, C[3], 0.06 + 0.04 * beat);
    // ripples where a drop has just landed, far to near
    const fresh = splats.filter((s) => s.age < 0.45).map((s) => ({ s, at: land(s.wi, s.w, s.k) }));
    for (const { s, at } of q.sort(fresh, (e) => [e.at[0], 0, e.at[1]])) {
      const u = s.age / 0.45;
      softRing(q, at[0], 0, at[1], 0.8 + 4.5 * u, 1.1, C[4], 0.7 * (1 - u));
    }
  },
};
