// The crescent shading, cooling ramp, dotted trace, glint and spark recipe is adapted from Sprite Fusion's
// open-source slash (https://www.spritefusion.com/pixel-art-vfx/slash), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, PF, Rng, fit, space, sparkle, clamp, smooth, ease, rand, TAU, WHITE, READY } from "../../core/index.js";
import { swing, onSwing, travel, smear, trace, glowAlong, lay, smear3, trace3, glowAlong3, onSwing3, travel3, spray } from "./_lib.js";

export const meta = {
  name: "Spin slash",
  desc: "The blade whirls once round the waist on a tilted plane, behind the body and back in front; the closed ring flares white, dissolves into a dotted trace and throws sparks.",
  tags: ["melee", "slash", "spin", "sword", "aoe", "combat", "one-shot"],
  size: [208, 104],
  origin: [104, 84],
  duration: 0.8,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#16224a", "#1f4a86", "#2a7fc0", "#48b8ec", "#9fe2ff", "#e2f7ff", "#ffffff"],
    sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"],
    radius: 46,
    seed: 3,
  },
};

const STANCE = { ...READY, weapon: "sword", fx: 12, fy: -21, sa: -0.85 };
// he really turns: forward, away from us, facing back, towards us, and round to the front
const WOUND = { ...STANCE, crouch: 6, lean: -2, yaw: 1.1, fx: 13, fy: -20, sa: 0.3, bx: 6, by: -24, ffx: 8, fbx: -8 };
const WIDE = { ...STANCE, crouch: 5, lean: 3, fx: 21, fy: -21, sa: 0.05, bx: -9, by: -23, ffx: 11, fbx: -11 };
export const act = {
  target: { x: 60 },
  poses: [
    [-0.46, STANCE],
    [-0.2, WOUND],
    [-0.02, { ...WOUND, crouch: 7, yaw: 1.3 }],
    [0, { ...WIDE, sa: -0.1, ghost: 1 }, "snap"],
    [0.05, { ...WIDE, yaw: -1.57, ghost: 1 }, "snap"],
    [0.09, { ...WIDE, yaw: -3.14, ghost: 1 }, "snap"],
    [0.13, { ...WIDE, yaw: -4.71, ghost: 1 }, "snap"],
    [0.17, WIDE, "snap"],
    [0.56, { ...WIDE, crouch: 4, lean: 2 }],
    [0.92, STANCE],
  ],
  hits: [{ t: 0.17, stop: 0.12, shake: 0.16, amp: 2, push: 2.4, straw: 16 }],
  dust: [{ t: 0, x: 0, n: 6 }, { t: 0.17, x: 12, n: 6, dir: 1 }],
};

const SW = 0.17; // the edge goes once round
const FLARE = 0.3; // the closed ring flares and dissolves
const turn = (t) => 1 - Math.pow(1 - clamp(t / SW), 1.6); // fraction of the turn the edge has made
const passedAt = (f) => SW * (1 - Math.pow(1 - clamp(f), 1 / 1.6)); // when the edge passed fraction f

export function create(o) {
  const C = fit(o.palette, 7), n = C.length, Rg = new Rng(o.seed), R0 = o.radius;
  const ps = new Particles({ rng: Rg, ground: () => 0, sparks: o.sparks }), lights = new Lights();
  // the spin starts front-right, goes up the right side, behind the body, down the left and back across the front
  const A = swing({ cx: 0, cy: -17, R: R0, sy: 0.27, rot: -0.1, a0: 0.5, dir: -1, k: 0.15 });
  // a thinner echo just inside, a beat behind
  const E = { ...A, R: R0 * 0.8, k: 0.1 };
  const W = 16, WE = 5;
  // the far half sits deeper in the ramp
  const DIM = [C[0], C[0], C[1], C[2], C[3], C[4], C[5]];
  let t = 0, closed = false, lastU = 0;

  // the smear: thickest just behind the edge, thinning and cooling where the edge passed longer ago
  const body = (p, s, w0, lag, half, rim) => {
    const U = TAU * turn(t - lag), ramp = half < 0 ? DIM : C;
    if (U < 0.02 || t - lag > SW + 0.02) return;
    smear(p, s, 0, U, w0, (u, r, out) => {
      const age = t - lag - passedAt(u / TAU), lead = U - u;
      const w = w0 * Math.pow(clamp(lead / 0.85), 0.5) * (0.3 + 0.7 * Math.exp(-age / 0.075)) * Math.pow(clamp(u / 1.3), 0.7);
      if (w < 0.45) return;
      const q = (s.R - r) / w;
      if (q < 0 || q > 1) return;
      // white rim while fresh, then darker steps inward, with age and towards the tail
      const ci = rim && q < 0.26 && age < 0.06 ? 0 : Math.round(q * (n - 1) * 0.7 + age * 13 + (rim ? 0.4 : 1.4));
      out.c = ramp[n - 1 - clamp(ci, 0, n - 1)];
      out.a = Math.min(1, u / 1.1 + 0.2);
    }, half);
  };

  const ring = (p, half) => {
    // the swept smear and its echo
    body(p, E, WE, 0.025, half, false);
    body(p, A, W, 0, half, true);
    if (t < SW + 0.04) glowAlong(p, A, A.R - 5, 0, TAU * turn(t), 14, C[3], (u) => (half < 0 ? 0.2 : 0.3) * Math.exp(-(t - passedAt(u / TAU)) / 0.08), half);
    if (t < SW) return;
    // closed: the ring flares white, swells a little, thins, cools and breaks into dots
    const f = (t - SW) / FLARE, ramp = half < 0 ? DIM : C;
    if (f < 1) {
      const R = A.R + 6 * ease.outCubic(f), th = f < 0.13 ? 9 : Math.max(1, 6 * Math.pow(1 - f, 1.5) + 0.5), S = { ...A, R };
      const step = f < 0.13 ? 6 : f < 0.3 ? 5 : f < 0.55 ? 4 : 3;
      smear(p, S, 0, TAU, th, (u, r, out) => {
        const q = (R - r) / th;
        if (q < 0 || q > 1) return;
        out.c = f < 0.13 ? (q < 0.6 ? WHITE : ramp[5]) : q < 0.45 ? ramp[step] : ramp[step - 1];
        out.a = f < 0.4 ? 1 : 1.3 - f;
      }, half);
      glowAlong(p, S, R - 2, 0, TAU, 14, C[4], 0.32 * (1 - f) * (1 - f), half);
    }
    // a dotted trace of the blade's path lingers where the ring was, fading
    const k = 1 - clamp((t - SW - 0.06) / 0.4);
    if (k > 0) trace(p, A, A.R - 0.5, 0, TAU, ramp[4], (u) => clamp(k * 1.5 - rand(Math.floor(u * 30), 5) * 0.8) * 0.95, half);
  };

  return {
    update(dt) {
      t += dt;
      const U = TAU * turn(t);
      // shavings peel off the edge as it goes round, flung along its path
      if (t < SW) {
        for (let u = lastU; u < U; u += 0.3) {
          const tr = travel(A, u), ox = tr.x - A.cx, oy = tr.y - A.cy, l = Math.hypot(ox, oy) || 1, sp = Rg.range(40, 120);
          ps.spawn(P.MOTE, tr.x, tr.y, tr.dx * sp + (ox / l) * sp * 0.35, tr.dy * sp * 0.6 - Rg.range(5, 30), Rg.range(0.22, 0.45), C[4 + Rg.int(0, 1)], 0.55, 0, Math.sin(tr.a) < 0 ? PF.BACK : 0);
        }
        lastU = U;
      }
      if (!closed && t >= SW) {
        closed = true;
        lights.add(A.cx, A.cy + 4, 90, C[3], 0.4, 0.4);
        // sparks off the edge where it closes, and all round the ring along its turn
        const end = travel(A, TAU);
        for (let i = 0; i < 9; i++) {
          const a = Math.atan2(end.dy, end.dx) + Rg.range(-0.45, 0.35), sp = Rg.range(160, 360);
          ps.spawn(P.SPARK, end.x, end.y, Math.cos(a) * sp, Math.sin(a) * sp - Rg.range(20, 70), Rg.range(0.14, 0.36));
        }
        for (let i = 0; i < 16; i++) {
          const u = Rg.range(0, TAU), tr = travel(A, u), sp = Rg.range(110, 260);
          ps.spawn(P.SPARK, tr.x, tr.y, tr.dx * sp, tr.dy * sp - Rg.range(20, 80), Rg.range(0.12, 0.32), 0, 1, 0, Math.sin(tr.a) < 0 ? PF.BACK : 0);
        }
        // and twinkles left hanging on the ring
        for (let i = 0; i < 6; i++) {
          const u = Rg.range(0, TAU), [x, y] = onSwing(A, A.R + Rg.range(-1, 3), u);
          ps.spawn(P.STAR, x, y, 0, -Rg.range(2, 8), Rg.range(0.25, 0.5), Rg.chance(0.5) ? C[5] : WHITE, Rg.range(1.2, 2.6), Rg.range(0.04, 0.16), Math.sin(A.a0 + A.dir * u) < 0 ? PF.BACK : 0);
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      ring(p, -1);
      ps.draw(p, "back");
    },
    draw(p) {
      ring(p, 1);
      // the blade catches the light as it sets off, and glints again where the ring closes
      if (t < 0.06) {
        const [x, y] = onSwing(A, A.R - 3, 0);
        sparkle(p, x, y, 7 * (1 - t / 0.06), C[5], C[3], 0.5);
      }
      const g = t - SW * 0.85, tip = onSwing(A, A.R - 3, TAU);
      if (g > 0 && g < 0.24) sparkle(p, tip[0], tip[1], 10 * ease.outBack(Math.min(1, g / 0.05)) * (1 - g / 0.24), C[5], C[3], 0.6);
      // light rides the edge
      if (t < SW + 0.05) {
        const U = TAU * turn(t), [x, y] = onSwing(A, A.R - 5, U), far = Math.sin(A.a0 + A.dir * U) < 0;
        p.glow(x, y, far ? 26 : 38, C[3], (far ? 0.3 : 0.5) * (1 - smooth(SW - 0.04, SW + 0.05, t)));
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

// 3D: not whirlwind's level hoop. The edge whirls round the waist on two tilted rings that cross like a gyroscope:
// the main ring leans one way, the thinner echo (a beat behind) leans the other, so each goes behind the body and back
// in front on its own slope and from any side one of them is open to the eye. The far half of each sits deeper in
// the ramp by real depth. A dotted shadow of the edge runs on the floor and the closed ring leaves a flat flare
// on it; shavings, sparks and twinkles leave in a full circle along the tangent, not only left and right.

export const three = {
  meta: { size: [184, 116], origin: [92, 88], camera: { pitch: 0.32 } },
  create(o) {
    const C = fit(o.palette, 7), n = C.length, Rg = new Rng(o.seed), R0 = o.radius, Y = -22;
    const ps = new Particles({ rng: Rg, ground: () => 0, sparks: o.sparks }), lights = new Lights();
    const base = swing({ cx: 0, cy: Y, R: R0, sy: 0.27, rot: -0.1, a0: 0.5, dir: -1 });
    const A = lay(base, { yaw: 0.35, lean: -0.08 });
    const E = lay({ ...base, cy: Y - 5, R: R0 * 0.8, a0: 0.5 + 1.6 }, { yaw: 0.35 + 2.75, lean: -0.43 });
    const W = 13, WE = 4, DIM = [C[0], C[0], C[1], C[2], C[3], C[4], C[5]];
    let t = 0, closed = false, lastU = 0;
    // a point of a laid ring is "far" when it lies behind the ring's centre for this camera
    const farAt = (q, S, r, a) => q.depth(S.c[0] + r * (S.U[0] * Math.cos(a) + S.V[0] * Math.sin(a)), Y, S.c[2] + r * (S.U[2] * Math.cos(a) + S.V[2] * Math.sin(a))) > q.depth(0, Y, 0);
    const farU = (q, S, r, u) => farAt(q, S, r, S.a0 + S.dir * u);

    // the smear: thickest just behind the edge, thinning and cooling where the edge passed longer ago
    const body = (q, S, w0, lag, rim) => {
      const U = TAU * turn(t - lag);
      if (U < 0.02 || t - lag > SW + 0.02) return;
      smear3(q, S, 0, U, w0, (u, r, out, a) => {
        const age = t - lag - passedAt(u / TAU), lead = U - u;
        const w = w0 * Math.pow(clamp(lead / 0.85), 0.5) * (0.3 + 0.7 * Math.exp(-age / 0.075)) * Math.pow(clamp(u / 1.3), 0.7);
        if (w < 0.45) return;
        const f = (S.R - r) / w;
        if (f < 0 || f > 1) return;
        const ramp = farAt(q, S, r, a) ? DIM : C;
        const ci = rim && f < 0.26 && age < 0.06 ? 0 : Math.round(f * (n - 1) * 0.7 + age * 13 + (rim ? 0.4 : 1.4));
        out.c = ramp[n - 1 - clamp(ci, 0, n - 1)];
        out.a = Math.min(1, u / 1.1 + 0.2);
      });
    };

    const ring = (q, S, closing) => {
      // the closed ring flares white, swells a little, thins, cools and breaks into dots
      const f = (t - SW) / FLARE;
      if (f >= 1) return;
      const R = S.R + 6 * ease.outCubic(f), th = f < 0.13 ? 6 : Math.max(1, 4.5 * Math.pow(1 - f, 1.5) + 0.5), step = f < 0.13 ? 6 : f < 0.3 ? 5 : f < 0.55 ? 4 : 3;
      const SS = { ...S, R };
      smear3(q, SS, 0, TAU, th, (u, r, out, a) => {
        const g = (R - r) / th;
        if (g < 0 || g > 1) return;
        const ramp = farAt(q, SS, r, a) ? DIM : C;
        out.c = f < 0.13 ? (g < 0.6 ? WHITE : ramp[5]) : g < 0.45 ? ramp[step] : ramp[step - 1];
        out.a = f < 0.4 ? 1 : 1.3 - f;
      });
      glowAlong3(q, SS, R - 2, 0, TAU, 14, C[4], 0.32 * (1 - f) * (1 - f) * closing);
    };

    return {
      update(dt) {
        t += dt;
        const U = TAU * turn(t);
        // shavings peel off the edge as it goes round, flung along its path and out of it
        if (t < SW) {
          for (let u = lastU; u < U; u += 0.3) {
            const tr = travel3(A, u), ox = tr.x, oz = tr.z, l = Math.hypot(ox, oz) || 1, sp = Rg.range(40, 120), o2 = sp * 0.35;
            ps.spawn3(P.MOTE, tr.x, tr.y, tr.z, tr.dx * sp + (ox / l) * o2, tr.dy * sp * 0.6 - Rg.range(5, 30), tr.dz * sp + (oz / l) * o2, Rg.range(0.22, 0.45), C[4 + Rg.int(0, 1)], 0.55);
          }
          lastU = U;
        }
        if (!closed && t >= SW) {
          closed = true;
          lights.add(0, Y + 4, 90, C[3], 0.4, 0.4, 0);
          lights.add(0, -3, 70, C[2], 0.3, 0.45, 0);
          // sparks off the edge where it closes, and all round the ring along its turn
          const end = travel3(A, TAU), dir = [end.dx, end.dy, end.dz];
          for (let i = 0; i < 9; i++) {
            const [vx, vy, vz] = spray(Rg, dir, 0.45, Rg.range(160, 360));
            ps.spawn3(P.SPARK, end.x, end.y, end.z, vx, vy - Rg.range(20, 70), vz, Rg.range(0.14, 0.36));
          }
          for (let i = 0; i < 20; i++) {
            const S = i % 4 === 3 ? E : A, u = Rg.range(0, TAU), tr = travel3(S, u), l = Math.hypot(tr.x, tr.z) || 1, sp = Rg.range(110, 260);
            ps.spawn3(P.SPARK, tr.x, tr.y, tr.z, tr.dx * sp * 0.8 + (tr.x / l) * sp * 0.45, tr.dy * sp - Rg.range(20, 80), tr.dz * sp * 0.8 + (tr.z / l) * sp * 0.45, Rg.range(0.12, 0.32), 0, 1);
          }
          // and twinkles left hanging on the ring
          for (let i = 0; i < 8; i++) {
            const S = i % 4 === 3 ? E : A, [x, y, z] = onSwing3(S, S.R + Rg.range(-1, 3), Rg.range(0, TAU));
            ps.spawn3(P.STAR, x, y, z, 0, -Rg.range(2, 8), 0, Rg.range(0.25, 0.5), Rg.chance(0.5) ? C[5] : WHITE, Rg.range(1.2, 2.6), Rg.range(0.04, 0.16));
          }
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), f = (t - SW) / FLARE, U = TAU * turn(t);
        // the echo, then the main smear
        body(q, E, WE, 0.025, false);
        body(q, A, W, 0, true);
        if (t < SW + 0.04) glowAlong3(q, A, A.R - 5, 0, U, 14, C[3], (u) => 0.3 * Math.exp(-(t - passedAt(u / TAU)) / 0.08));
        if (t < SW + 0.03) glowAlong3(q, E, E.R - 3, 0, TAU * turn(t - 0.025), 10, C[2], (u) => 0.2 * Math.exp(-(t - 0.025 - passedAt(u / TAU)) / 0.08));
        if (t >= SW) {
          ring(q, A, 1);
          // the echo flares too, a little weaker
          if (f < 0.7) ring(q, { ...E, R: E.R }, 0.5);
        }
        // a dotted trace of the blade's path lingers where the ring was, fading
        const k = 1 - clamp((t - SW - 0.06) / 0.4);
        if (t >= SW && k > 0) {
          trace3(q, A, A.R - 0.5, 0, TAU, (u) => (farU(q, A, A.R, u) ? DIM[4] : C[4]), (u) => clamp(k * 1.5 - rand(Math.floor(u * 30), 5) * 0.8) * 0.95);
          trace3(q, E, E.R - 0.5, 0, TAU, (u) => (farU(q, E, E.R, u) ? DIM[3] : C[3]), (u) => clamp(k * 1.3 - rand(Math.floor(u * 30), 9) * 0.8) * 0.7);
        }
        // the edge's shadow runs on the floor, then a flat flare marks where the ring closed
        if (t < SW + 0.2) {
          const fade = t < SW ? 1 : 1 - (t - SW) / 0.2;
          for (let u = 0; u < U; u += 0.045) {
            const [x, , z] = onSwing3(A, A.R - 2, u);
            q.dot(x, 0, z, C[2], 0.5 * fade * Math.exp(-(t - passedAt(u / TAU)) / 0.12));
          }
        }
        if (f > 0 && f < 1) q.ring(0, 0, 0, A.R + 3 + 9 * ease.outCubic(f), f < 0.15 ? 2.5 : 1.5, f < 0.15 ? C[5] : C[3], 0.7 * (1 - f) * (1 - f));
        // the blade catches the light as it sets off, and glints again where the ring closes
        if (t < 0.06) {
          const [x, y, z] = onSwing3(A, A.R - 3, 0);
          q.at(x, y, z, (pp) => sparkle(pp, 0, 0, 7 * (1 - t / 0.06), C[5], C[3], 0.5));
        }
        const g = t - SW * 0.85, tip = onSwing3(A, A.R - 3, TAU);
        if (g > 0 && g < 0.24) q.at(tip[0], tip[1], tip[2], (pp) => sparkle(pp, 0, 0, 10 * ease.outBack(Math.min(1, g / 0.05)) * (1 - g / 0.24), C[5], C[3], 0.6));
        // light rides the edge
        if (t < SW + 0.05) {
          const [x, y, z] = onSwing3(A, A.R - 5, U), far = farAt(q, A, A.R - 5, A.a0 + A.dir * U);
          q.glow(x, y, z, far ? 26 : 38, C[3], (far ? 0.3 : 0.5) * (1 - smooth(SW - 0.04, SW + 0.05, t)));
        }
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
