import { Particles, Bits, Lights, Blazes, P, PF, B, Rng, fit, space, lit, clamp, seg, TAU, WHITE, PAL } from "../../core/index.js";

export const meta = {
  name: "Meteor",
  desc: "Seen in perspective: a burning rock falls out of the distance trailing fire, bursts on the floor, flings blazing chunks that light small fires where they land.",
  tags: ["3d", "fire", "meteor", "impact", "explosion", "perspective", "one-shot"],
  size: [208, 176],
  origin: [104, 132],
  duration: 3.8,
  loop: false,
  fps: 30,
  bg: "ground",
  camera: { pitch: 0.38, dist: 260 },
  options: { palette: PAL.fire, rock: PAL.stone, seed: 2 },
};

const FALL = 0.55; // seconds from the sky to the floor
const FROM = [-16, -70, -30], TO = [0, -3, 6];
const at = (t) => {
  const u = Math.pow(clamp(t / FALL), 1.35);
  return FROM.map((a, i) => a + (TO[i] - a) * u);
};

export function create(o) {
  const C = fit(o.palette, 8), S = fit(o.rock, 6), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[3]] }), lights = new Lights(), blazes = new Blazes(ps);
  ps.onLand = (x, y, z) => blazes.add(x, y, R.range(0.6, 1.0), R.range(0.5, 0.9), z);
  const bits = new Bits({ ground: floor });
  const rock = lit(S.slice(1)), hot = lit(C.slice(2));
  let t = 0, hit = false;
  return {
    update(dt) {
      t += dt;
      if (t < FALL) {
        const [x, y, z] = at(t), [x0, y0, z0] = at(t - 0.02), vx = (x - x0) / 0.02, vy = (y - y0) / 0.02, vz = (z - z0) / 0.02;
        for (let i = 0; i < 2; i++)
          ps.spawn3(P.FIRE, x + R.range(-2, 2), y + R.range(-2, 2), z + R.range(-2, 2), -vx * 0.08 + R.range(-10, 10), -vy * 0.08 - R.range(0, 20), -vz * 0.08 + R.range(-10, 10), R.range(0.3, 0.6), 0, R.range(2.4, 4), 0, R.chance(0.6) ? PF.SMOKES : 0);
        if (R.chance(0.4)) ps.spawn3(P.EMBER, x, y, z, R.range(-30, 30), R.range(-30, 10), R.range(-30, 30), R.range(0.4, 0.9), C[6]);
      } else if (!hit) {
        hit = true;
        const [x, , z] = TO;
        lights.add(x, -8, 80, C[6], 1, 0.7, z);
        lights.add(x, -4, 40, WHITE, 0.9, 0.15, z);
        for (let i = 0; i < 14; i++) {
          const a = R.range(0, TAU), sp = R.range(45, 105);
          ps.spawn3(P.BRAND, x, -4, z, Math.cos(a) * sp, -R.range(150, 320), Math.sin(a) * sp, 3, 0, 1);
        }
        for (let i = 0; i < 40; i++) {
          const a = R.range(0, TAU), sp = R.range(100, 210);
          ps.spawn3(P.SPARK, x, -3, z, Math.cos(a) * sp, -R.range(60, 340), Math.sin(a) * sp, R.range(0.3, 0.8));
        }
        for (let i = 0; i < 26; i++) {
          const a = R.range(0, TAU), sp = R.range(10, 50);
          ps.spawn3(P.FIRE, x, -R.range(2, 14), z, Math.cos(a) * sp, -R.range(20, 70), Math.sin(a) * sp, R.range(0.35, 0.8), 0, R.range(4, 8), R.range(0, 0.1), PF.SMOKES | PF.BIG);
        }
        for (let i = 0; i < 12; i++) {
          const a = R.range(0, TAU), sp = R.range(50, 120);
          bits.add({ kind: B.CHUNK, x, y: -2, z, vx: Math.cos(a) * sp, vy: -R.range(120, 260), vz: Math.sin(a) * sp, a: R.range(0, TAU), va: R.range(-12, 12), s: R.range(1.5, 2.8), ramp: S.slice(1), bounce: 0.3, drag: 0.4, life: R.range(1.4, 2.2) });
        }
      }
      ps.update(dt);
      bits.update(dt);
      blazes.update(dt);
      lights.update(dt);
    },
    draw(p) {
      const q = space(p, o), [hx, , hz] = TO;
      // the scorch: a dark glowing crater mark that cools
      if (t > FALL) {
        const k = seg(t, FALL, meta.duration - 0.1), r = 18 + 8 * seg(t, FALL, FALL + 0.2);
        q.plane(hx, 0, hz, null, r, (u, v, out) => {
          const d = Math.hypot(u, v) / r;
          out.c = d < 0.35 * (1 - k) ? C[6] : d < 0.55 ? (k < 0.4 ? C[4] : C[1]) : C[0];
          out.a = (1 - k) * (d < 0.7 ? 1.1 : 2.2 - d * 2);
          out.l = C[5];
          out.k = 0.4 * (1 - d) * (1 - seg(t, FALL, FALL + 1.2));
        });
        // the blast front: a ring of fire running out over the floor
        const f = seg(t, FALL, FALL + 0.35);
        if (f < 1) q.ring(hx, 0, hz, 6 + 46 * Math.sqrt(f), 4 * (1 - f) + 1, (v) => (v > 0.6 ? WHITE : v > 0.3 ? C[6] : C[5]), 1.1 - f);
      }
      bits.draw(q);
      blazes.drawBack(q);
      if (t < FALL) {
        const [x, y, z] = at(t);
        q.ball(x, y, z, 5, rock);
        q.ball(x - 1, y + 1.5, z + 1, 4, hot);
        q.glow(x, y, z, 30, C[5], 0.6);
      } else if (t < FALL + 0.08) {
        q.ball(hx, -6, hz, 10 * (1 - (t - FALL) / 0.08) + 3, WHITE);
      }
      ps.draw(q);
      lights.draw(q);
    },
  };
}
