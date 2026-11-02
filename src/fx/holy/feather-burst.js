import { Particles, Lights, P, Rng, fit, sparkle, space, lit, clamp, smooth, seg, ease, TAU, WHITE, hex, mix } from "../../core/index.js";
import { Feathers, Feathers3, shell } from "./_lib.js";

export const meta = {
  name: "Feather burst",
  desc: "A white puff pops and throws feathers that brake hard, then rock from side to side as they sink and fade, with down drifting after them.",
  tags: ["holy", "feather", "burst", "poof", "angel", "bird", "one-shot"],
  size: [160, 160],
  origin: [80, 60],
  duration: 3,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#4a4560", "#7a7494", "#aaa5c2", "#d6d3e6", "#f4f3fa", "#ffffff"], glow: "#fff0c0", seed: 4 },
};

export function create(o) {
  const F = fit(o.palette, 6), G = hex(o.glow), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => Infinity, sparks: [WHITE, F[4], F[3], F[2]] });
  const lights = new Lights(), loose = new Feathers(R, 1e6);
  // the puff: soft lobes thrown out from the pop, swelling and thinning
  const lobes = Array.from({ length: 11 }, (_, i) => {
    const a = (i / 11) * TAU + R.range(-0.25, 0.25), d = R.range(5, 14);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.8, r0: R.range(2.5, 4), r1: R.range(6, 9.5), life: R.range(0.45, 0.8) };
  });
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU + R.range(-0.15, 0.15), sp = R.range(110, 230), up = Math.sin(a) < 0 ? 0.7 : 0.9;
    loose.add({ x: Math.cos(a) * 3, y: Math.sin(a) * 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * up - 20, a: a + R.range(-0.5, 0.5), len: R.range(10, 14), wid: R.range(2.6, 3.4), life: R.range(1.9, 2.6), delay: R.range(0, 0.03), sink: R.range(26, 38), amp: R.range(8, 13) });
  }
  // small feathers and down, slower
  for (let i = 0; i < 10; i++) {
    const a = R.range(0, TAU), sp = R.range(50, 130);
    loose.add({ x: 0, y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, a: R.range(0, TAU), len: R.range(6, 8), wid: R.range(1.8, 2.2), life: R.range(1.6, 2.4), back: true, sink: R.range(18, 28) });
  }
  for (let i = 0; i < 26; i++) {
    const a = R.range(0, TAU), sp = R.range(30, 140);
    ps.spawn(P.FLAKE, R.range(-3, 3), R.range(-3, 3), Math.cos(a) * sp, Math.sin(a) * sp - 15, R.range(1.4, 2.6), R.chance(0.6) ? WHITE : F[4], R.range(0.6, 1.6));
  }
  for (let i = 0; i < 10; i++) {
    const a = R.range(0, TAU), sp = R.range(60, 160);
    ps.spawn(P.STAR, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.3, 0.6), R.chance(0.5) ? WHITE : G, R.range(0.8, 2.2));
  }
  lights.add(0, 0, 50, G, 0.75, 0.45);
  lights.add(0, 0, 20, WHITE, 0.7, 0.1);
  let t = 0;

  function puff(p) {
    for (const l of lobes) {
      const u = t / l.life;
      if (u >= 1) continue;
      const e = ease.outCubic(u), x = l.x * (0.4 + e * 1.3), y = l.y * (0.4 + e * 1.3) - u * 5;
      const r = (l.r0 + (l.r1 - l.r0) * ease.outCubic(Math.min(1, u * 3))) * (1 - ease.inQuad(u));
      if (r < 0.6) continue;
      p.circle(x, y, r + 0.8, F[2]);
      p.circle(x, y, r, (d, a) => (d > 0.55 && Math.sin(a + 0.8) > 0.3 ? F[3] : d < 0.45 && Math.sin(a + 0.8) < -0.2 ? WHITE : F[4]));
    }
  }

  return {
    update(dt) {
      t += dt;
      // feathers catch the light as they turn
      if (t > 0.3 && t < 2.2 && loose.count && R.chance(0.14)) {
        const q = R.pick(loose.list);
        if (q.delay <= 0) ps.spawn(P.STAR, q.x + R.range(-2, 2), q.y + R.range(-1, 1), 0, 0, R.range(0.2, 0.4), R.chance(0.5) ? WHITE : G, R.range(1, 2.2));
      }
      ps.update(dt);
      loose.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      loose.draw(p, F, "back");
      ps.draw(p, "back");
      puff(p);
    },
    draw(p) {
      // the pop: a white flash and a ring of air
      if (t < 0.07) p.circle(0, 0, 9 * (1 - t / 0.14), WHITE);
      if (t < 0.25) {
        const u = t / 0.25;
        p.ring(0, 0, 6 + 24 * ease.outCubic(u), Math.max(1, 2.5 * (1 - u)), (v) => (v > 0.5 ? WHITE : mix(F[4], G, 0.4)), 1.1 - u);
      }
      if (t < 0.2) sparkle(p, 0, 0, 10 * (1 - t / 0.2), WHITE, G, 0.6);
      // the burst's warmth lingers a moment
      p.glow(0, 4, 46, G, 0.28 * (1 - smooth(0, 1.3, t)));
      loose.draw(p, F, "front");
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

// 3D: the pop throws feathers every way round, each a flat leaf in its own plane that banks and tips as it
// rocks down (turn the camera and you see its face, then its edge); the puff is a cluster of lit balls of cloud
// and the ring of air is a shell of light that swells round the pop
export const three = {
  meta: { size: [176, 176], origin: [88, 80], camera: { pitch: 0.25 } },
  create(o) {
    const F = fit(o.palette, 6), G = hex(o.glow), R = new Rng(o.seed);
    const ps = new Particles({ rng: R, ground: () => Infinity, sparks: [WHITE, F[4], F[3], F[2]] });
    const lights = new Lights(), loose = new Feathers3(R, 1e6), cloud = lit([F[0], F[1], F[2], F[3], F[4]]);
    // a direction on the sphere, i of n spread evenly (a spiral), s: how far to jitter it
    const dir = (i, n, s = 0.15) => {
      const y = clamp(1 - (2 * (i + 0.5)) / n + R.range(-s, s), -1, 1), a = i * 2.39996 + R.range(-s, s), c = Math.sqrt(1 - y * y);
      return [c * Math.cos(a), -y, c * Math.sin(a)];
    };
    const rnd = () => dir(R.int(0, 999), 1000, 0);
    // the puff: soft lobes thrown out from the pop, swelling and thinning
    const lobes = Array.from({ length: 11 }, (_, i) => {
      const d = dir(i, 11, 0.2), r = R.range(5, 14);
      return { x: d[0] * r, y: d[1] * r * 0.8, z: d[2] * r, r0: R.range(2.5, 4), r1: R.range(6, 9.5), life: R.range(0.45, 0.8) };
    });
    for (let i = 0; i < 20; i++) {
      const d = dir(i, 20), sp = R.range(110, 230), up = d[1] < 0 ? 0.7 : 0.9;
      loose.add({ x: d[0] * 3, y: d[1] * 3, z: d[2] * 3, vx: d[0] * sp, vy: d[1] * sp * up - 20, vz: d[2] * sp, dir: d, len: R.range(10, 14), wid: R.range(2.6, 3.4), life: R.range(1.9, 2.6), delay: R.range(0, 0.03), sink: R.range(26, 38), amp: R.range(8, 13) });
    }
    // small feathers and down, slower
    for (let i = 0; i < 10; i++) {
      const d = rnd(), sp = R.range(50, 130);
      loose.add({ x: 0, y: 0, z: 0, vx: d[0] * sp, vy: d[1] * sp - 20, vz: d[2] * sp, dir: rnd(), len: R.range(6, 8), wid: R.range(1.8, 2.2), life: R.range(1.6, 2.4), sink: R.range(18, 28) });
    }
    for (let i = 0; i < 26; i++) {
      const d = rnd(), sp = R.range(30, 140);
      ps.spawn3(P.FLAKE, R.range(-3, 3), R.range(-3, 3), R.range(-3, 3), d[0] * sp, d[1] * sp - 15, d[2] * sp, R.range(1.4, 2.6), R.chance(0.6) ? WHITE : F[4], R.range(0.6, 1.6));
    }
    for (let i = 0; i < 10; i++) {
      const d = rnd(), sp = R.range(60, 160);
      ps.spawn3(P.STAR, 0, 0, 0, d[0] * sp, d[1] * sp, d[2] * sp, R.range(0.3, 0.6), R.chance(0.5) ? WHITE : G, R.range(0.8, 2.2));
    }
    lights.add(0, 0, 50, G, 0.75, 0.45);
    lights.add(0, 0, 20, WHITE, 0.7, 0.1);
    let t = 0;
    return {
      update(dt) {
        t += dt;
        // feathers catch the light as they turn
        if (t > 0.3 && t < 2.2 && loose.count && R.chance(0.14)) {
          const f = R.pick(loose.list);
          if (f.delay <= 0) ps.spawn3(P.STAR, f.x + R.range(-2, 2), f.y + R.range(-1, 1), f.z + R.range(-2, 2), 0, 0, 0, R.range(0.2, 0.4), R.chance(0.5) ? WHITE : G, R.range(1, 2.2));
        }
        ps.update(dt);
        loose.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o);
        // the puff: lit balls of cloud, outlined, swelling out and thinning away
        for (const l of lobes) {
          const u = t / l.life;
          if (u >= 1) continue;
          const e = ease.outCubic(u), k = 0.4 + e * 1.3, r = (l.r0 + (l.r1 - l.r0) * ease.outCubic(Math.min(1, u * 3))) * (1 - ease.inQuad(u));
          if (r >= 0.6) q.ball(l.x * k, l.y * k - u * 5, l.z * k, r, cloud);
        }
        // the pop: a white flash and a shell of air
        if (t < 0.07) q.ball(0, 0, 0, 9 * (1 - t / 0.14), WHITE);
        if (t < 0.25) {
          const u = t / 0.25, r = 6 + 24 * ease.outCubic(u), th = Math.max(1, 2.5 * (1 - u)), rim = mix(F[4], G, 0.4);
          shell(q, 0, 0, 0, r, (nx, ny, nz, out) => {
            const d = Math.sqrt(1 - nz * nz);
            if (d < 1 - th / r) return;
            out.c = d > 1 - (th * 0.5) / r ? WHITE : rim;
            out.a = 1.1 - u;
          });
        }
        if (t < 0.2) q.at(0, 0, 0, (pp) => sparkle(pp, 0, 0, 10 * (1 - t / 0.2), WHITE, G, 0.6));
        loose.draw(q, F);
        ps.draw(q);
        // the burst's warmth lingers a moment
        q.glow(0, 4, 0, 46, G, 0.28 * (1 - smooth(0, 1.3, t)));
        lights.draw(q);
      },
    };
  },
};
