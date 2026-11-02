import { Particles, Lights, P, Rng, fit, space, sparkle, clamp, TAU, WHITE } from "../../core/index.js";
import { act as spin } from "../melee/spin-slash.js";

export const meta = {
  name: "Whirlwind",
  desc: "A blade whirls once round the waist in true 3D: the smear runs behind the body and back across the front, closes into a ring that flares and comes apart in sparks.",
  tags: ["3d", "melee", "slash", "spin", "sword", "aoe", "one-shot"],
  size: [180, 108],
  origin: [90, 80],
  duration: 0.8,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  camera: { pitch: 0.34 },
  options: {
    palette: ["#16224a", "#1f4a86", "#2a7fc0", "#48b8ec", "#9fe2ff", "#e2f7ff", "#ffffff"],
    sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"],
    radius: 46,
    height: 17,
    seed: 3,
  },
};

// the body's spin, wind-up to recovery, is the 2D spin slash's: it sweeps once round in SW seconds
export const act = spin;
const SW = 0.17, FLARE = 0.32, TRAIL = 4.2;
const turn = (t) => 1 - Math.pow(1 - clamp(t / SW), 1.6);
// the edge starts front right and goes up the right side, behind him, down the left and back across the front
const edgeAt = (t) => 0.5 - TAU * turn(t);

export function create(o) {
  const C = fit(o.palette, 7), R = new Rng(o.seed), RAD = o.radius, Y = -o.height;
  const ps = new Particles({ rng: R, ground: () => 0, sparks: o.sparks }), lights = new Lights();
  const on = (g, r = RAD) => [Math.cos(g) * r, Y, Math.sin(g) * r];
  let t = 0, burst = false;
  return {
    update(dt) {
      const e0 = edgeAt(t);
      t += dt;
      // sparks peel off the edge as it passes, flying on along the tangent
      if (t < SW) {
        const e = edgeAt(t), [x, y, z] = on(e);
        if (R.chance(Math.min(1, dt * 70))) {
          const tx = Math.sin(e), tz = -Math.cos(e), sp = R.range(120, 220);
          ps.spawn3(P.SPARK, x, y, z, tx * sp + Math.cos(e) * 40, -R.range(20, 90), tz * sp + Math.sin(e) * 40, R.range(0.2, 0.45));
        }
        lights.add(x, y, 26, C[4], 0.5 * (e0 - e), 0.12, z);
      }
      if (t >= SW && !burst) {
        burst = true;
        lights.add(0, Y, 70, C[5], 0.8, 0.35);
        for (let i = 0; i < 28; i++) {
          const g = R.range(0, TAU), [x, y, z] = on(g), sp = R.range(80, 200);
          ps.spawn3(P.SPARK, x, y, z, Math.sin(g) * sp + Math.cos(g) * 60, -R.range(30, 140), -Math.cos(g) * sp + Math.sin(g) * 60, R.range(0.25, 0.55));
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      const q = space(p, o), e = edgeAt(t), swept = clamp(turn(t)) * TAU;
      const flare = t < SW ? 0 : clamp((t - SW) / FLARE);
      if (flare < 1) {
        const W = 9, W0 = RAD - 11;
        q.plane(0, Y, 0, null, RAD + 1, (u, v, out) => {
          const d = Math.hypot(u, v);
          if (d < W0 - 2) return;
          // how far behind the edge this point is, as a fraction of the trail
          let g = Math.atan2(v, u) - e;
          g -= Math.floor(g / TAU) * TAU;
          if (g > swept + 1e-3) return;
          const lag = flare > 0 ? g / TAU : g / Math.min(TRAIL, swept || 1e-3);
          if (lag > 1) return;
          // a crescent: thickest just behind the edge, thinning to a 1 px trace at its tail
          const w = 1 + W * Math.pow(1 - lag, 1.4) * (1 - flare * 0.8), r0 = RAD - w;
          if (d < r0 || d > RAD) return;
          const across = (d - r0) / w, hot = 1 - lag * (1 - flare * 0.3) - flare * 0.9;
          out.c = hot > 0.85 || across > 0.82 ? WHITE : hot > 0.6 ? C[5] : hot > 0.35 ? C[4] : hot > 0.15 ? C[3] : C[2];
          out.a = clamp((1.2 - lag) * (1 - flare) * 1.4);
          out.l = C[4];
          out.k = 0.3 * hot * (1 - flare);
        });
      }
      // a glint rides the edge
      if (t < SW + 0.04) {
        const [x, y, z] = on(e, RAD - 1), f = 1 - clamp((t - SW) / 0.04);
        q.at(x, y, z, (pp) => sparkle(pp, 0, 0, 3 + 3 * f, C[5], C[4], 0.5 * f));
      }
      ps.draw(q);
      lights.draw(q);
    },
  };
}
