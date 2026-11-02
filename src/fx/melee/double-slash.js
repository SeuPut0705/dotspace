// The crescent, trace, glint and spark recipe is adapted from Sprite Fusion's open-source slash
// (https://www.spritefusion.com/pixel-art-vfx/slash), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, space, sparkle, flare, clamp, ease, WHITE, READY } from "../../core/index.js";
import { through, slash, slashEnd, shavings, sliver, lay, slash3, slashEnd3, shavings3, spray, travel3, onSwing3 } from "./_lib.js";

export const meta = {
  name: "Double slash",
  desc: "A down cut, then an up cut that crosses it: the moment the X closes both strokes flash white, the crossing bursts with light and sparks, and a dotted X lingers.",
  tags: ["melee", "slash", "combo", "sword", "cross", "combat", "directional", "one-shot"],
  size: [164, 108],
  origin: [44, 92],
  duration: 0.8,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#2a0a22", "#5e1238", "#a01f4e", "#e0386a", "#ff86a6", "#ffd2dd", "#ffffff"],
    sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"],
    seed: 6,
  },
};

const STANCE = { ...READY, weapon: "sword", fx: 12, fy: -21, sa: -0.85 };
const HIGH = { ...STANCE, x: -7, crouch: 4, lean: -4, fx: -7, fy: -35, sa: -2.65, bx: 9, by: -25, armsFront: true, ffx: 9, fbx: -8 };
const LOW = { ...STANCE, x: 3, crouch: 6, lean: 6, fx: 22, fy: -20, sa: 0.62, bx: -8, by: -24, ffx: 13, fbx: -10, toeB: true };
export const act = {
  target: { x: 62 },
  poses: [
    [-0.42, { ...STANCE, x: -7 }],
    [-0.18, HIGH],
    [-0.04, { ...HIGH, crouch: 5 }],
    [0, { ...STANCE, x: 0, crouch: 2, lean: 3, fx: 16, fy: -37, sa: -1.45, bx: -7, by: -24, ffx: 11, fbx: -9, ghost: 1 }, "snap"],
    [0.06, LOW, "snap"],
    [0.14, { ...LOW, x: 4, crouch: 6, lean: 5, fx: 20, fy: -17, sa: 0.85, ghost: 1 }],
    [0.17, { ...LOW, x: 5, crouch: 3, lean: 5, fx: 22, fy: -28, sa: 0.1, by: -18, toeB: true, ghost: 1 }, "snap"],
    [0.21, { ...LOW, x: 6, crouch: 1, lean: 6, fx: 19, fy: -37, sa: -0.95, by: -18, ffx: 13, fby: -6 }, "snap"],
    [0.5, { ...LOW, x: 6, crouch: 3, lean: 3, fx: 18, fy: -36, sa: -1.05, by: -19, ffx: 12 }],
    [0.92, { ...STANCE, x: -7 }],
  ],
  hits: [
    { t: 0.06, stop: 0.05, shake: 0.08, amp: 1, push: 1.4, straw: 8 },
    { t: 0.16, stop: 0.14, shake: 0.2, amp: 2, push: 2.8, straw: 18, y: -28 },
  ],
  dust: [{ t: 0.06, x: 16, n: 5, dir: 1 }, { t: 0.17, x: -8, n: 4, dir: -1 }],
};

const UP = 0.14; // the second cut starts
const R0 = 62;

const cut = (x, y, th, dir, span, extra) => through(x, y, th, dir, R0, span, 0.55, extra);

export function create(o) {
  const C = fit(o.palette, 7), Rg = new Rng(o.seed), ps = new Particles({ rng: Rg, ground: () => 0, sparks: o.sparks }), lights = new Lights();
  const X = 34, Y = -23;
  const down = cut(X, Y, 0.72, 1, 0.84, { W: 10, t0: 0, sweep: 0.06, hold: 0.07, trail: 0.24, ramp: C, lens: true });
  const up = cut(X, Y, -0.66, -1, 0.84, { W: 11, t0: UP, sweep: 0.06, hold: 0.06, trail: 0.26, ramp: C, lens: true });
  const ends = [slashEnd(down), slashEnd(up)], slivers = [-2.4, -1.1, 0.2, 1.6].map((a) => ({ a: a + Rg.range(-0.2, 0.2), r: Rg.range(5, 8), v: Rg.range(70, 120), arc: Rg.range(0.4, 0.7) }));
  const CLOSE = UP + 0.012;
  let t = 0, cut1 = false, cut2 = false, closed = false;
  return {
    update(dt) {
      t += dt;
      if (!cut1 && t >= down.sweep) {
        cut1 = true;
        shavings(ps, Rg, down, 10, [C[4], C[5]]);
        for (let i = 0; i < 6; i++) {
          const a = Math.atan2(ends[0].dy, ends[0].dx) + Rg.range(-0.5, 0.5), sp = Rg.range(120, 300);
          ps.spawn(P.SPARK, ends[0].x, ends[0].y, Math.cos(a) * sp, Math.sin(a) * sp, Rg.range(0.12, 0.3));
        }
      }
      if (!closed && t >= CLOSE) {
        closed = true;
        lights.add(X, Y, 56, C[3], 0.45, 0.4);
        lights.add(X, Y, 18, WHITE, 0.6, 0.08);
        for (let i = 0; i < 18; i++) {
          const a = Rg.range(-Math.PI, Math.PI) * 0.8, sp = Rg.range(140, 360);
          ps.spawn(P.SPARK, X, Y, Math.cos(a) * sp, Math.sin(a) * sp - 40, Rg.range(0.14, 0.4));
        }
        for (let i = 0; i < 5; i++) ps.spawn(P.STAR, X + Rg.range(-14, 14), Y + Rg.range(-12, 12), 0, -4, Rg.range(0.2, 0.4), Rg.chance(0.5) ? C[5] : WHITE, Rg.range(1, 2.2), Rg.range(0.05, 0.2));
      }
      if (!cut2 && t >= UP + up.sweep) {
        cut2 = true;
        shavings(ps, Rg, up, 12, [C[4], C[5]]);
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      // both strokes flash white for two frames when the X closes
      const flash = t >= CLOSE && t < CLOSE + 0.07 ? 1 : 0;
      down.hot = up.hot = flash;
      slash(p, down, t);
      slash(p, up, t);
      // glints at the ends of the strokes
      for (const [s, e] of [[down, ends[0]], [up, ends[1]]]) {
        const g = t - s.t0 - s.sweep * 0.6;
        if (g > 0 && g < 0.2) sparkle(p, e.x, e.y, 7 * ease.outBack(Math.min(1, g / 0.05)) * (1 - g / 0.2), C[5], C[3], 0.5);
      }
      // the crossing: a flare, slivers flying off it, light
      const q = t - CLOSE;
      if (q >= 0 && q < 0.26) {
        const k = q / 0.26;
        flare(p, X, Y, 22 * Math.pow(1 - k, 1.4), 1 - k, C);
        p.glow(X, Y, 34, C[4], 0.35 * (1 - k));
      }
      if (q >= 0.03 && q < 0.15) {
        const k = (q - 0.03) / 0.12;
        for (const s of slivers) sliver(p, X, Y, s.a, s.r + s.v * (q - 0.03), s.arc * (1 - 0.4 * k), k < 0.4 ? C[6] : k < 0.7 ? C[5] : C[4], 1 - k);
      }
      // light rides each edge as it goes
      for (const s of [down, up]) {
        const u = t - s.t0;
        if (u <= 0 || u >= 0.25) continue;
        const e = slashEnd({ ...s, span: s.span * ease.outExpo(clamp(u / s.sweep)) });
        p.glow(e.x, e.y, 40, C[3], 0.5 * (1 - u / 0.25));
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}

// ---- 3D: the two strokes lie on two planes (turned opposite ways about the vertical) that cross at the X, each
// stroke still passing through it; the crossing is a billboard flare with sparks flung in a full sphere.
// A stroke on its own plane: the 2D one (a swing through (x, y) heading th), turned by yaw, with its X point kept at (x, y, z).
const through3 = (x, y, z, th, dir, span, extra, laid) => {
  const S = lay(through(0, 0, th, dir, R0, span, 0.55, extra), laid), P0 = onSwing3(S, S.R, S.span * 0.55);
  S.c = [S.c[0] + x - P0[0], S.c[1] + y - P0[1], S.c[2] + z - P0[2]];
  return S;
};

export const three = {
  meta: { size: [196, 120], origin: [98, 94], camera: { pitch: 0.28 } },
  create(o) {
    const C = fit(o.palette, 7), Rg = new Rng(o.seed), ps = new Particles({ rng: Rg, ground: () => 0, sparks: o.sparks }), lights = new Lights();
    const X = 34, Y = -23, Z = 0;
    const down = through3(X, Y, Z, 0.72, 1, 0.84, { W: 10, t0: 0, sweep: 0.06, hold: 0.07, trail: 0.24, ramp: C, lens: true }, { yaw: 0.5, lean: 0.1 });
    const up = through3(X, Y, Z, -0.66, -1, 0.84, { W: 11, t0: UP, sweep: 0.06, hold: 0.06, trail: 0.26, ramp: C, lens: true }, { yaw: -0.5, lean: -0.1 });
    const ends = [slashEnd3(down), slashEnd3(up)];
    // slivers fly off the crossing as short arcs on planes of every tilt
    const slivers = [-2.4, -1.1, 0.2, 1.6].map((a) => ({ a: a + Rg.range(-0.2, 0.2), r: Rg.range(5, 8), v: Rg.range(70, 120), arc: Rg.range(0.4, 0.7), n: [Rg.range(-1, 1), Rg.range(-0.6, 0.6), Rg.range(-1, 1)] }));
    const CLOSE = UP + 0.012;
    let t = 0, cut1 = false, cut2 = false, closed = false;
    const burst = (n, v0, v1, life) => {
      for (let i = 0; i < n; i++) {
        const w = Rg.range(-1, 1), a = Rg.range(0, Math.PI * 2), r = Math.sqrt(1 - w * w), sp = Rg.range(v0, v1);
        ps.spawn3(P.SPARK, X, Y, Z, Math.cos(a) * r * sp, w * sp - 40, Math.sin(a) * r * sp, Rg.range(...life));
      }
    };
    return {
      update(dt) {
        t += dt;
        if (!cut1 && t >= down.sweep) {
          cut1 = true;
          shavings3(ps, Rg, down, 10, [C[4], C[5]]);
          for (let i = 0; i < 6; i++) {
            const [vx, vy, vz] = spray(Rg, [ends[0].dx, ends[0].dy, ends[0].dz], 0.9, Rg.range(120, 300));
            ps.spawn3(P.SPARK, ends[0].x, ends[0].y, ends[0].z, vx, vy, vz, Rg.range(0.12, 0.3));
          }
        }
        if (!closed && t >= CLOSE) {
          closed = true;
          lights.add(X, Y, 56, C[3], 0.45, 0.4, Z);
          lights.add(X, Y, 18, WHITE, 0.6, 0.08, Z);
          burst(18, 140, 360, [0.14, 0.4]);
          for (let i = 0; i < 5; i++) ps.spawn3(P.STAR, X + Rg.range(-14, 14), Y + Rg.range(-12, 12), Z + Rg.range(-14, 14), 0, -4, 0, Rg.range(0.2, 0.4), Rg.chance(0.5) ? C[5] : WHITE, Rg.range(1, 2.2), Rg.range(0.05, 0.2));
        }
        if (!cut2 && t >= UP + up.sweep) {
          cut2 = true;
          shavings3(ps, Rg, up, 12, [C[4], C[5]]);
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o);
        // both strokes flash white for two frames when the X closes
        const flash = t >= CLOSE && t < CLOSE + 0.07 ? 1 : 0;
        down.hot = up.hot = flash;
        slash3(q, down, t);
        slash3(q, up, t);
        // glints at the ends of the strokes
        for (const [s, e] of [[down, ends[0]], [up, ends[1]]]) {
          const g = t - s.t0 - s.sweep * 0.6;
          if (g > 0 && g < 0.2) q.at(e.x, e.y, e.z, (pp) => sparkle(pp, 0, 0, 7 * ease.outBack(Math.min(1, g / 0.05)) * (1 - g / 0.2), C[5], C[3], 0.5));
        }
        // the crossing: a flare, slivers flying off it, light
        const w = t - CLOSE;
        if (w >= 0 && w < 0.26) {
          const k = w / 0.26;
          q.at(X, Y, Z, (pp) => flare(pp, 0, 0, 22 * Math.pow(1 - k, 1.4), 1 - k, C));
          q.glow(X, Y, Z, 34, C[4], 0.35 * (1 - k));
          // the light spills along the floor as a ring under the crossing
          q.ring(X, 0, Z, 8 + 30 * ease.outExpo(k), 1.6, C[4], 0.7 * (1 - k));
        }
        if (w >= 0.03 && w < 0.15) {
          const k = (w - 0.03) / 0.12, c = k < 0.4 ? C[6] : k < 0.7 ? C[5] : C[4];
          for (const s of slivers) q.arc(X, Y, Z, s.r + s.v * (w - 0.03), 1.4, s.a - (s.arc * (1 - 0.4 * k)) / 2, s.a + (s.arc * (1 - 0.4 * k)) / 2, c, 1 - k, s.n);
        }
        // light rides each edge as it goes
        for (const s of [down, up]) {
          const u = t - s.t0;
          if (u <= 0 || u >= 0.25) continue;
          const e = travel3(s, s.span * ease.outExpo(clamp(u / s.sweep)), s.R - s.W * 0.3);
          q.glow(e.x, e.y, e.z, 40, C[3], 0.5 * (1 - u / 0.25));
        }
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
