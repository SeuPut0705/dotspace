import { Particles, Bits, Lights, P, B, Rng, fit, space, ease, seg, clamp, mix, TAU, WHITE, PAL } from "../../core/index.js";

export const meta = {
  name: "Shockwave",
  desc: "A ground slam in 3D: a white flash, a shock ring racing out across the floor as a true circle, stone chunks thrown every way, a ring of dust rolling out.",
  tags: ["3d", "impact", "ground", "slam", "shockwave", "rocks", "dust", "one-shot"],
  size: [184, 124],
  origin: [92, 82],
  duration: 1.9,
  loop: false,
  fps: 30,
  bg: "ground",
  camera: { pitch: 0.42 },
  options: { palette: ["#2a1712", "#5e2c1c", "#a4502a", "#e8893a", "#ffc764", "#fff0b4", "#ffffff"], stone: PAL.stone, dust: PAL.dust, reach: 66, seed: 3 },
};

const WAVE = 0.55; // seconds for the ring to run out

export function create(o) {
  const C = fit(o.palette, 7), S = fit(o.stone, 6), Dc = fit(o.dust, 7), R = new Rng(o.seed), REACH = o.reach;
  const floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[6], C[5], C[4], C[3]] });
  const bits = new Bits({ ground: floor }), lights = new Lights();
  const ring = (t) => 4 + (REACH - 4) * ease.outCubic(clamp(t / WAVE));
  // cracks: jagged lines on the floor, out from the center
  const cracks = Array.from({ length: 9 }, (_, i) => {
    let a = (i / 9) * TAU + R.range(-0.25, 0.25), r = R.range(3, 6);
    const len = R.range(18, 34), pts = [[Math.cos(a) * r, Math.sin(a) * r]];
    while (r < len) (r += R.range(3, 6)), (a += R.range(-0.3, 0.3)), pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    return pts;
  });
  lights.add(0, -6, 66, C[4], 0.9, 0.55);
  lights.add(0, -3, 34, C[6], 0.8, 0.18);
  for (let i = 0; i < 26; i++) {
    const a = R.range(0, TAU), sp = R.range(40, 135), big = R.chance(0.3);
    bits.add({
      kind: B.CHUNK, x: Math.cos(a) * 3, y: -1, z: Math.sin(a) * 3, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: -R.range(150, big ? 260 : 380),
      a: R.range(0, TAU), va: R.range(-16, 16), s: big ? R.range(2.6, 3.6) : R.range(1.2, 2.2), ramp: S.slice(1), bounce: 0.38, drag: 0.5, life: R.range(1.2, 1.7),
    });
  }
  for (let i = 0; i < 30; i++) {
    const a = R.range(0, TAU), sp = R.range(110, 260);
    ps.spawn3(P.SPARK, 0, -2, 0, Math.cos(a) * sp, -R.range(80, 300), Math.sin(a) * sp, R.range(0.25, 0.65));
  }
  // a column of dust punched up from the center
  for (let i = 0; i < 10; i++) {
    const a = R.range(0, TAU);
    ps.spawn3(P.DUST, Math.cos(a) * 3, -3, Math.sin(a) * 3, Math.cos(a) * 18, -R.range(30, 70), Math.sin(a) * 18, R.range(0.6, 1.0), mix(Dc[4], WHITE, 0.15), R.range(3, 5), R.range(0, 0.08));
  }
  let t = 0, acc = 0;
  return {
    update(dt) {
      t += dt;
      // the dust wave: puffs kicked up where the ring is passing
      if (t < WAVE) for (acc += dt * 90; acc > 1; acc--) {
        const a = R.range(0, TAU), r = ring(t), out = R.range(14, 34);
        ps.spawn3(P.DUST, Math.cos(a) * r, -1.5, Math.sin(a) * r, Math.cos(a) * out, -R.range(4, 22), Math.sin(a) * out, R.range(0.5, 1.0), R.chance(0.5) ? Dc[4] : Dc[3], R.range(2.5, 4.5) * (1 - t / WAVE * 0.4));
      }
      ps.update(dt);
      bits.update(dt);
      lights.update(dt);
    },
    draw(p) {
      const q = space(p, o), r = ring(t), k = 1 - seg(t, 0.05, WAVE + 0.2);
      // glowing cracks, cooling from white to ember to soot
      const heat = 1 - seg(t, 0.05, 1.3);
      if (t < 1.6) for (const c of cracks) {
        const reach = clamp(t / 0.12) * c.length;
        for (let i = 1; i < reach; i++) {
          const [x0, z0] = c[i - 1], [x1, z1] = c[i], u = i / c.length;
          q.line(x0, 0, z0, x1, 0, z1, heat > 0.75 ? C[6] : heat > 0.45 ? C[5] : heat > 0.2 ? C[3] : C[1], clamp((1.6 - t) * 2) * (1 - u * 0.4));
          if (heat > 0.1) q.glow(x1, 0, z1, 8, C[4], 0.25 * heat * (1 - u));
        }
      }
      // the shock ring: a hot leading rim, a cooler trailing band, light on the floor under it
      if (k > 0) {
        const w = 3 + 9 * seg(t, 0, WAVE);
        q.plane(0, 0, 0, null, r, (u, v, out) => {
          const d = Math.hypot(u, v), b = (r - d) / w;
          if (b < 0 || b > 1) return;
          out.c = b < 0.25 ? (k > 0.6 ? WHITE : C[5]) : b < 0.5 ? C[4] : b < 0.78 ? C[3] : C[2];
          out.a = k * (b < 0.45 ? 1.15 : 1.1 - b);
          out.l = C[4];
          out.k = 0.35 * k * (1 - b);
        });
      }
      // the flash: a white ball at the point of impact, then a column of light
      if (t < 0.1) {
        const f = 1 - t / 0.1;
        q.ball(0, -4, 0, 3 + 4 * f, t < 0.04 ? WHITE : C[5]);
        q.glow(0, -4, 0, 24, C[5], 0.7 * f);
      }
      if (t < 0.3) {
        const f = 1 - t / 0.3;
        q.beam(0, 0, 0, 0, -26 - 30 * (1 - f), 0, 5 * f, (u) => (u < 0.4 ? WHITE : C[5]), (u) => f * (1.2 - u));
      }
      bits.draw(q);
      ps.draw(q);
      lights.draw(q);
    },
  };
}
