// The tangent spark streaks are adapted from Sprite Fusion's open-source energy and impact effects
// (https://www.spritefusion.com/pixel-art-vfx/energy), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, rng, space, TAU, WHITE } from "../../core/index.js";
import { beat, wake, spark, wake3, spark3, shadow3 } from "./_lib.js";

export const meta = {
  name: "Energy disc",
  desc: "A sawblade of crackling energy spinning flat out as it flies: hooked teeth bright on their leading edges, a white hub, spiral arms churning, sparks flung off the teeth.",
  tags: ["projectile", "disc", "saw", "energy", "sci-fi", "directional", "loop"],
  size: [120, 52],
  origin: [92, 26],
  duration: 0.5,
  loop: true,
  fps: 30,
  bg: "sky",
  options: { palette: ["#0a0f2e", "#172a78", "#2550d0", "#3f8cff", "#7cc8ff", "#c8f0ff", "#ffffff"], size: 9, teeth: 8, speed: 220, seed: 5 },
};

export function draw(p, t, o) {
  const C = fit(o.palette, 7), R = o.size, N = o.teeth, V = o.speed, S = o.seed, D = meta.duration, left = -meta.origin[0] + 2;
  const rot = (TAU * 3 * t) / D, seg = TAU / N, frac = (x) => x - Math.floor(x);

  // speed lines peeling off the rim, top and bottom, stretching back and cooling
  beat(t, D, 8, S + 4, (r) => r.range(0.12, 0.22), (age, life, r) => {
    const k = age / life, side = r.chance(0.5) ? -1 : 1, x0 = -2 - age * r.range(180, 260), len = r.range(8, 16) * (0.5 + k), y = side * (R + r.range(0.5, 3));
    if (x0 - len < left) return;
    p.line(x0, y, x0 - len, y, k < 0.35 ? C[5] : k < 0.7 ? C[4] : C[3], (u) => (u < 0.65 ? 1 : (1 - u) / 0.35));
  });
  p.glowLine(-2, 0, -26, 0, 8, C[3], 0.35);

  // sparks flung off the tooth tips along the spin, then left behind in the air
  const SP = [WHITE, C[5], C[4], C[3]];
  beat(t, D, 20, S, (r) => r.range(0.12, 0.3), (age, life, r) => {
    const a = rot - r.range(0, TAU) * 0 + r.range(0, TAU), tip = R + 3.5, x0 = Math.cos(a) * tip, y0 = Math.sin(a) * tip, v = r.range(120, 230);
    const [x, y, vx, vy] = wake(x0, y0, -Math.sin(a) * v, Math.cos(a) * v, age, V * 0.6, 2.4, 60);
    if (x > left + 8 && Math.abs(y) < 23) spark(p, x, y, vx, vy, 1 - age / life, SP, 0.45, 0.014, 7);
  });

  // the disc: a white hub in a dark collar, spiral arms of energy churning, a bright rim; past the rim, hooked
  // teeth that run white on their leading faces, and a dim blur ring where the teeth have just been
  p.shade(-R - 5, -R - 5, R + 5, R + 5, (x, y) => {
    const r = Math.hypot(x, y), th = Math.atan2(y, x);
    if (r > R + 4.6) return;
    if (r <= R) {
      if (r < 1.8) return WHITE;
      if (r < 2.9) return C[1];
      if (r > R - 1.1) return C[5];
      const arm = Math.sin(3 * (th - rot * 0.5) - r * 0.85);
      return arm > 0.65 ? C[5] : arm > 0.2 ? C[4] : arm > -0.3 ? C[3] : C[2];
    }
    const ph = frac((th - rot) / seg), h = 4.2 * Math.pow(ph, 1.4);
    if (r - R < h) return ph > 0.86 ? WHITE : ph > 0.6 ? C[6] : ph > 0.35 ? C[5] : C[4];
    if (r - R < 1.6) return C[2];
  });
  // filaments of energy crackling from the hub to the rim, new every frame
  const fr = Math.floor(t * 30 + 1e-6);
  for (let j = 0; j < 3; j++) {
    const g = rng(fr, j, S), a0 = g.range(0, TAU), pts = [];
    for (let i = 0; i <= 4; i++) {
      const rr = 2.5 + ((R - 3) * i) / 4, a = a0 + i * 0.25 + (i ? g.range(-0.35, 0.35) : 0);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    p.polyline(pts, j ? C[6] : WHITE);
  }
  p.ring(0, 0, R + 0.5, 1, C[6]);
  // light: a soft pool, a hot hub, a glint riding the top of the rim
  p.glow(0, 0, 30, C[3], 0.4);
  p.glow(0, 0, 6, C[5], 0.35);
  p.glow(Math.cos(rot) * R, Math.sin(rot) * R, 5, C[6], 0.4);
}

// 3D: the sawblade is a real disc, banked and leaning into its flight, spinning in its own plane as it travels +x. The
// 2D blade is laid on that plane, its rim is a true circle with a thickness, its hub stands out on both faces, and
// everything it sheds (speed lines, sparks flung off the tooth tips along the spin) leaves in 3D.
const NORM = (() => {
  const l = Math.hypot(0.32, -0.5, 0.8);
  return [0.32 / l, -0.5 / l, 0.8 / l];
})();
const FLYH = -26;
export const three = {
  meta: { size: [84, 80], origin: [42, 61], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const C = fit(o.palette, 7), R = o.size, N = o.teeth, V = o.speed, S = o.seed, D = meta.duration, q = space(p, o);
    const rot = (TAU * 3 * t) / D, seg = TAU / N, frac = (x) => x - Math.floor(x), left = -50, SH = 20, X = (x) => x + SH;
    // the disc's own axes: e1 along its u, e2 along its v, as the Space lays a 2D drawing on a plane
    const [nx, ny, nz] = NORM, c1 = [nz * 1, 0, -nx], l1 = Math.hypot(c1[0], c1[2]), e1 = [c1[0] / l1, 0, c1[2] / l1];
    const e2 = [ny * e1[2] - nz * e1[1], nz * e1[0] - nx * e1[2], nx * e1[1] - ny * e1[0]];
    const at = (a, r) => [X(0) + (Math.cos(a) * e1[0] + Math.sin(a) * e2[0]) * r, FLYH + (Math.cos(a) * e1[1] + Math.sin(a) * e2[1]) * r, (Math.cos(a) * e1[2] + Math.sin(a) * e2[2]) * r];
    shadow3(q, X(-12), 0, 30, R * 1.1, 0.5);

    // the blade, drawn flat and laid down on its plane
    q.decal(X(0), FLYH, 0, NORM, R + 7, (pp) => {
      pp.shade(-R - 5, -R - 5, R + 5, R + 5, (x, y) => {
        const r = Math.hypot(x, y), th = Math.atan2(y, x);
        if (r > R + 4.6) return;
        if (r <= R) {
          if (r < 1.8) return WHITE;
          if (r < 2.9) return C[1];
          if (r > R - 1.1) return C[5];
          const arm = Math.sin(3 * (th - rot * 0.5) - r * 0.85);
          return arm > 0.65 ? C[5] : arm > 0.2 ? C[4] : arm > -0.3 ? C[3] : C[2];
        }
        const ph = frac((th - rot) / seg), h = 4.2 * Math.pow(ph, 1.4);
        if (r - R < h) return ph > 0.86 ? WHITE : ph > 0.6 ? C[6] : ph > 0.35 ? C[5] : C[4];
        if (r - R < 1.6) return C[2];
      });
      // filaments of energy crackling from the hub to the rim, new every frame
      const fr = Math.floor(t * 30 + 1e-6);
      for (let j = 0; j < 3; j++) {
        const g = rng(fr, j, S), a0 = g.range(0, TAU), pts = [];
        for (let i = 0; i <= 4; i++) {
          const rr = 2.5 + ((R - 3) * i) / 4, a = a0 + i * 0.25 + (i ? g.range(-0.35, 0.35) : 0);
          pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
        }
        pp.polyline(pts, j ? C[6] : WHITE);
      }
      pp.ring(0, 0, R + 0.5, 1, C[6]);
    });
    // a rim with some thickness, and a hub standing proud of both faces
    for (const s of [-1, 1]) q.ring(X(0) + nx * s * 1.1, FLYH + ny * s * 1.1, nz * s * 1.1, R + 0.4, 1.2, C[s > 0 ? 5 : 3], 1, NORM);
    for (const s of [-1, 1]) q.ball(X(0) + nx * s * 1.6, FLYH + ny * s * 1.6, nz * s * 1.6, 2, (a, b, c) => (c > 0.45 ? WHITE : C[5]));

    // speed lines peeling off the rim all round it, stretching back and cooling
    beat(t, D, 8, S + 4, (r) => r.range(0.12, 0.22), (age, life, r) => {
      const k = age / life, [, y, z] = at(r.range(0, TAU), R + r.range(0.5, 3)), x0 = -2 - age * r.range(180, 260), len = r.range(8, 16) * (0.5 + k);
      if (x0 - len < left) return;
      q.line(X(x0), y, z, X(x0 - len), y, z, k < 0.35 ? C[5] : k < 0.7 ? C[4] : C[3], (u) => (u < 0.65 ? 1 : (1 - u) / 0.35));
    });
    // sparks flung off the tooth tips along the spin, then left behind in the air
    const SP = [WHITE, C[5], C[4], C[3]];
    beat(t, D, 20, S, (r) => r.range(0.12, 0.3), (age, life, r) => {
      const a = rot + r.range(0, TAU), tip = R + 3.5, v = r.range(120, 230), [, y0, z0] = at(a, tip);
      const tx = -Math.sin(a) * e1[0] + Math.cos(a) * e2[0], ty = -Math.sin(a) * e1[1] + Math.cos(a) * e2[1], tz = -Math.sin(a) * e1[2] + Math.cos(a) * e2[2];
      const x0 = Math.cos(a) * e1[0] * tip + Math.sin(a) * e2[0] * tip, [x, y, z, vx, vy, vz] = wake3(x0, y0, z0, tx * v, ty * v, tz * v, age, V * 0.6, 2.4, 60);
      if (x > left + 8 && y > -60) spark3(q, X(x), y, z, vx, vy, vz, 1 - age / life, SP, 0.45, 0.014, 7);
    });
    q.glowLine(X(-2), FLYH, 0, X(-26), FLYH, 0, 8, C[3], 0.35);
    q.glow(X(0), FLYH, 0, 30, C[3], 0.4);
    q.glow(X(0), FLYH, 0, 6, C[5], 0.35);
    const [gx, gy, gz] = at(rot, R);
    q.glow(gx, gy, gz, 5, C[6], 0.4);
  },
};
