// The two-tone spark spray and the light pop are adapted from Sprite Fusion's open-source impact
// (https://www.spritefusion.com/pixel-art-vfx/impact), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, space, WHITE } from "../../core/index.js";
import { dir2, aimed } from "./_lib.js";

export const meta = {
  name: "Hit spark",
  desc: "The everyday hit: a sharp, lopsided cross flare with one long ray along the blow round a white diamond core, then a cone of sparks and hot chips that fall and bounce.",
  tags: ["impact", "hit", "spark", "combat", "directional", "one-shot"],
  size: [136, 80],
  origin: [44, 64],
  duration: 0.5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffe26b", "#fff3a6", "#ffffff"], height: 20, aim: 0.1, seed: 4 },
};

// one ray of the cross: fat at the root, a hair at the tip, white cooling outward; from..to draws a stretch of it
function ray(p, x, y, a, L, w, C, from = 0) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let d = from * L; d <= L; d += 0.5) {
    const u = d / L, hw = w * Math.pow(1 - u, 1.6);
    const col = u < 0.3 ? WHITE : u < 0.62 ? C[5] : u < 0.88 ? C[4] : C[3];
    p.px(x + c * d, y + s * d, col);
    if (hw > 0.45) for (let o = 0.5; o <= hw; o += 0.5) for (const e of [-o, o]) p.px(x + c * d - s * e, y + s * d + c * e, u < 0.3 && o < 1 ? C[5] : C[4]);
  }
}

// the core: a crisp white diamond with a pale rim
function diamond(p, x, y, r, C) {
  for (let dy = -r - 1; dy <= r + 1; dy++)
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const m = Math.abs(dx) + Math.abs(dy);
      if (m <= r) p.px(x + dx, y + dy, WHITE);
      else if (m === r + 1) p.px(x + dx, y + dy, C[3]);
    }
}

export function create(o) {
  const C = fit(o.palette, 7), R = new Rng(o.seed), X = 0, Y = -o.height, A = o.aim, floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[6], C[5], C[4], C[2]] });
  const lights = new Lights();
  // the cross: a long thin ray along the blow, a stub behind, two unequal arms across, and a glint between
  const tilt = R.range(-0.08, 0.08);
  const rays = [
    { a: A + tilt, L: R.range(33, 37), w: 2.2 },
    { a: A + Math.PI + tilt, L: R.range(8, 10), w: 2.2 },
    { a: A - Math.PI / 2 + tilt, L: R.range(15, 18), w: 2.6 },
    { a: A + Math.PI / 2 + tilt, L: R.range(10, 12), w: 2.3 },
    { a: A - Math.PI / 4 + tilt, L: R.range(5, 7), w: 1 },
  ];

  lights.add(X, Y, 38, C[4], 0.35, 0.18);
  lights.add(X + Math.cos(A) * 10, Y + Math.sin(A) * 10, 22, C[5], 0.45, 0.1);
  lights.add(X, -2, 26, C[3], 0.22, 0.22);
  // a cone of sparks sprayed on along the blow: they fall, bounce off the floor and die
  for (let i = 0; i < 9; i++) {
    const a = A + R.range(-0.6, 0.6) - 0.15, v = R.range(170, 360);
    ps.spawn(P.SPARK, X + 1, Y, Math.cos(a) * v, Math.sin(a) * v - 40, R.range(0.25, 0.45), WHITE, 1, i > 6 ? R.range(0.01, 0.03) : 0);
  }
  // hot pixel chips knocked off, tumbling down to tick off the floor
  for (let i = 0; i < 6; i++) {
    const a = A + R.range(-1.1, 0.5) - 0.3, v = R.range(70, 170);
    ps.spawn(P.GRIT, X + 1, Y, Math.cos(a) * v, Math.sin(a) * v - R.range(30, 80), R.range(0.35, 0.45), R.pick([C[5], C[4], C[4], C[3]]), 1);
  }

  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      ps.draw(p);
      if (t < 0.025) {
        // the flash: the whole cross round the diamond
        for (const r of rays) ray(p, X, Y, r.a, r.L, r.w, C);
        diamond(p, X, Y, 4, C);
      } else if (t < 0.058) {
        // reaching further and thinning, the diamond still crisp
        for (const r of rays) ray(p, X, Y, r.a, r.L * 1.2, r.w * 0.55, C, 0.12);
        diamond(p, X, Y, 3, C);
      } else if (t < 0.092) {
        // only the long ray lingers, its root burning away
        const r = rays[0];
        ray(p, X, Y, r.a, r.L * 1.3, 0.6, [C[0], C[1], C[2], C[3], C[3], C[4]], 0.4);
      }
      const pop = Math.exp(-t / 0.045);
      if (pop > 0.02) {
        p.glow(X, Y, 22, C[4], 0.3 * pop);
        p.glow(X, Y, 7, WHITE, 0.15 * pop);
        p.glowLine(X, Y, X + Math.cos(A) * 26, Y + Math.sin(A) * 26, 4, C[5], 0.25 * pop);
      }
      lights.draw(p);
    },
  };
}

// 3D: the same cross, standing in space. The long ray runs along the blow (+x), the arms cross it up, down and
// towards and away from the viewer, the core is a ball, and the cone of sparks and chips opens round the blow.
function ray3(q, x, y, z, d, L, w, C, from = 0) {
  const n = Math.max(1, Math.ceil(((1 - from) * L) / 1.6));
  for (let i = 0; i < n; i++) {
    const u0 = from + ((1 - from) * i) / n, u1 = from + ((1 - from) * (i + 1)) / n, um = (u0 + u1) / 2, hw = w * Math.pow(1 - um, 1.6);
    const mid = um < 0.3 ? WHITE : um < 0.62 ? C[5] : um < 0.88 ? C[4] : C[3], side = um < 0.3 ? C[5] : C[4];
    q.beam(x + d[0] * u0 * L, y + d[1] * u0 * L, z + d[2] * u0 * L, x + d[0] * u1 * L, y + d[1] * u1 * L, z + d[2] * u1 * L, Math.max(1, hw * 2 + 0.4), (u, v) => (v < 0.4 ? mid : side));
  }
}

export const three = {
  meta: { size: [176, 104], origin: [88, 76], bg: "ground", camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 7), R = new Rng(o.seed), Y = -o.height, A = o.aim, floor = () => 0;
    const ps = new Particles({ rng: R, ground: floor, sparks: [C[6], C[5], C[4], C[2]] });
    const lights = new Lights();
    const tilt = R.range(-0.08, 0.08), up = (a) => dir2(A + a + tilt);
    const rays = [
      { d: up(0), L: R.range(33, 37), w: 2.2 },
      { d: up(Math.PI), L: R.range(8, 10), w: 2.2 },
      { d: up(-Math.PI / 2), L: R.range(15, 18), w: 2.6 },
      { d: up(Math.PI / 2), L: R.range(10, 12), w: 2.3 },
      { d: [0, 0, 1], L: R.range(13, 16), w: 2.4 },
      { d: [0, 0, -1], L: R.range(9, 11), w: 2.2 },
      { d: up(-Math.PI / 4), L: R.range(5, 7), w: 1 },
    ];
    lights.add(0, Y, 38, C[4], 0.35, 0.18);
    lights.add(Math.cos(A) * 10, Y + Math.sin(A) * 10, 22, C[5], 0.45, 0.1);
    lights.add(0, -2, 26, C[3], 0.22, 0.22);
    // a cone of sparks along the blow: they fall, bounce off the floor and die
    for (let i = 0; i < 12; i++) {
      const d = aimed(R, A - 0.15, 0.6), v = R.range(170, 360);
      ps.spawn3(P.SPARK, 1, Y, 0, d[0] * v, d[1] * v - 40, d[2] * v, R.range(0.25, 0.45), WHITE, 1, i > 8 ? R.range(0.01, 0.03) : 0);
    }
    // hot chips knocked off, tumbling down to tick off the floor
    for (let i = 0; i < 8; i++) {
      const d = aimed(R, A - 0.3, 0.95), v = R.range(70, 170);
      ps.spawn3(P.GRIT, 1, Y, 0, d[0] * v, d[1] * v - R.range(30, 80), d[2] * v, R.range(0.35, 0.45), R.pick([C[5], C[4], C[4], C[3]]), 1);
    }
    let t = 0;
    return {
      update(dt) {
        t += dt;
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o);
        if (t < 0.025) {
          for (const r of rays) ray3(q, 0, Y, 0, r.d, r.L, r.w, C);
          q.ball(0, Y, 0, 4, (nx, ny) => (Math.hypot(nx, ny) > 0.78 ? C[3] : WHITE));
        } else if (t < 0.058) {
          for (const r of rays) ray3(q, 0, Y, 0, r.d, r.L * 1.2, r.w * 0.55, C, 0.12);
          q.ball(0, Y, 0, 3, (nx, ny) => (Math.hypot(nx, ny) > 0.72 ? C[3] : WHITE));
        } else if (t < 0.092) {
          const r = rays[0];
          ray3(q, 0, Y, 0, r.d, r.L * 1.3, 0.6, [C[0], C[1], C[2], C[3], C[3], C[4]], 0.4);
        }
        ps.draw(q);
        const pop = Math.exp(-t / 0.045);
        if (pop > 0.02) {
          q.glow(0, Y, 0, 22, C[4], 0.3 * pop);
          q.glow(0, Y, 0, 7, WHITE, 0.15 * pop);
          q.glowLine(0, Y, 0, Math.cos(A) * 26, Y + Math.sin(A) * 26, 0, 4, C[5], 0.25 * pop);
        }
        lights.draw(q);
      },
    };
  },
};
