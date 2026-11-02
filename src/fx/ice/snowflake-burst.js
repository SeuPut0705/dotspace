// The pop recipe (a gathering, a white flash with a ring and flares, twinkling motes that linger and fade) is
// adapted from Sprite Fusion's open-source sparkle (https://www.spritefusion.com/pixel-art-vfx/sparkle),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, flare, sparkle, clamp, smooth, seg, ease, space, TAU, WHITE } from "../../core/index.js";
import { flakeDesign, snowflake, endBy } from "./_lib.js";

export const meta = {
  name: "Snowflake burst",
  desc: "A cold pop: frost gathers and flashes white in a ring, then crisp six-armed snowflakes spin out, slow, twinkle and drift down to settle and melt.",
  tags: ["ice", "snow", "snowflake", "burst", "magic", "one-shot"],
  size: [140, 120],
  origin: [70, 106],
  duration: 3.2,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#dcfbff", "#ffffff"], count: 9, seed: 8 },
};

const POP = 0.16, CY = -48;

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]], haze: C[5] });
  const lights = new Lights();
  // the flakes: two big, a few middling, the rest small; small ones fly further
  const flakes = [];
  const SIZES = [2, 0, 1, 0, 2, 0, 1, 0, 1];
  for (let i = 0; i < o.count; i++) {
    const z = SIZES[i % SIZES.length], r = z === 2 ? R.range(9.5, 11.5) : z === 1 ? R.range(6, 7.5) : R.range(3, 4.5);
    const a = (i / o.count) * TAU + R.range(-0.3, 0.3) + 0.4, sp = R.range(80, 120) * (1.4 - r / 14);
    flakes.push({
      x: 0, y: CY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.85 - 20, r, rot: R.range(0, TAU), w0: R.sign() * R.range(7, 12), w1: R.sign() * R.range(0.4, 1),
      d: flakeDesign(R), life: R.range(2.1, 2.8), age: 0, ph: R.range(0, TAU), tw: R.range(0.5, 0.85), tw0: R.range(0.15, 0.6), rest: false, popped: false,
    });
  }
  let t = 0, popped = false;
  const sz = (f) => f.r * Math.min(1, ease.outBack(clamp(f.age / 0.18), 2)) * Math.min(1, (f.life - f.age) / 0.35);

  return {
    update(dt) {
      t += dt;
      // the cold gathers: streaks of frost spiral in, snow motes drift in
      if (t < POP - 0.03 && R.chance(0.8)) {
        const a = R.range(0, TAU), D = R.range(22, 44), T = R.range(0.12, 0.16), v = (D * 3) / (Math.exp(3 * T) - 1);
        ps.spawn(P.STREAK, Math.cos(a) * D, CY + Math.sin(a) * D, -Math.cos(a) * v, -Math.sin(a) * v, T, R.chance(0.5) ? C[6] : C[5]);
      }
      if (!popped && t >= POP) {
        popped = true;
        lights.add(0, CY, 44, WHITE, 0.8, 0.1);
        lights.add(0, CY, 72, C[4], 0.5, 0.6);
        // frost thrown out: streaking motes, snow, glints that come and go round it
        for (let i = 0; i < 22; i++) {
          const a = R.range(0, TAU), sp = R.range(80, 150);
          ps.spawn(P.MOTE, 0, CY, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.25, 0.5), R.chance(0.5) ? C[6] : C[5], R.range(0.6, 1));
        }
        for (let i = 0; i < 18; i++) {
          const a = R.range(-Math.PI, 0.2), sp = R.range(30, 110);
          ps.spawn(P.FLAKE, 0, CY, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1, 1.6), R.chance(0.6) ? WHITE : C[6], R.range(0.5, 1.5));
        }
        for (let i = 0; i < 12; i++) {
          const a = R.range(0, TAU), d = R.range(10, 44);
          ps.spawn(P.STAR, Math.cos(a) * d, CY + Math.sin(a) * d * 0.85, 0, R.range(2, 6), R.range(0.3, 0.6), R.chance(0.5) ? WHITE : C[6], R.range(0.8, 2.2), R.range(0.08, 1.6));
        }
      }
      if (popped)
        for (const f of flakes) {
          f.age += dt;
          if (f.age >= f.life) continue;
          if (!f.rest) {
            f.vx -= f.vx * 2.8 * dt;
            f.vy -= f.vy * 2.8 * dt - 26 * dt;
            f.x += f.vx * dt + Math.sin(t * 1.8 + f.ph) * 5 * dt;
            f.y += f.vy * dt;
            f.rot += (f.w1 + (f.w0 - f.w1) * Math.exp(-f.age * 2.5)) * dt;
            // it settles on the floor, flat and still, and melts there
            if (f.y > -sz(f) * 0.3) {
              f.rest = true;
              f.y = -1;
              f.life = Math.min(f.life, f.age + 0.6);
            }
          }
          // a melted or spent flake goes out with a glint or two
          if (!f.popped && f.life - f.age < 0.1) {
            f.popped = true;
            for (let i = 0; i < 2; i++) ps.spawn(P.STAR, f.x + R.range(-2, 2), f.y + R.range(-2, 2), R.range(-6, 6), -R.range(2, 8), R.range(0.2, 0.4), R.chance(0.5) ? WHITE : C[6], R.range(0.8, 1.6));
          }
        }
      ps.update(dt);
      lights.update(dt);
      endBy(t, meta.duration, ps);
    },
    draw(p) {
      // the gathering: a tiny flake spins up at the heart, faster and brighter
      if (t < POP) {
        const k = t / POP;
        snowflake(p, 0, CY, 1 + 3.2 * k * k, t * 20, flakes[0].d, C, { hot: k });
        p.glow(0, CY, 8 + 14 * k, C[5], 0.3 + 0.4 * k);
      }
      // the pop: a white flash, a flare and a ring of frost running out
      const q = t - POP;
      if (q >= 0 && q < 0.4) {
        if (q < 0.07) p.circle(0, CY, 6 * (1 - q / 0.07) + 1, WHITE);
        flare(p, 0, CY, 28 * Math.pow(Math.max(0, 1 - q / 0.26), 1.5), 1 - q / 0.26, C);
        const e = ease.outCubic(q / 0.4), r = 5 + 34 * e;
        p.ring(0, CY, r, Math.max(1, 2.4 * (1 - e)), q < 0.08 ? WHITE : q < 0.2 ? C[6] : C[5], 1.15 - e);
        p.glowRing(0, CY, r, 5, C[5], 0.4 * (1 - e));
      }
      // the cold light left where it burst, fading
      if (popped) p.glow(0, CY, 46, C[4], 0.3 * (1 - smooth(POP, POP + 1.6, t)));
      // the flakes: spinning out, twinkling now and then, landing and melting
      for (const f of flakes) {
        if (!popped || f.age >= f.life) continue;
        const r = sz(f), tw = Math.max(0, Math.sin(((f.age - f.tw0) / f.tw) * TAU)) ** 8 * (f.age > f.tw0 ? 1 : 0);
        if (f.rest) {
          // lying on the floor: flattened to a sparkling smear that shrinks away
          const L = Math.max(1, Math.round(r * 1.2 * ((f.life - f.age) / 0.6)));
          for (let i = -L; i <= L; i++) p.px(f.x + i, -1, Math.abs(i) === L ? C[5] : i === 0 ? WHITE : C[6]);
          p.glow(f.x, -1, 3 + L, C[4], 0.3);
          continue;
        }
        snowflake(p, f.x, f.y, r, f.rot, f.d, C, { hot: Math.max(tw, 1 - clamp(f.age / 0.12)) });
        p.glow(f.x, f.y, 6 + r * 1.4, C[4], 0.12);
        if (tw > 0.5) flare(p, f.x, f.y, (3 + r * 0.7) * tw, tw, C);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}

// a six-armed snowflake as a real plate in space, drawn as lines with a depth: n is the plate's normal, rot the
// turn in its own plane. The same design as snowflake(), crisp at any tilt (a decal would smear thin arms).
function flake3(q, x, y, z, n, r, rot, d, C, a, hot) {
  const m = C.length, L = Math.hypot(...n) || 1, N = [n[0] / L, n[1] / L, n[2] / L];
  const c1 = Math.abs(N[1]) > 0.9 ? [0, 0, 1] : [-N[2], 0, N[0]], l1 = Math.hypot(...c1), e1 = [c1[0] / l1, c1[1] / l1, c1[2] / l1];
  const e2 = [N[1] * e1[2] - N[2] * e1[1], N[2] * e1[0] - N[0] * e1[2], N[0] * e1[1] - N[1] * e1[0]];
  const at = (u, v) => [x + e1[0] * u + e2[0] * v, y + e1[1] * u + e2[1] * v, z + e1[2] * u + e2[2] * v];
  const arm = hot > 0.5 ? WHITE : C[m - 2], br = hot > 0.5 ? C[m - 2] : C[m - 3], face = Math.abs(q.view(N[0], N[1], N[2])[2]), big = r >= 7 && face > 0.5;
  const branches = r < 4 || face < 0.5 ? [] : big ? d.branches.slice(0, 2) : [[0.58, 0.36]];
  for (let k = 0; k < 6; k++) {
    const g = rot + (k * TAU) / 6, ca = Math.cos(g), sa = Math.sin(g), tip = at(ca * r, sa * r);
    q.line(x, y, z, tip[0], tip[1], tip[2], arm, a);
    for (const [u, l] of branches) {
      const b = at(ca * r * u, sa * r * u), bl = Math.max(1, r * l);
      for (const s of [-1, 1]) {
        const e = at(ca * r * u + Math.cos(g + (s * Math.PI) / 3) * bl, sa * r * u + Math.sin(g + (s * Math.PI) / 3) * bl);
        q.line(b[0], b[1], b[2], e[0], e[1], e[2], br, a);
      }
    }
    if (d.fork && big && !d.plate) for (const s of [-1, 1]) q.dot(...at(ca * r + Math.cos(g + s * 0.9) * 1.2, sa * r + Math.sin(g + s * 0.9) * 1.2), br, a);
    q.dot(tip[0], tip[1], tip[2], WHITE, a);
  }
  if (d.plate && big) {
    const w = r * 0.34;
    for (let k = 0; k < 6; k++) {
      const g0 = rot + Math.PI / 6 + (k * TAU) / 6, g1 = g0 + TAU / 6, p0 = at(Math.cos(g0) * w, Math.sin(g0) * w), p1 = at(Math.cos(g1) * w, Math.sin(g1) * w);
      q.line(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], C[m - 3], a);
    }
  }
  q.px(x, y, z, WHITE);
  q.glow(x, y, z, 3 + r * 1.2, C[m - 4], (0.14 + 0.35 * hot) * a);
  if (hot > 0.3) q.glow(x, y, z, 2 + r * 0.5, WHITE, 0.3 * hot * a);
}

// 3D: the pop is a ball: frost gathers from every direction, a white flash and a shell of frost (three great
// circles and a scatter of dots) run out in a sphere, motes, stars and snowflakes are thrown out in every direction.
// The six-armed snowflakes are flat plates that tumble and slowly level as they fall, then lie flat on the floor
// and melt there.
export const three = {
  meta: { size: [140, 140], origin: [70, 116], bg: "ground", camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 8), R = new Rng(o.seed), floor = () => 0;
    const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]], haze: C[5] });
    const lights = new Lights();
    // a random direction on a sphere (y is down, as in the world)
    const dir = () => {
      const c = R.range(-1, 1), a = R.range(0, TAU), s = Math.sqrt(1 - c * c);
      return [s * Math.cos(a), -c, s * Math.sin(a)];
    };
    // the flakes: two big, a few middling, the rest small; small ones fly further; spread over a sphere
    const flakes = [];
    const SIZES = [2, 0, 1, 0, 2, 0, 1, 0, 1];
    for (let i = 0; i < o.count; i++) {
      const z = SIZES[i % SIZES.length], r = z === 2 ? R.range(9.5, 11.5) : z === 1 ? R.range(6, 7.5) : R.range(3, 4.5);
      const up = 1 - (2 * (((i * 5) % o.count) + 0.5)) / o.count, a = i * 2.4 + R.range(-0.3, 0.3), s = Math.sqrt(1 - up * up), sp = R.range(80, 120) * (1.4 - r / 14);
      flakes.push({
        x: 0, y: CY, z: 0, vx: Math.cos(a) * s * sp, vy: -up * sp * 0.85 - 10, vz: Math.sin(a) * s * sp, r, rot: R.range(0, TAU), w0: R.sign() * R.range(7, 12), w1: R.sign() * R.range(0.4, 1),
        d: flakeDesign(R), life: R.range(2.1, 2.8), age: 0, ph: R.range(0, TAU), tw: R.range(0.5, 0.85), tw0: R.range(0.15, 0.6), rest: false, popped: false,
        tau: R.range(0.55, 1.05), al: R.range(0, TAU), wa: R.sign() * R.range(1.5, 3), tilt: 0, ang: 0,
      });
    }
    let t = 0, popped = false;
    const sz = (f) => f.r * Math.min(1, ease.outBack(clamp(f.age / 0.18), 2)) * Math.min(1, (f.life - f.age) / 0.35);
    // the plate's normal: tumbling at first, levelling as it falls, flat once it lies on the floor
    const normal = (f) => [Math.sin(f.tilt) * Math.cos(f.ang), -Math.cos(f.tilt), Math.sin(f.tilt) * Math.sin(f.ang)];
    // dots of the shell: an even scatter over a sphere
    const SHELL = Array.from({ length: 44 }, (_, i) => {
      const up = 1 - (2 * (i + 0.5)) / 44, s = Math.sqrt(1 - up * up), a = i * 2.39996;
      return [s * Math.cos(a), -up, s * Math.sin(a), 0.92 + ((i * 7) % 5) * 0.035];
    });
    const GREAT = [[0, -1, 0], [0.7, -0.15, 0.7], [0.7, -0.15, -0.7]];

    return {
      update(dt) {
        t += dt;
        // the cold gathers: streaks of frost spiral in from every side
        if (t < POP - 0.03 && R.chance(0.8)) {
          const [dx, dy, dz] = dir(), D = R.range(22, 44), T = R.range(0.12, 0.16), v = (D * 3) / (Math.exp(3 * T) - 1);
          ps.spawn3(P.STREAK, dx * D, CY + dy * D, dz * D, -dx * v, -dy * v, -dz * v, T, R.chance(0.5) ? C[6] : C[5]);
        }
        if (!popped && t >= POP) {
          popped = true;
          lights.add(0, CY, 44, WHITE, 0.8, 0.1, 0);
          lights.add(0, CY, 72, C[4], 0.5, 0.6, 0);
          // frost thrown out: streaking motes, snow, glints that come and go round it
          for (let i = 0; i < 22; i++) {
            const [dx, dy, dz] = dir(), sp = R.range(80, 150);
            ps.spawn3(P.MOTE, 0, CY, 0, dx * sp, dy * sp, dz * sp, R.range(0.25, 0.5), R.chance(0.5) ? C[6] : C[5], R.range(0.6, 1));
          }
          for (let i = 0; i < 18; i++) {
            const c = R.range(-0.2, 1), a = R.range(0, TAU), s = Math.sqrt(1 - c * c), sp = R.range(30, 110);
            ps.spawn3(P.FLAKE, 0, CY, 0, Math.cos(a) * s * sp, -c * sp, Math.sin(a) * s * sp, R.range(1, 1.6), R.chance(0.6) ? WHITE : C[6], R.range(0.5, 1.5));
          }
          for (let i = 0; i < 12; i++) {
            const [dx, dy, dz] = dir(), d = R.range(10, 44);
            ps.spawn3(P.STAR, dx * d, CY + dy * d * 0.85, dz * d, 0, R.range(2, 6), 0, R.range(0.3, 0.6), R.chance(0.5) ? WHITE : C[6], R.range(0.8, 2.2), R.range(0.08, 1.6));
          }
        }
        if (popped)
          for (const f of flakes) {
            f.age += dt;
            if (f.age >= f.life) continue;
            if (!f.rest) {
              f.vx -= f.vx * 2.8 * dt;
              f.vz -= f.vz * 2.8 * dt;
              f.vy -= f.vy * 2.8 * dt - 42 * dt;
              f.x += f.vx * dt + Math.sin(t * 1.8 + f.ph) * 5 * dt;
              f.z += f.vz * dt + Math.cos(t * 1.5 + f.ph) * 5 * dt;
              f.y += f.vy * dt;
              f.rot += (f.w1 + (f.w0 - f.w1) * Math.exp(-f.age * 2.5)) * dt;
              f.ang = f.al + f.wa * f.age;
              f.tilt = Math.abs((f.tau + 0.35 * Math.sin(f.age * 3.2 + f.ph)) * (1 - 0.6 * (1 - Math.exp(-f.age * 1.1))));
              // it settles on the floor, flat and still, and melts there
              if (f.y > -sz(f) * 0.3) {
                f.rest = true;
                f.y = -0.5;
                f.life = Math.min(f.life, f.age + 0.6);
              }
            } else f.tilt *= Math.exp(-14 * dt);
            // a melted or spent flake goes out with a glint or two
            if (!f.popped && f.life - f.age < 0.1) {
              f.popped = true;
              for (let i = 0; i < 2; i++) ps.spawn3(P.STAR, f.x + R.range(-2, 2), f.y + R.range(-2, 2), f.z + R.range(-2, 2), R.range(-6, 6), -R.range(2, 8), R.range(-6, 6), R.range(0.2, 0.4), R.chance(0.5) ? WHITE : C[6], R.range(0.8, 1.6));
            }
          }
        ps.update(dt);
        lights.update(dt);
        endBy(t, meta.duration, ps);
      },
      draw(p) {
        const q = space(p, o);
        // the gathering: a tiny flake spins up at the heart, faster and brighter
        if (t < POP) {
          const k = t / POP;
          q.at(0, CY, 0, (pp) => {
            snowflake(pp, 0, 0, 1 + 3.2 * k * k, t * 20, flakes[0].d, C, { hot: k });
            pp.glow(0, 0, 8 + 14 * k, C[5], 0.3 + 0.4 * k);
          });
        }
        // the pop: a white flash, a flare and a shell of frost running out in a sphere
        const g = t - POP;
        if (g >= 0 && g < 0.4) {
          const e = ease.outCubic(g / 0.4), r = 5 + 34 * e, col = g < 0.08 ? WHITE : g < 0.2 ? C[6] : C[5], w = Math.max(1, 2.4 * (1 - e));
          for (const n of GREAT) q.ring(0, CY, 0, r, w, col, 1.15 - e, n);
          for (const [dx, dy, dz, j] of SHELL) q.dot(dx * r * j, CY + dy * r * j, dz * r * j, g < 0.12 ? WHITE : C[6], 1.1 - e);
          q.glow(0, CY, 0, r * 0.9 + 4, C[5], 0.22 * (1 - e));
          q.at(0, CY, 0, (pp) => {
            if (g < 0.07) pp.circle(0, 0, 6 * (1 - g / 0.07) + 1, WHITE);
            flare(pp, 0, 0, 28 * Math.pow(Math.max(0, 1 - g / 0.26), 1.5), 1 - g / 0.26, C);
          });
        }
        // the flakes: tumbling plates, twinkling now and then, landing flat and melting
        const live = popped ? flakes.filter((f) => f.age < f.life) : [];
        for (const f of q.sort(live, (f) => [f.x, f.y, f.z])) {
          const r = sz(f), tw = Math.max(0, Math.sin(((f.age - f.tw0) / f.tw) * TAU)) ** 8 * (f.age > f.tw0 ? 1 : 0), hot = Math.max(tw, 1 - clamp(f.age / 0.12));
          if (f.rest) {
            // lying flat on the floor, shrinking away
            const m = clamp((f.life - f.age) / 0.6), rr = r * (0.55 + 0.45 * m);
            if (rr >= 2) flake3(q, f.x, 0, f.z, normal(f), rr, f.rot, f.d, C, Math.min(1, m * 1.5), hot);
            q.glow(f.x, -1, f.z, 3 + rr, C[4], 0.3 * m);
            continue;
          }
          if (r >= 5) flake3(q, f.x, f.y, f.z, normal(f), r, f.rot, f.d, C, 1, hot);
          else q.at(f.x, f.y, f.z, (pp) => snowflake(pp, 0, 0, r, f.rot, f.d, C, { hot }));
          q.glow(f.x, f.y, f.z, 6 + r * 1.4, C[4], 0.12);
          if (tw > 0.5) q.at(f.x, f.y, f.z, (pp) => ((pp.z -= r), flare(pp, 0, 0, (3 + r * 0.7) * tw, tw, C)));
        }
        ps.draw(q);
        lights.draw(q);
        // the cold light left where it burst, fading
        if (popped) q.glow(0, CY, 0, 46, C[4], 0.3 * (1 - smooth(POP, POP + 1.6, t)));
      },
    };
  },
};
