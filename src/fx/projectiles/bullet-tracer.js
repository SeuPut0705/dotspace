// The spark and streak recipes are adapted from Sprite Fusion's open-source impact ricochet
// (https://www.spritefusion.com/pixel-art-vfx/impact), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, rand, noise, smooth, space, TAU, WHITE } from "../../core/index.js";
import { beat, wake, spark, cloud, wake3, spark3, cloud3, tube, shadow3 } from "./_lib.js";

export const meta = {
  name: "Bullet tracer",
  desc: "A white-hot slug tearing along, its tracer burning behind it in a long streak that sputters and cools from white through gold to red, shedding sparks and a thread of smoke.",
  tags: ["projectile", "bullet", "tracer", "gun", "directional", "loop"],
  size: [200, 40],
  origin: [184, 18],
  duration: 0.6,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
    smoke: ["#2e2a36", "#46404f", "#625b6b", "#817a8a", "#a39caa"],
    length: 120,
    speed: 520,
    seed: 4,
  },
};

const SLUG = ["..oyyp..", ".ypwwwwp", "ywwwwwww", ".ypwwwwp", "..oyyp.."];

export function draw(p, t, o) {
  const F = fit(o.palette, 9), SM = fit(o.smoke, 5), S = o.seed, D = meta.duration, L = o.length, V = o.speed;
  const fr = Math.floor(t * 30 + 1e-6), ph = (TAU * t) / D, left = -meta.origin[0] + 2;

  // a thread of smoke off the cool end of the trace, wavering as it thins
  const puffs = [];
  beat(t, D, 18, S + 7, (r) => r.range(0.5, 0.7), (age, life, r) => {
    const k = age / life, x = -L * r.range(0.45, 0.8) - age * 90, y = 0.5 + Math.sin(age * 6 + r.range(0, TAU)) * age * 3 - age * age * 8;
    if (x < left + 6) return;
    puffs.push({ x, y, r: 1.2 + age * 4, a: 0.55 * (1 - k) * Math.min(1, age * 8) * smooth(left, left + 30, x), b: 0.95 - k * 0.4, w: 0 });
  });
  cloud(p, puffs, SM, SM, { dens: 1.2, max: 0.6 });

  // the trace: a tapering body of burning gas near the slug, banded white core, gold, an orange rim; past it a
  // one-pixel line cooling to red. The compound sputters, so brightness ripples back along it, and the cold end
  // breaks into dashes
  const heat = (d) => 1 - Math.pow(d / L, 0.8) + noise(d * 0.12 - t * 40, S) * 0.12 + 0.08 * Math.sin(d * 0.35 - ph * 9);
  const yAt = (d) => 0.5 + Math.sin(d * 0.09 + ph * 2) * (d / L) * 0.8, HOT = L * 0.32;
  p.shade(-HOT - 1, -4, 1, 5, (x, y) => {
    const d = -x, u = d / HOT;
    if (u < 0 || u > 1) return;
    const w = 0.7 + 2.3 * Math.pow(1 - u, 1.4) * (0.9 + 0.1 * Math.sin(d * 0.8 - ph * 12)), v = Math.abs(y - yAt(d)) / w;
    if (v > 1) return;
    const h = heat(d);
    return v < 0.38 ? (h > 0.8 ? WHITE : F[7]) : v < 0.7 ? (h > 0.75 ? F[7] : h > 0.6 ? F[6] : F[5]) : u < 0.5 ? F[5] : F[4];
  });
  for (let d = HOT; d <= L; d += 0.5) {
    const u = d / L, h = heat(d);
    if (u > 0.55 && rand(Math.floor(d / 3), fr, S) < (u - 0.55) * 1.6) continue;
    const c = h > 0.55 ? F[6] : h > 0.42 ? F[5] : h > 0.3 ? F[4] : h > 0.18 ? F[3] : h > 0.08 ? F[2] : F[1];
    p.dot(-d, yAt(d), c, u < 0.85 ? 1 : (1 - u) / 0.15);
  }
  p.glowLine(-2, 1, -L * 0.45, 1, 6, F[4], 0.35);
  p.glowLine(-2, 1, -L * 0.2, 1, 3, F[7], 0.3);

  // sparks of burning compound shed off the trace, dropping and cooling as they fall behind
  const SP = [F[7], F[6], F[4], F[3]];
  beat(t, D, 16, S + 2, (r) => r.range(0.1, 0.28), (age, life, r) => {
    const [x, y, vx, vy] = wake(-r.range(4, L * 0.5), 0.5 + r.range(-0.5, 1), -r.range(10, 80), r.range(-60, 50), age, V * 0.35, 3, 260);
    if (x > left + 8) spark(p, x, y, vx, vy, 1 - age / life, SP, 0.45, 0.012, 6);
  });

  // the slug: a white-hot pointed round, pale-rimmed, its nose a point of light
  p.sprite(SLUG, { w: WHITE, p: F[7], y: F[6], o: F[5] }, -1, -1);
  p.glow(2, 1, 24, F[4], 0.5);
  p.glow(3, 1, 8, WHITE, 0.55);
}

// 3D: the slug tears along +x over the floor. Its burning trace is a tapering tube of gas, then two thin strands
// that twist round each other in space as they cool; sparks are shed in every direction round the axis and the thread
// of smoke wavers off sideways as well as up. The origin is the middle of the whole streak.
const FLY = -24;
export const three = {
  meta: { size: [140, 76], origin: [70, 50], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const F = fit(o.palette, 9), SM = fit(o.smoke, 5), S = o.seed, D = meta.duration, L = o.length, V = o.speed, q = space(p, o);
    const fr = Math.floor(t * 30 + 1e-6), ph = (TAU * t) / D, left = -L - 6, SH = L / 2;
    const X = (x) => x + SH;
    shadow3(q, X(-L / 2), 0, L / 2 + 4, 2.6, 0.5);

    // the trace: heat falls off along it, sputtering as it goes
    const heat = (d) => 1 - Math.pow(d / L, 0.8) + noise(d * 0.12 - t * 40, S) * 0.12 + 0.08 * Math.sin(d * 0.35 - ph * 9);
    const wob = (d, s) => ((d / L) * (0.8 + 1.4 * (d / L))), twist = (d, s) => d * 0.09 + ph * 2 + s * Math.PI;
    const yAt = (d, s = 0) => FLY + Math.sin(twist(d, s)) * wob(d), zAt = (d, s = 0) => Math.cos(twist(d, s)) * wob(d);
    const HOT = L * 0.32, N = 16;

    // a thread of smoke off the cool end of the trace, wavering sideways and thinning
    const puffs = [];
    beat(t, D, 18, S + 7, (r) => r.range(0.5, 0.7), (age, life, r) => {
      const k = age / life, x = -L * r.range(0.45, 0.8) - age * 90, a0 = r.range(0, TAU);
      if (x < left) return;
      puffs.push({ x: X(x), y: FLY + 0.5 + Math.sin(age * 6 + a0) * age * 3 - age * age * 8, z: Math.cos(age * 5 + a0) * age * 4, r: 1.2 + age * 4, a: 0.55 * (1 - k) * Math.min(1, age * 8) * smooth(left, left + 30, x), b: 0.95 - k * 0.4, w: 0 });
    });

    // the slug first, then the trace behind it, nearest first
    tube(q, X(-2.2), FLY, 0, X(1.4), FLY, 0, 2.3, 1.5, (nx, ny, nz) => (nz > 0.55 ? WHITE : ny < -0.25 ? F[7] : F[6]));
    q.ball(X(2), FLY, 0, 1.2, (nx, ny, nz) => (nz > 0.4 ? WHITE : F[7]));
    for (let i = 0; i < N; i++) {
      const d0 = (HOT * i) / N + 1.5, d1 = (HOT * (i + 1)) / N + 1.5, um = (d0 + d1) / 2 / HOT;
      const w = 2 * (0.7 + 2.3 * Math.pow(1 - um, 1.4) * (0.9 + 0.1 * Math.sin(um * HOT * 0.8 - ph * 12)));
      q.beam(X(-d0), yAt(d0), zAt(d0), X(-d1), yAt(d1), zAt(d1), Math.max(1.4, w), (u, v) => {
        const d = d0 + (d1 - d0) * u, h = heat(d), uu = d / HOT;
        return v < 0.38 ? (h > 0.8 ? WHITE : F[7]) : v < 0.7 ? (h > 0.75 ? F[7] : h > 0.6 ? F[6] : F[5]) : uu < 0.5 ? F[5] : F[4];
      });
    }
    // past it, two one-pixel strands winding about each other, cooling to red and breaking into dashes
    for (const s of [0, 1])
      for (let d = HOT; d <= L; d += 0.5) {
        const u = d / L, h = heat(d);
        if (u > 0.55 && rand(Math.floor(d / 3), fr, S + s) < (u - 0.55) * 1.6) continue;
        const c = h > 0.55 ? F[6] : h > 0.42 ? F[5] : h > 0.3 ? F[4] : h > 0.18 ? F[3] : h > 0.08 ? F[2] : F[1];
        q.dot(X(-d), yAt(d, s), zAt(d, s), c, u < 0.85 ? 1 : (1 - u) / 0.15);
      }

    // sparks of burning compound shed off the trace in every direction round it, dropping and cooling behind
    const SP = [F[7], F[6], F[4], F[3]];
    beat(t, D, 16, S + 2, (r) => r.range(0.1, 0.28), (age, life, r) => {
      const a = r.range(0, TAU), v = r.range(10, 80), [x, y, z, vx, vy, vz] = wake3(-r.range(4, L * 0.5), FLY + r.range(-0.5, 1), 0, -r.range(10, 80), Math.sin(a) * v * 0.9 - r.range(0, 50), Math.cos(a) * v * 1.2, age, V * 0.35, 3, 260);
      if (x > left + 8) spark3(q, X(x), y, z, vx, vy, vz, 1 - age / life, SP, 0.45, 0.012, 6);
    });

    cloud3(q, puffs, SM, SM, { dens: 1.2, max: 0.6 });
    q.glowLine(X(-2), FLY, 0, X(-L * 0.45), FLY, 0, 6, F[4], 0.35);
    q.glowLine(X(-2), FLY, 0, X(-L * 0.2), FLY, 0, 3, F[7], 0.3);
    q.glow(X(2), FLY, 0, 24, F[4], 0.5);
    q.glow(X(3), FLY, 0, 8, WHITE, 0.55);
  },
};
