// The layered ball, its tapering wake and the zap to the floor with stars where it lands follow Sprite Fusion's
// open-source energy orb and bolt (https://www.spritefusion.com/pixel-art-vfx/energy),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, rng, cycle, space, TAU, WHITE, hex } from "../../core/index.js";
import { VOLT, PLASMA, zigzag, stroke, crackle, flight, spark, zigzag3, stroke3, crackle3, flight3, spark3, pool, nearer, orb } from "./_lib.js";

export const meta = {
  name: "Ball lightning",
  desc: "A crackling ball of plasma drifts on a wandering loop, spitting arcs off its skin and leaving a wake of fading motes, and zaps the floor when it dips low.",
  tags: ["lightning", "electric", "plasma", "orb", "wisp", "ambient", "loop"],
  size: [136, 104],
  origin: [68, 92],
  duration: 4,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: VOLT, sparks: PLASMA, seed: 9 },
};

const FPS = 30, N = 120, P = 4, ZAP = 62;
// where the ball is: a closed, wandering path that dips toward the floor once a loop
const at = (t) => {
  const a = (t / P) * TAU;
  return [38 * Math.sin(a) + 9 * Math.sin(2 * a + 1), -42 + 13 * Math.sin(2 * a + 0.4) + 6 * Math.sin(3 * a + 0.5)];
};

export function draw(p, t, o) {
  const C = fit(o.palette, 8), S = o.sparks.map(hex), f = Math.floor(t * FPS + 1e-6) % N, r = rng(o.seed, 1, f), [x, y] = at(t);
  // light under the ball on the floor, stronger as it comes low
  p.glow(x, -2, 30, C[3], 0.12 + 0.3 * clamp((y + 60) / 40));
  // the wake: where it has been, shrinking and cooling, and motes shed along it, drifting and dying
  for (let i = 14; i >= 1; i--) {
    const [wx, wy] = at(t - i * 0.034), u = i / 14, rr = 3 * (1 - u) + 0.3;
    if (u > 0.6 && (i + f) % 2) continue;
    p.circle(wx, wy, rr + 0.8, u < 0.35 ? C[3] : C[2]);
    p.circle(wx, wy, rr, u < 0.35 ? C[6] : u < 0.7 ? C[5] : C[4]);
    p.glow(wx, wy, 7 * (1 - u) + 3, C[4], 0.25 * (1 - u));
  }
  cycle(t, P, 40, o.seed + 5, (g) => g.range(0.5, 1), (age, life, q) => {
    const born = t - age, [bx, by] = at(born), k = 1 - age / life, a = q.range(0, TAU), sp = q.range(4, 14);
    const mx = bx + Math.cos(a) * sp * age + q.range(-3, 3), my = by + Math.sin(a) * sp * age + 6 * age + q.range(-3, 3);
    if (k > 0.25 || f % 2) p.px(mx, my, k > 0.6 ? C[6] : k > 0.3 ? C[4] : C[3]);
    p.glow(mx, my, 3, C[4], 0.3 * k);
  });
  // the ball: a churning skin with hot spots rolling round it, a white heart, corona bristling off it
  const R0 = 5.2 + 0.6 * Math.sin(t * 9) + 0.4 * r.range(-1, 1);
  p.circle(x, y, R0 + 1.3, C[2]);
  p.circle(x, y, R0, C[4]);
  p.circle(x - 0.4, y - 0.4, R0 * 0.72, C[5]);
  for (let i = 0; i < 3; i++) {
    const a = t * (5 + i * 2.3) + i * 2.1, d = R0 * 0.6;
    p.circle(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 1.2, i ? C[6] : WHITE);
  }
  p.circle(x - 0.6, y - 0.6, R0 * 0.32, WHITE);
  for (let i = 0; i < 8; i++) {
    if (r.next() < 0.35) continue;
    const a = (i / 8) * TAU + t * 2 + r.range(-0.2, 0.2), l = r.range(1.5, 4);
    p.line(x + Math.cos(a) * (R0 + 1), y + Math.sin(a) * (R0 + 1), x + Math.cos(a) * (R0 + 1 + l), y + Math.sin(a) * (R0 + 1 + l), i % 2 ? C[5] : C[4]);
  }
  p.glow(x, y, 30, C[4], 0.3);
  p.glow(x, y, 9, C[6], 0.1);
  // arcs spat off its skin, re-struck every frame
  for (let i = 0; i < 2 + (r.next() < 0.4 ? 1 : 0); i++) {
    const a = r.range(0, TAU), l = r.range(5, 11), x0 = x + Math.cos(a) * (R0 + 1), y0 = y + Math.sin(a) * (R0 + 1), b = a + r.range(-0.7, 0.7);
    crackle(p, zigzag(r, x0, y0, x0 + Math.cos(b) * l, y0 + Math.sin(b) * l, 0.4, 0.3), r.range(0.4, 0.7), C, 0.25);
  }
  // once a loop, low over the floor, it zaps down: a bolt, the floor lit, sparks kicked up
  const za = f - ZAP, [zx] = at(ZAP / FPS), gx = zx + rng(o.seed, 3).range(-10, 10);
  if (za >= 0 && za < 4) {
    const k = [1, 0.6, 0.9, 0.4][za];
    stroke(p, zigzag(rng(o.seed, 4, f), x, y + R0, gx, 0, 0.28, 0.4), k, C, 0.7, { hero: za === 0 });
    p.circle(gx, -1, 2.5 * k + 1, C[5]);
    p.px(gx, -1, WHITE);
    p.glow(gx, -4, 34, C[4], 0.6 * k);
  }
  const sa = (((t - ZAP / FPS) % P) + P) % P;
  for (let j = 0; j < 14; j++) {
    const q = rng(o.seed, 7, j), life = q.range(0.25, 0.55);
    if (sa >= life) continue;
    const a = -Math.PI / 2 + q.range(-1.3, 1.3), sp = q.range(50, 170), [sx, sy, vx, vy] = flight(gx, -1, Math.cos(a) * sp, Math.sin(a) * sp, sa, { floor: 0 });
    spark(p, sx, sy, vx, vy, 1 - sa / life, S);
  }
}

// ---- 3D: the ball wanders a looping path through space (round the character's place and back, never in one plane),
// rolls its hot spots over its skin, sheds a wake of motes and arcs in every direction, and zaps the floor under it.
const at3 = (t) => {
  const a = (t / P) * TAU, [x, y] = at(t);
  return [x, y, 36 * Math.sin(a + 1.3) + 9 * Math.sin(3 * a + 0.2)];
};

export const three = {
  meta: { size: [144, 120], origin: [72, 100], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), S = o.sparks.map(hex), f = Math.floor(t * FPS + 1e-6) % N, r = rng(o.seed, 1, f), P0 = at3(t);
    // the wake: where it has been, shrinking and cooling
    for (let i = 14; i >= 1; i--) {
      const [wx, wy, wz] = at3(t - i * 0.034), u = i / 14, rr = 3 * (1 - u) + 0.3;
      if (u > 0.6 && (i + f) % 2) continue;
      orb(q, wx, wy, wz, rr, u < 0.35 ? C[3] : C[2], u < 0.35 ? C[6] : u < 0.7 ? C[5] : C[4], u < 0.35 ? C[6] : u < 0.7 ? C[5] : C[4], u < 0.35 ? C[6] : C[5]);
    }
    // the ball: a churning skin with hot spots rolling right round it, a white heart, corona bristling off it
    const R0 = 5.2 + 0.6 * Math.sin(t * 9) + 0.4 * r.range(-1, 1), [x, y, z] = nearer(q, ...P0, 48);
    orb(q, x, y, z, R0, C[2], C[4], C[5], WHITE);
    for (let i = 0; i < 3; i++) {
      const az = t * (5 + i * 2.3) + i * 2.1, el = 0.8 * Math.sin(az * 0.45 + i), c = Math.cos(el);
      q.ball(x + Math.cos(az) * c * R0 * 0.96, y + Math.sin(el) * R0 * 0.96, z + Math.sin(az) * c * R0 * 0.96, 1.2, i ? C[6] : WHITE);
    }
    for (let i = 0; i < 8; i++) {
      if (r.next() < 0.35) continue;
      const az = r.range(0, TAU), el = r.range(-1.4, 1.4), l = r.range(1.5, 4), d = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
      q.line(x + d[0] * (R0 + 1), y + d[1] * (R0 + 1), z + d[2] * (R0 + 1), x + d[0] * (R0 + 1 + l), y + d[1] * (R0 + 1 + l), z + d[2] * (R0 + 1 + l), i % 2 ? C[5] : C[4]);
    }
    // motes shed along the path, drifting off every way and dying
    cycle(t, P, 40, o.seed + 5, (g) => g.range(0.5, 1), (age, life, g) => {
      const [bx, by, bz] = at3(t - age), k = 1 - age / life, az = g.range(0, TAU), el = g.range(-1.2, 1.2), sp = g.range(4, 14);
      const mx = bx + Math.cos(az) * Math.cos(el) * sp * age + g.range(-3, 3), my = by + Math.sin(el) * sp * age + 6 * age + g.range(-3, 3), mz = bz + Math.sin(az) * Math.cos(el) * sp * age + g.range(-3, 3);
      if (k > 0.25 || f % 2) q.px(mx, my, mz, k > 0.6 ? C[6] : k > 0.3 ? C[4] : C[3]);
      q.glow(mx, my, mz, 3, C[4], 0.3 * k);
    });
    // arcs spat off its skin, re-struck every frame, any way out
    for (let i = 0; i < 2 + (r.next() < 0.4 ? 1 : 0); i++) {
      const az = r.range(0, TAU), el = r.range(-1.3, 1.3), l = r.range(5, 11), d = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
      const a0 = [x + d[0] * (R0 + 1), y + d[1] * (R0 + 1), z + d[2] * (R0 + 1)], az2 = az + r.range(-0.7, 0.7), el2 = el + r.range(-0.7, 0.7);
      crackle3(q, zigzag3(r, a0, [a0[0] + Math.cos(az2) * Math.cos(el2) * l, a0[1] + Math.sin(el2) * l, a0[2] + Math.sin(az2) * Math.cos(el2) * l], 0.4, 0.3), r.range(0.4, 0.7), C, 0.25);
    }
    // once a loop, low over the floor, it zaps down: a bolt, the floor lit, sparks kicked up
    const za = f - ZAP, [zx, , zz] = at3(ZAP / FPS), zr = rng(o.seed, 3), gx = zx + zr.range(-10, 10), gz = zz + zr.range(-10, 10);
    if (za >= 0 && za < 4) {
      const k = [1, 0.6, 0.9, 0.4][za];
      stroke3(q, zigzag3(rng(o.seed, 4, f), [P0[0], P0[1] + R0, P0[2]], [gx, 0, gz], 0.28, 0.4), k, C, 0.85, { hero: za === 0 });
      q.plane(gx, -0.5, gz, null, 2.5 * k + 1, (u, v) => (Math.hypot(u, v) < 0.9 ? WHITE : C[5]));
      q.glow(gx, -4, gz, 34, C[4], 0.6 * k);
    }
    const sa = (((t - ZAP / FPS) % P) + P) % P;
    for (let j = 0; j < 14; j++) {
      const qq = rng(o.seed, 7, j), life = qq.range(0.25, 0.55);
      if (sa >= life) continue;
      const a = -Math.PI / 2 + qq.range(-1.3, 1.3), sp = qq.range(50, 170), phi = qq.range(0, TAU), hz = Math.cos(a) * sp;
      const [sx, sy, sz, vx, vy, vz] = flight3(gx, -1, gz, hz * Math.cos(phi), Math.sin(a) * sp, hz * Math.sin(phi), sa, { floor: 0 });
      spark3(q, sx, sy, sz, vx, vy, vz, 1 - sa / life, S);
    }
    // light: the ball's own, and its pool on the floor under it, stronger as it comes low
    q.glow(...P0, 30, C[4], 0.3);
    q.glow(...P0, 9, C[6], 0.1);
    pool(q, P0[0], P0[2], 34, C[3], 0.2 + 0.4 * clamp((P0[1] + 60) / 40));
  },
};
