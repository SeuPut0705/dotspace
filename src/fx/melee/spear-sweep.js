// The crescent, trace and glint recipe is adapted from Sprite Fusion's open-source slash, and the rolling dust and
// grit from his explosion (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, PF, Rng, fit, space, sparkle, clamp, ease, READY } from "../../core/index.js";
import { swing, onSwing, travel, slash, slashEnd, stone, lay, slash3, slashEnd3, travel3, spray } from "./_lib.js";

export const meta = {
  name: "Spear sweep",
  desc: "A wide low sweep at shin height: a long flat crescent swings from behind the legs round the front, and the wind of it kicks a wake of dust and grit along the floor.",
  tags: ["melee", "sweep", "spear", "polearm", "low", "aoe", "ground", "dust", "combat", "one-shot"],
  size: [216, 84],
  origin: [104, 70],
  duration: 1.5,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#0f2a2a", "#18504a", "#22806e", "#3fb894", "#8fe6c0", "#dcfff0", "#ffffff"],
    sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"],
    stone: "#4a3f69",
    seed: 10,
  },
};

// upright in one hand; two hands take it low across the belt, he winds right round, and it whips through the front
const REST_ = { ...READY, weapon: "spear", sa: -1.42, fx: 11, fy: -21, bx: 7, by: -16 };
const COCK = { ...REST_, two: true, yaw: 2.5, crouch: 6, lean: 2, fx: 15, fy: -17, sa: 0.05, ffx: 9, fbx: -8 };
const OUT_ = { ...REST_, two: true, x: 2, crouch: 6, lean: 6, fx: 20, fy: -15, sa: 0.04, ffx: 12, fbx: -10, toeB: true };
export const act = {
  target: { x: 62 },
  poses: [
    [-0.56, REST_],
    [-0.34, { ...REST_, two: true, crouch: 4, fx: 14, fy: -22, sa: -0.7 }],
    [-0.14, COCK],
    [-0.02, { ...COCK, crouch: 7, yaw: 2.7 }],
    [0.045, { ...OUT_, x: 1, yaw: 1.3, ghost: 1 }, "snap"],
    [0.09, { ...OUT_, ghost: 1 }, "snap"],
    [0.14, OUT_, "snap"],
    [0.62, { ...OUT_, crouch: 5, lean: 5 }],
    [1.12, { ...REST_, two: true, crouch: 4, sa: -0.7, fx: 14, fy: -22 }],
    [1.5, REST_],
  ],
  hits: [{ t: 0.1, stop: 0.12, shake: 0.18, amp: 2, push: 2.6, straw: 18, y: -12 }],
  dust: [{ t: 0.09, x: 14, n: 6, dir: 1 }, { t: 0.09, x: -10, n: 5, dir: -1 }],
};

export function create(o) {
  const C = fit(o.palette, 7), Rg = new Rng(o.seed), st = stone(o.stone), ps = new Particles({ rng: Rg, ground: () => 0, sparks: o.sparks }), lights = new Lights();
  // from behind the left leg, round the front, out to the right; the far part is behind the fighter
  const A = swing({ cx: 2, cy: -12, R: 50, sy: 0.2, k: 0.19, rot: -0.04, a0: Math.PI + 0.55, dir: -1, span: Math.PI + 0.35, W: 19, t0: 0, sweep: 0.13, hold: 0.05, trail: 0.3, ramp: C });
  const end = slashEnd(A);
  let t = 0, lastU = 0, done = false;
  return {
    update(dt) {
      t += dt;
      // the wind under the blade kicks dust up off the floor as it passes, rolling on the way it goes
      const U = A.span * ease.outExpo(clamp(t / A.sweep));
      for (let u = lastU; u < U; u += 0.09) {
        const tr = travel(A, u), near = Math.sin(tr.a) >= 0, fy = near ? -1 : -3, sp = Rg.range(30, 90);
        ps.spawn(P.SMOKE, tr.x, fy - Rg.range(0, 2), tr.dx * sp, -Rg.range(4, 16), Rg.range(0.7, 1.15), st.dust, Rg.range(3, 5.5), Rg.range(0, 0.05));
        if (Rg.chance(0.6)) ps.spawn(P.GRIT, tr.x, fy, tr.dx * Rg.range(40, 120) + Rg.range(-20, 20), -Rg.range(40, 130), Rg.range(0.6, 1.0), Rg.pick([st.light, st.body, st.shade]), Rg.chance(0.3) ? 2 : 1);
        if (Rg.chance(0.35)) ps.spawn(P.MOTE, tr.x, tr.y, tr.dx * Rg.range(40, 100), tr.dy * 40 - Rg.range(5, 20), Rg.range(0.2, 0.4), Rg.chance(0.5) ? C[4] : C[5], 0.6, 0, near ? 0 : PF.BACK);
      }
      lastU = U;
      if (!done && t >= A.sweep) {
        done = true;
        lights.add(end.x, end.y - 4, 50, C[3], 0.5, 0.35);
        for (let i = 0; i < 8; i++) {
          const a = Math.atan2(end.dy, end.dx) + Rg.range(-0.5, 0.3), sp = Rg.range(120, 260);
          ps.spawn(P.SPARK, end.x, end.y, Math.cos(a) * sp, Math.sin(a) * sp - 40, Rg.range(0.12, 0.3));
        }
        // the wake piles up and rolls on past the tip
        for (let i = 0; i < 6; i++) ps.spawn(P.SMOKE, end.x + Rg.range(-6, 4), -Rg.range(1, 4), Rg.range(30, 90), -Rg.range(4, 14), Rg.range(0.9, 1.25), st.dust, Rg.range(4.5, 7), Rg.range(0, 0.08), PF.BIG);
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      slash(p, A, t, -1);
      ps.draw(p, "back");
    },
    draw(p) {
      slash(p, A, t, 1);
      const g = t - A.sweep * 0.6;
      if (g > 0 && g < 0.24) sparkle(p, end.x, end.y, 9 * ease.outBack(Math.min(1, g / 0.05)) * (1 - g / 0.24), C[5], C[3], 0.55);
      // light rides the edge
      if (t < A.sweep + 0.12) {
        const [x, y] = onSwing(A, A.R - 5, A.span * ease.outExpo(clamp(t / A.sweep)));
        p.glow(x, y, 36, C[3], 0.45 * (1 - t / (A.sweep + 0.12)));
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

// 3D: the sweep is a level ring at shin height, a true circle round the fighter: its far half goes behind him, the
// near half cuts across the front. A second thinner band rides lower under it so from the side the two part like a
// swept sheet. The wake of dust rolls off the floor along the way the blade goes and out from it in every
// direction, the scuff of it lies on the floor as a flat arc, and the tip's sparks leave in a cone.
export const three = {
  meta: { size: [184, 96], origin: [92, 72], camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 7), Rg = new Rng(o.seed), st = stone(o.stone), ps = new Particles({ rng: Rg, ground: () => 0, sparks: o.sparks }), lights = new Lights();
    const base = swing({ cx: 2, cy: -13, R: 50, sy: 0.2, rot: -0.04, a0: Math.PI + 0.55, dir: -1, span: Math.PI + 0.35, W: 19, t0: 0, sweep: 0.13, hold: 0.05, trail: 0.3, ramp: C });
    const A = lay(base, { lean: 0.2 }), E = lay({ ...base, cy: -6, R: 45, W: 7, a0: base.a0 - 0.1, span: base.span - 0.1, t0: 0.012, hold: 0.03, trail: 0.24, ramp: C.slice(0, 6) }, { lean: 0.2 });
    const end = slashEnd3(A), dir = [end.dx, end.dy, end.dz];
    let t = 0, lastU = 0, done = false;
    return {
      update(dt) {
        t += dt;
        // the wind under the blade kicks dust up off the floor as it passes, rolling on the way it goes
        const U = A.span * ease.outExpo(clamp(t / A.sweep));
        for (let u = lastU; u < U; u += 0.09) {
          const tr = travel3(A, u, A.R - 4), a = A.a0 + A.dir * u, near = Math.sin(a) >= 0, fy = near ? -1 : -3, sp = Rg.range(30, 90), out = Rg.range(0, 30);
          const ox = tr.x - A.c[0], oz = tr.z - A.c[2], ol = Math.hypot(ox, oz) || 1;
          ps.spawn3(P.SMOKE, tr.x, fy - Rg.range(0, 2), tr.z, tr.dx * sp + (ox / ol) * out, -Rg.range(4, 16), tr.dz * sp + (oz / ol) * out, Rg.range(0.7, 1.15), st.dust, Rg.range(3, 5.5), Rg.range(0, 0.05));
          if (Rg.chance(0.6)) ps.spawn3(P.GRIT, tr.x, fy, tr.z, tr.dx * Rg.range(40, 120) + (ox / ol) * Rg.range(-10, 50), -Rg.range(40, 130), tr.dz * Rg.range(40, 120) + (oz / ol) * Rg.range(-10, 50), Rg.range(0.6, 1.0), Rg.pick([st.light, st.body, st.shade]), Rg.chance(0.3) ? 2 : 1);
          if (Rg.chance(0.35)) ps.spawn3(P.MOTE, tr.x, tr.y, tr.z, tr.dx * Rg.range(40, 100), tr.dy * 40 - Rg.range(5, 20), tr.dz * Rg.range(40, 100), Rg.range(0.2, 0.4), Rg.chance(0.5) ? C[4] : C[5], 0.6);
        }
        lastU = U;
        if (!done && t >= A.sweep) {
          done = true;
          lights.add(end.x, end.y - 4, 50, C[3], 0.5, 0.35, end.z);
          for (let i = 0; i < 10; i++) {
            const [vx, vy, vz] = spray(Rg, dir, 0.8, Rg.range(120, 260));
            ps.spawn3(P.SPARK, end.x, end.y, end.z, vx, vy - 40, vz, Rg.range(0.12, 0.3));
          }
          // the wake piles up and rolls on past the tip
          for (let i = 0; i < 6; i++) ps.spawn3(P.SMOKE, end.x + Rg.range(-6, 4), -Rg.range(1, 4), end.z + Rg.range(-6, 6), end.dx * Rg.range(30, 90), -Rg.range(4, 14), end.dz * Rg.range(30, 90), Rg.range(0.9, 1.25), st.dust, Rg.range(4.5, 7), Rg.range(0, 0.08), PF.BIG);
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o);
        // the wind scuffs the floor under the blade: a flat arc on the floor, widest at the edge, fading out behind it
        const Uh = A.span * ease.outExpo(clamp(t / A.sweep)), Tl = A.span * clamp((t - 0.1) / 0.55), sc = 1 - clamp((t - 0.12) / 0.5);
        if (sc > 0 && Uh - Tl > 0.02) q.arc(A.c[0], 0, A.c[2], A.R + 1, 11, A.a0 - Uh, A.a0 - Tl, (u, v) => (v > 0.85 ? C[3] : v > 0.5 ? C[2] : C[1]), (u, v) => 0.5 * sc * (1 - u) * (v < 0.35 ? v / 0.35 : 1));
        slash3(q, E, t);
        slash3(q, A, t);
        const g = t - A.sweep * 0.6;
        if (g > 0 && g < 0.24) q.at(end.x, end.y, end.z, (pp) => sparkle(pp, 0, 0, 9 * ease.outBack(Math.min(1, g / 0.05)) * (1 - g / 0.24), C[5], C[3], 0.55));
        // light rides the edge
        if (t < A.sweep + 0.12) {
          const h = travel3(A, A.span * ease.outExpo(clamp(t / A.sweep)), A.R - 5);
          q.glow(h.x, h.y, 36, C[3], 0.45 * (1 - t / (A.sweep + 0.12)));
        }
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
