// The star's key frames and the spark spray are adapted from Sprite Fusion's open-source impact
// (https://www.spritefusion.com/pixel-art-vfx/impact), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, clamp, smooth, ease, space, TAU, WHITE } from "../../core/index.js";
import { star, brokenRing, onSphere, star3, brokenRing3 } from "./_lib.js";

export const meta = {
  name: "Parry",
  desc: "Two blades clash: their edges flash in an X, a white four-point star rings out, a ring breaks into arcs and a fan of gold sparks sprays up and rains down.",
  tags: ["impact", "parry", "block", "clash", "sword", "metal", "sparks", "one-shot"],
  size: [200, 112],
  origin: [100, 96],
  duration: 1,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#2a1a08", "#6a4410", "#b07a1a", "#e8b030", "#ffe066", "#fff6c4", "#ffffff"], height: 30, seed: 11 },
};

export function create(o) {
  const C = fit(o.palette, 7), R = new Rng(o.seed), X = 0, Y = -o.height, floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[4], C[4], C[3], C[2]] });
  const lights = new Lights();
  // a hard four-point star: long arms on the axes, short ones between
  const sp = [];
  for (let i = 0; i < 8; i++) sp.push({ a: (i * Math.PI) / 4 + R.range(-0.04, 0.04), len: i % 2 ? R.range(6, 8) : i % 4 === 0 ? R.range(19, 22) : R.range(14, 17), w: i % 2 ? 1.2 : 2.2 });
  const segs = Array.from({ length: 6 }, (_, i) => ({ a: (i / 6) * TAU + R.range(-0.1, 0.1), gap: R.range(0.55, 0.8), dr: R.range(0.1, 0.35) }));
  // the two edges that met: lines crossing in an X
  const edges = [-0.62 + R.range(-0.08, 0.08), Math.PI + 0.62 + R.range(-0.08, 0.08)];

  lights.add(X, Y, 60, C[4], 0.65, 0.4);
  lights.add(X, Y, 22, WHITE, 0.8, 0.08);
  // the fan: sparks thrown up and out to both sides, arcing over and raining down to bounce on the floor
  for (let i = 0; i < 24; i++) {
    const s = i % 2 ? 1 : -1, a = -Math.PI / 2 + s * R.range(0.3, 1.3), v = R.range(130, 290);
    ps.spawn(P.SPARK, X + s * R.range(1, 3), Y, Math.cos(a) * v, Math.sin(a) * v, R.range(0.45, 0.85), WHITE, 1, i > 17 ? R.range(0.02, 0.07) : 0);
  }
  for (let i = 0; i < 8; i++) {
    const a = R.range(0, TAU), v = R.range(40, 110);
    ps.spawn(P.MOTE, X, Y, Math.cos(a) * v, Math.sin(a) * v - 20, R.range(0.3, 0.55), R.pick([C[5], C[6]]), 0.6, R.range(0, 0.04));
  }
  for (let i = 0; i < 3; i++) {
    const a = R.range(0, TAU), d = R.range(12, 26);
    ps.spawn(P.STAR, X + Math.cos(a) * d, Y + Math.sin(a) * d, 0, -3, R.range(0.22, 0.34), WHITE, R.range(1.6, 2.6), R.range(0.1, 0.3));
  }

  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      // the ring: rings out off the star and breaks into arcs that fly on and cool
      const u = (t - 0.03) / 0.36;
      if (u >= 0 && u < 1) {
        const r = 8 + 24 * ease.outCubic(u), brk = smooth(0.15, 0.6, u), i = u < 0.15 ? 6 : u < 0.35 ? 5 : u < 0.6 ? 4 : 3;
        brokenRing(p, X, Y, r, Math.max(1, 2.6 * Math.pow(1 - u, 1.2)), segs, brk, C[i], C[Math.max(2, i - 2)], u < 0.6 ? 1 : (1 - u) / 0.4, 1, 0);
        if (u < 0.5) p.glowRing(X, Y, r, 5, C[4], 0.3 * (1 - u / 0.5));
      }
      ps.draw(p);
      // the edges flash where they met
      if (t < 0.058)
        for (const a of edges) {
          const ca = Math.cos(a), sa = Math.sin(a), L = t < 0.025 ? 26 : 32, k = t < 0.025 ? 1 : 0.6;
          for (let d = -L; d <= L; d += 0.5) {
            const q = Math.abs(d) / L;
            p.dot(X + ca * d, Y + sa * d, q < 0.4 ? WHITE : q < 0.75 ? C[5] : C[4], q < 0.6 ? 1 : k * (1.3 - q));
          }
          p.glowLine(X - ca * L, Y - sa * L, X + ca * L, Y + sa * L, 4, C[5], 0.35 * k);
        }
      // the star: white, then bigger and gold as it thins, then just a glint
      if (t < 0.025) star(p, X, Y, sp, 1, 1, [C[4], WHITE, WHITE, WHITE], 1, 2.6);
      else if (t < 0.058) star(p, X, Y, sp, 1.25, 0.65, [C[2], C[5], C[6], WHITE], 1, 2.6);
      else if (t < 0.092) star(p, X, Y, sp, 1.4, 0.3, [C[2], C[4], C[5], C[6]], 1, 2);
      const pop = Math.exp(-t / 0.05);
      if (pop > 0.02) {
        p.glow(X, Y, 30, C[4], 0.5 * pop);
        p.glow(X, Y, 10, WHITE, 0.4 * pop);
      }
      lights.draw(p);
    },
  };
}

// 3D: the two blades cross in depth, the star is an octahedral cross with its long arms along the blades' axis, the
// ring is a shell of three rings that break into arcs, and the gold sparks fountain up and out all round.
export const three = {
  meta: { size: [208, 136], origin: [104, 102], bg: "ground", camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 7), R = new Rng(o.seed), Y = -o.height, floor = () => 0;
    const ps = new Particles({ rng: R, ground: floor, sparks: [C[4], C[4], C[3], C[2]] });
    const lights = new Lights();
    // a hard star: long arms along x, mid arms up, down and across, short ones on the cube's diagonals
    const arm = (d, len, w) => ({ d, len, w });
    const sp = [
      arm([1, 0, 0], R.range(19, 22), 2.2), arm([-1, 0, 0], R.range(19, 22), 2.2),
      arm([0, -1, 0], R.range(14, 17), 2.2), arm([0, 1, 0], R.range(14, 17), 2.2),
      arm([0, 0, 1], R.range(14, 17), 2.2), arm([0, 0, -1], R.range(14, 17), 2.2),
    ];
    for (const [x, y, z] of [[1, -1, 1], [-1, -1, 1], [1, -1, -1], [-1, -1, -1], [1, 1, 1], [-1, 1, 1], [1, 1, -1], [-1, 1, -1]]) sp.push(arm([x * 0.577, y * 0.577, z * 0.577], R.range(6, 8), 1.2));
    const segs = Array.from({ length: 6 }, (_, i) => ({ a: (i / 6) * TAU + R.range(-0.1, 0.1), gap: R.range(0.55, 0.8), dr: R.range(0.1, 0.35) }));
    const shell = [null, [0, 0, 1], [1, 0, 0]].map((n, j) => ({ n, segs: segs.map((s) => ({ ...s, a: s.a + j * 1.1 })) }));
    // the two edges that met: lines crossing in an X, one a little nearer, one a little further
    const unit = (v) => v.map((c) => c / Math.hypot(...v));
    const edges = [-0.62 + R.range(-0.08, 0.08), Math.PI + 0.62 + R.range(-0.08, 0.08)].map((a, i) => unit([Math.cos(a), Math.sin(a), i ? -0.4 : 0.4]));

    lights.add(0, Y, 60, C[4], 0.65, 0.4);
    lights.add(0, Y, 22, WHITE, 0.8, 0.08);
    // the fountain: sparks thrown up and out in every direction round the vertical, arcing over and raining down
    for (let i = 0; i < 28; i++) {
      const tilt = R.range(0.3, 1.3), az = R.range(0, TAU), v = R.range(130, 290), rr = R.range(1, 3);
      const dx = Math.sin(tilt) * Math.cos(az), dy = -Math.cos(tilt), dz = Math.sin(tilt) * Math.sin(az);
      ps.spawn3(P.SPARK, dx * rr, Y, dz * rr, dx * v, dy * v, dz * v, R.range(0.45, 0.85), WHITE, 1, i > 20 ? R.range(0.02, 0.07) : 0);
    }
    for (let i = 0; i < 8; i++) {
      const d = onSphere(R), v = R.range(40, 110);
      ps.spawn3(P.MOTE, 0, Y, 0, d[0] * v, d[1] * v - 20, d[2] * v, R.range(0.3, 0.55), R.pick([C[5], C[6]]), 0.6, R.range(0, 0.04));
    }
    for (let i = 0; i < 3; i++) {
      const d = onSphere(R), r = R.range(12, 26);
      ps.spawn3(P.STAR, d[0] * r, Y + d[1] * r, d[2] * r, 0, -3, 0, R.range(0.22, 0.34), WHITE, R.range(1.6, 2.6), R.range(0.1, 0.3));
    }
    let t = 0;
    return {
      update(dt) {
        t += dt;
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), u = (t - 0.03) / 0.36;
        // the ring: rings out off the star and breaks into arcs that fly on and cool
        if (u >= 0 && u < 1) {
          const r = 8 + 24 * ease.outCubic(u), brk = smooth(0.15, 0.6, u), i = u < 0.15 ? 6 : u < 0.35 ? 5 : u < 0.6 ? 4 : 3;
          for (const s of shell) brokenRing3(q, 0, Y, 0, r, Math.max(1, 2.6 * Math.pow(1 - u, 1.2)), s.segs, brk, C[i], C[Math.max(2, i - 2)], u < 0.6 ? 1 : (1 - u) / 0.4, s.n, u < 0.5 ? 0.3 * (1 - u / 0.5) : 0, C[4]);
        }
        ps.draw(q);
        // the edges flash where they met
        if (t < 0.058)
          for (const d of edges) {
            const L = t < 0.025 ? 26 : 32, k = t < 0.025 ? 1 : 0.6;
            q.beam(-d[0] * L, Y - d[1] * L, -d[2] * L, d[0] * L, Y + d[1] * L, d[2] * L, 1.4, (uu) => {
              const m = Math.abs(2 * uu - 1);
              return m < 0.4 ? WHITE : m < 0.75 ? C[5] : C[4];
            }, (uu) => {
              const m = Math.abs(2 * uu - 1);
              return m < 0.6 ? 1 : k * (1.3 - m);
            });
            q.glowLine(-d[0] * L, Y - d[1] * L, -d[2] * L, d[0] * L, Y + d[1] * L, d[2] * L, 4, C[5], 0.35 * k);
          }
        // the star: white, then bigger and gold as it thins, then just a glint
        if (t < 0.025) star3(q, 0, Y, 0, sp, 1, 1, [C[4], WHITE, WHITE, WHITE], 1, 2.6);
        else if (t < 0.058) star3(q, 0, Y, 0, sp, 1.25, 0.65, [C[2], C[5], C[6], WHITE], 1, 2.6);
        else if (t < 0.092) star3(q, 0, Y, 0, sp, 1.4, 0.3, [C[2], C[4], C[5], C[6]], 1, 2);
        const pop = Math.exp(-t / 0.05);
        if (pop > 0.02) {
          q.glow(0, Y, 0, 30, C[4], 0.5 * pop);
          q.glow(0, Y, 0, 10, WHITE, 0.4 * pop);
        }
        lights.draw(q);
      },
    };
  },
};
