// The crescent recipe is adapted from Sprite Fusion's open-source slash, and the star from his impact
// (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, hex, clamp, smooth, ease, space, TAU, WHITE, READY } from "../../core/index.js";
import { swing, onSwing, slash, slashEnd, star, lay, slash3, slashEnd3, travel3 } from "./_lib.js";

export const meta = {
  name: "Uppercut",
  desc: "A crescent rises from the floor past the face, and at the top a comic impact star bursts: bold outline, hot core, burst lines, twinkles and sparks.",
  tags: ["melee", "uppercut", "punch", "rising", "launcher", "comic", "combat", "directional", "one-shot"],
  size: [132, 128],
  origin: [48, 110],
  duration: 0.85,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#3a1408", "#7a2a10", "#c4501a", "#f08a2a", "#ffc94a", "#fff2a8", "#ffffff"],
    outline: "#2a0a08",
    sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"],
    seed: 11,
  },
};

const FISTS = { ...READY, fx: 12, fy: -25, bx: 9, by: -27, crouch: 3, lean: 1 };
const COIL = { ...FISTS, crouch: 7, lean: 3, fx: 8, fy: -11, bx: 8, by: -27, ffx: 10, fbx: -9 };
const TOP = { ...FISTS, x: 1, y: -11, crouch: -1, lean: 2, fx: 12, fy: -42, bx: -6, by: -21, ffx: 8, ffy: -8, fbx: -3, fby: -2, toeB: true, ghost: 1 };
export const act = {
  target: { x: 44 },
  poses: [
    [-0.42, FISTS],
    [-0.16, COIL],
    [0, { ...COIL, crouch: 8 }],
    [0.03, { ...FISTS, y: -4, crouch: 1, lean: 4, fx: 18, fy: -27, bx: -5, by: -23, ffx: 9, fbx: -7, toeB: true, ghost: 1 }, "snap"],
    [0.076, TOP, "snap"],
    [0.3, { ...TOP, y: -13, ghost: undefined }],
    [0.56, { ...TOP, y: 0, crouch: 2, fx: 13, fy: -31, ffx: 7, ffy: -6, fbx: -5, fby: -5, ghost: undefined }, "in"],
    [0.6, { ...FISTS, y: 0, crouch: 7, lean: 3, fx: 12, fy: -14, bx: -6, by: -16, ffx: 10, fbx: -9 }, "snap"],
    [0.98, FISTS],
  ],
  hits: [{ t: 0.076, stop: 0.13, shake: 0.18, amp: 2, push: -2.6, straw: 18, y: -34 }],
  dust: [{ t: 0.03, x: 8, n: 6 }, { t: 0.6, x: 0, n: 6 }],
};

export function create(o) {
  const C = fit(o.palette, 7), INK = hex(o.outline), Rg = new Rng(o.seed), ps = new Particles({ rng: Rg, ground: () => 0, sparks: o.sparks }), lights = new Lights();
  // up from the floor in front, bowing forward past the face, to the top
  const A = swing({ cx: 8, cy: -25, R: 27, sy: 1, rot: 0, a0: 1.08, dir: -1, span: 2.5, W: 13, t0: 0.02, sweep: 0.07, hold: 0.05, trail: 0.22, ramp: C });
  const top = slashEnd(A), SX = top.x + 3, SY = top.y - 5, HIT = A.t0 + A.sweep * 0.8;
  const spikes = Array.from({ length: 10 }, (_, i) => ({ a: (i / 10) * TAU + Rg.range(-0.12, 0.12) - Math.PI / 2, len: (i % 2 ? 7 : 13) + Rg.range(0, 4), w: i % 2 ? 2.2 : 3 }));
  const bursts = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * TAU + 0.2 + Rg.range(-0.15, 0.15), r0: Rg.range(15, 18), L: Rg.range(5, 9) }));
  let t = 0, hit = false, kicked = false;
  return {
    update(dt) {
      t += dt;
      if (!kicked) {
        kicked = true;
        // the fist comes up off the floor
        for (let i = 0; i < 4; i++) ps.spawn(P.DUST, 18 + Rg.range(-4, 4), -1, Rg.range(-30, 30), -Rg.range(5, 20), Rg.range(0.3, 0.55), "#6a6080", Rg.range(1.5, 2.6));
      }
      if (!hit && t >= HIT) {
        hit = true;
        lights.add(SX, SY, 56, C[4], 0.6, 0.4);
        lights.add(SX, SY, 18, WHITE, 0.7, 0.08);
        for (let i = 0; i < 16; i++) {
          const a = -Math.PI / 2 + Rg.range(-1.6, 1.6), sp = Rg.range(120, 320);
          ps.spawn(P.SPARK, SX, SY, Math.cos(a) * sp, Math.sin(a) * sp, Rg.range(0.15, 0.45));
        }
        for (let i = 0; i < 6; i++) {
          const a = Rg.range(0, TAU), d = Rg.range(14, 24);
          ps.spawn(P.STAR, SX + Math.cos(a) * d, SY + Math.sin(a) * d, Math.cos(a) * 20, Math.sin(a) * 20 - 10, Rg.range(0.25, 0.5), Rg.chance(0.5) ? C[5] : WHITE, Rg.range(1.4, 2.6), Rg.range(0.04, 0.18));
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      slash(p, A, t);
      // speed lines rising beside the crescent while it goes up
      const u = t - A.t0;
      if (u > 0 && u < 0.16)
        for (const [dx, y0, L] of [[A.cx + A.R + 7, -16, 18], [A.cx + A.R + 11, -30, 12], [A.cx - 4, -40, 10]]) {
          const k = u / 0.16, y = y0 - 30 * k;
          for (let d = 0; d < L; d += 1) p.dot(dx, y + d, d < 3 ? WHITE : d < L * 0.5 ? C[5] : C[3], (1 - d / L) * (1 - k));
        }
      if (u > 0 && u < A.sweep + 0.06) {
        const [x, y] = onSwing(A, A.R - 5, A.span * ease.outExpo(clamp(u / A.sweep)));
        p.glow(x, y, 34, C[3], 0.45 * (1 - u / (A.sweep + 0.06)));
      }
      // the comic star: pops past full size, holds, then shrinks away turning, with burst lines round it
      const q = t - HIT;
      if (q >= 0 && q < 0.36) {
        const pop = ease.outBack(clamp(q / 0.05), 2.6), out = 1 - smooth(0.16, 0.36, q), sc = pop * (0.35 + 0.65 * out), turn = q * 1.2;
        const sp = spikes.map((s) => ({ ...s, a: s.a + turn }));
        if (sc > 0.08) {
          star(p, SX, SY, sp, sc * 1.12, 1, INK, INK, INK, INK);
          star(p, SX, SY, sp, sc, 1, q < 0.05 ? WHITE : C[6], C[4], C[3], C[2]);
        }
        p.glow(SX, SY, 30, C[4], 0.45 * out);
      }
      if (q >= 0.02 && q < 0.24) {
        // a ring bursts out round the star, white to orange, breaking into dots
        const k = (q - 0.02) / 0.22, r = 7 + 17 * ease.outCubic(k), th = Math.max(1, 2.2 * (1 - k)), col = k < 0.25 ? WHITE : k < 0.5 ? C[5] : k < 0.75 ? C[4] : C[3];
        for (let a = 0; a < TAU; a += 0.6 / r) for (let o = 0; o < th; o += 0.5) p.dot(SX + Math.cos(a) * (r - o), SY + Math.sin(a) * (r - o), col, 1.15 - k);
      }
      if (q >= 0.02 && q < 0.2) {
        const k = (q - 0.02) / 0.18;
        for (const b of bursts) {
          const r0 = b.r0 + 10 * ease.outCubic(k), ca = Math.cos(b.a), sa = Math.sin(b.a);
          p.line(SX + ca * r0, SY + sa * r0, SX + ca * (r0 + b.L * (1 - k)), SY + sa * (r0 + b.L * (1 - k)), k < 0.4 ? WHITE : C[5], 1.1 - k);
        }
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}

// 3D: the crescent rises on the steep plane the fist travels in, with two thinner ones fanned either side so it
// reads from the flanks. At the top the comic star is the same from every side (a billboard), its burst lines
// shoot out in a ball, its ring is round it upright and flat, sparks leave in a cone, a column of streaks rises
// round the arm's line, and the launch kicks a ring of dust off the floor.

export const three = {
  meta: { size: [140, 132], origin: [70, 112], camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 7), INK = hex(o.outline), Rg = new Rng(o.seed), ps = new Particles({ rng: Rg, ground: () => 0, sparks: o.sparks }), lights = new Lights();
    const base = swing({ cx: 8, cy: -25, R: 27, sy: 1, rot: 0, a0: 1.08, dir: -1, span: 2.5, W: 13, t0: 0.02, sweep: 0.07, hold: 0.05, trail: 0.22, ramp: C });
    const A = lay(base);
    const echo = { ...base, R: 23, W: 5, a0: base.a0 - 0.22, span: 2.2, t0: 0.035, hold: 0.03, trail: 0.2, ramp: C.slice(0, 6) };
    const E1 = lay(echo, { yaw: 0.5 }), E2 = lay({ ...echo, R: 21, t0: 0.045, span: 2.0 }, { yaw: -0.5 });
    const top = slashEnd3(A), SX = top.x + 3, SY = top.y - 5, HIT = A.t0 + A.sweep * 0.8;
    const spikes = Array.from({ length: 10 }, (_, i) => ({ a: (i / 10) * TAU + Rg.range(-0.12, 0.12) - Math.PI / 2, len: (i % 2 ? 7 : 13) + Rg.range(0, 4), w: i % 2 ? 2.2 : 3 }));
    // burst lines leave the star in a ball
    const ball = (i, m) => {
      const y = 1 - (2 * (i + 0.5)) / m, rr = Math.sqrt(1 - y * y), az = i * 2.4;
      return [Math.cos(az) * rr, y, Math.sin(az) * rr];
    };
    const bursts = Array.from({ length: 14 }, (_, i) => ({ d: ball(i, 14), r0: Rg.range(15, 18), L: Rg.range(5, 9) }));
    // the column of streaks rising round the line of the arm
    const column = Array.from({ length: 12 }, (_, i) => ({ a: (i / 12) * TAU + Rg.range(-0.2, 0.2), r: Rg.range(6, 13), L: Rg.range(14, 24), lag: Rg.range(0, 0.04) }));
    let t = 0, hit = false, kicked = false;
    return {
      update(dt) {
        t += dt;
        if (!kicked) {
          kicked = true;
          // the fist comes up off the floor: a ring of dust all round
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * TAU + Rg.range(-0.3, 0.3), sp = Rg.range(20, 50);
            ps.spawn3(P.DUST, 18 + Math.cos(a) * 4, -1, Math.sin(a) * 4, Math.cos(a) * sp, -Rg.range(5, 22), Math.sin(a) * sp, Rg.range(0.35, 0.6), "#7a7090", Rg.range(2, 3.4));
          }
        }
        if (!hit && t >= HIT) {
          hit = true;
          lights.add(SX, SY, 56, C[4], 0.6, 0.4, 0);
          lights.add(SX, SY, 18, WHITE, 0.7, 0.08, 0);
          // sparks in a cone, wide of the star, mostly up
          for (let i = 0; i < 22; i++) {
            const tl = Rg.range(0, 1.5), az = Rg.range(0, TAU), sp = Rg.range(120, 320);
            ps.spawn3(P.SPARK, SX, SY, 0, Math.sin(tl) * Math.cos(az) * sp * 0.8, -Math.cos(tl) * sp, Math.sin(tl) * Math.sin(az) * sp * 0.8, Rg.range(0.15, 0.45));
          }
          for (let i = 0; i < 8; i++) {
            const [dx, dy, dz] = ball(i + 3, 14), d = Rg.range(14, 24);
            ps.spawn3(P.STAR, SX + dx * d, SY + dy * d, dz * d, dx * 20, dy * 20 - 10, dz * 20, Rg.range(0.25, 0.5), Rg.chance(0.5) ? C[5] : WHITE, Rg.range(1.4, 2.6), Rg.range(0.04, 0.18));
          }
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o);
        slash3(q, E2, t);
        slash3(q, E1, t);
        slash3(q, A, t);
        const u = t - A.t0;
        // speed lines rising beside the crescent while it goes up, spread out in depth
        if (u > 0 && u < 0.16)
          for (const [x, y0, L, z] of [[A.cx + A.R + 7, -16, 18, 0], [A.cx + A.R + 11, -30, 12, 6], [A.cx - 4, -40, 10, -4], [A.cx + A.R + 5, -22, 14, -11], [A.cx + A.R + 9, -34, 10, 12], [A.cx - 6, -28, 12, 10]]) {
            const k = u / 0.16, y = y0 - 30 * k;
            for (let d = 0; d < L; d += 1) q.dot(x, y + d, z, d < 3 ? WHITE : d < L * 0.5 ? C[5] : C[3], (1 - d / L) * (1 - k));
          }
        if (u > 0 && u < A.sweep + 0.06) {
          const h = travel3(A, A.span * ease.outExpo(clamp(u / A.sweep)), A.R - 5);
          q.glow(h.x, h.y, h.z, 34, C[3], 0.45 * (1 - u / (A.sweep + 0.06)));
        }
        // the shock off the floor as the fist leaves it
        const f = (t - 0.03) / 0.22;
        if (f > 0 && f < 1) {
          const r = 4 + 20 * ease.outCubic(f), w = Math.max(1.5, 3.2 * (1 - f));
          q.ring(18, 0, 0, r, w, (v) => (v > 0.7 ? WHITE : v > 0.35 ? C[5] : C[3]), Math.min(1, 1.3 - f));
          q.glow(18, -1, 0, 16, C[3], 0.3 * (1 - f));
        }
        const s = t - HIT;
        // the comic star: pops past full size, holds, then shrinks away turning (a billboard, the same from every side)
        if (s >= 0 && s < 0.36) {
          const pop = ease.outBack(clamp(s / 0.05), 2.6), out = 1 - smooth(0.16, 0.36, s), sc = pop * (0.35 + 0.65 * out), turn = s * 1.2;
          const sp = spikes.map((sk) => ({ ...sk, a: sk.a + turn }));
          if (sc > 0.08)
            q.at(SX, SY, 0, (pp, kz) => {
              const z0 = pp.z;
              pp.z = z0 + 0.5;
              star(pp, 0, 0, sp, sc * 1.12 * kz, 1, INK, INK, INK, INK);
              pp.z = z0;
              star(pp, 0, 0, sp, sc * kz, 1, s < 0.05 ? WHITE : C[6], C[4], C[3], C[2]);
            });
          q.glow(SX, SY, 0, 30, C[4], 0.45 * out);
        }
        if (s >= 0.02 && s < 0.24) {
          // a ring bursts out round the star, white to orange: upright round it and flat across it
          const k = (s - 0.02) / 0.22, r = 7 + 17 * ease.outCubic(k), th = Math.max(1, 2.2 * (1 - k)), col = k < 0.25 ? WHITE : k < 0.5 ? C[5] : k < 0.75 ? C[4] : C[3];
          q.at(SX, SY, 0, (pp, kz) => {
            pp.z -= 1;
            for (let a = 0; a < TAU; a += 0.6 / (r * kz)) for (let ov = 0; ov < th * kz; ov += 0.5) pp.dot(Math.cos(a) * (r - ov) * kz, Math.sin(a) * (r - ov) * kz, col, 1.15 - k);
          });
          q.ring(SX, SY, 0, r, th, col, (1.15 - k) * 0.8);
        }
        if (s >= 0.02 && s < 0.2) {
          const k = (s - 0.02) / 0.18;
          for (const b of bursts) {
            const r0 = b.r0 + 10 * ease.outCubic(k), r1 = r0 + b.L * (1 - k);
            q.line(SX + b.d[0] * r0, SY + b.d[1] * r0, b.d[2] * r0, SX + b.d[0] * r1, SY + b.d[1] * r1, b.d[2] * r1, k < 0.4 ? WHITE : C[5], 1.1 - k);
          }
        }
        // the upward burst: streaks race up the column round the arm, white to orange
        if (s >= 0 && s < 0.22)
          for (const c of column) {
            const k = clamp((s - c.lag) / 0.2);
            if (k <= 0 || k >= 1) continue;
            const y1 = -4 + (SY - 12) * ease.outCubic(k), x = 18 + (SX - 18) * k + Math.cos(c.a) * c.r, z = Math.sin(c.a) * c.r;
            q.line(x, y1, z, x, y1 + c.L * (1 - k * 0.5), z, (v) => (v < 0.3 ? WHITE : v < 0.65 ? C[5] : C[3]), 1 - k * 0.8);
          }
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
