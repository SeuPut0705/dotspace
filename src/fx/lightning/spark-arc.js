// The arc's re-struck bowed shape, its halo-body-core inking, its flicker and the nodes where it roots follow
// Sprite Fusion's open-source lightning (https://www.spritefusion.com/pixel-art-vfx/lightning),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, rng, space, TAU, WHITE, hex, mix, ease } from "../../core/index.js";
import { VOLT, PLASMA, bowed, stroke, crackle, zigzag, flight, spark, puff, heat, bowed3, stroke3, crackle3, zigzag3, flight3, spark3, puff3, pool } from "./_lib.js";

export const meta = {
  name: "Spark arc",
  desc: "A climbing arc between two rods: it strikes white at their narrow foot, climbs on rising heat as it stretches and bows, sputters and snaps at the top, then strikes again.",
  tags: ["lightning", "electric", "arc", "jacobs-ladder", "machine", "prop", "loop"],
  size: [124, 120],
  origin: [62, 108],
  duration: 2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: VOLT, sparks: PLASMA, seed: 2 },
};

const FPS = 30, N = 60, P = 2, SNAP = 1.42, H = 58, STEEL = ["#151823", "#262c3b", "#3d4558", "#5f6a82", "#8f9bb2", "#d2daea"].map(hex);
const CERAMIC = ["#4b4458", "#857d96", "#c9c1d6", "#efe9f6"].map(hex), ASH = hex("#6a6478");
// the rods: a V from the insulators up; where the arc roots at height h above the gap
const rodAt = (s, h) => [s * (4.5 + (h / 60) * 19.5), -9 - h];
const height = (t) => 1.5 + H * Math.pow(clamp(t / SNAP), 1.35);

export function draw(p, t, o) {
  const C = fit(o.palette, 8), S = o.sparks.map(hex), f = Math.floor(t * FPS + 1e-6) % N, r = rng(o.seed, 1, f);
  const climbing = t < SNAP, h = height(t), u = clamp(t / SNAP), a = t - SNAP;
  // the floor and the stand: a pool of cold light while it burns, a plate, two ribbed insulators
  p.glow(0, -14, 50, C[3], climbing ? 0.2 + 0.15 * (1 - u) : 0.06);
  p.rect(-18, -3, 36, 3, STEEL[1]);
  p.line(-18, -3, 17, -3, STEEL[3]);
  for (const s of [-1, 1])
    for (let y = -9; y < -3; y++) {
      const rib = (y & 1) === 0;
      for (let x = 2; x <= 6; x++) p.px(s * x - (s < 0 ? 1 : 0), y, rib ? CERAMIC[x < 4 ? 3 : x < 6 ? 2 : 1] : CERAMIC[x < 5 ? 1 : 0]);
    }
  // the rods: steel, a lit edge, glowing where the arc has passed and cooling behind it
  for (const s of [-1, 1]) {
    for (let hh = 0; hh <= 60; hh += 0.5) {
      // when the arc passed this point; not yet this time round, it is still cooling from the last
      const [x, y] = rodAt(s, hh), tp = SNAP * Math.pow(clamp((hh - 1.5) / H), 1 / 1.35), age = t >= tp ? t - tp : t - tp + P;
      const hot = hh > H + 2 ? 0 : Math.exp(-age / 0.26), c = heat(hot * 1.05 - 0.12);
      p.px(x, y, c || (s < 0 ? STEEL[4] : STEEL[3]));
      p.px(x + s, y, c && hot > 0.35 ? heat(hot * 0.6) || STEEL[2] : s < 0 ? STEEL[2] : STEEL[1]);
      if (hot > 0.3 && (Math.round(hh * 2) & 3) === 0) p.glow(x, y, 5, c || C[4], 0.25 * hot);
    }
    const [tx, ty] = rodAt(s, 60);
    p.circle(tx + s * 0.5, ty, 1.6, STEEL[4]);
    p.px(tx + s * 0.5 - 0.5, ty - 1, STEEL[5]);
  }
  // the arc: struck white at the foot, flickering as it climbs and stretches, sputtering at the top
  if (climbing) {
    const [xl, yl] = rodAt(-1, h), [xr, yr] = rodAt(1, h), k0 = t < 1 / FPS ? 1 : 1 - 0.22 * u, sput = u > 0.88 && r.next() < 0.25 ? 0.4 : 1;
    const k = k0 * sput * (0.82 + 0.18 * r.next()), bow = -(1.5 + 13 * u * u) * (0.8 + 0.4 * r.next());
    stroke(p, bowed(r, xl, yl, xr, yr, bow, 0.18 + 0.12 * u, 0.12 + 0.25 * u), k, C, t < 1 / FPS ? 0.95 : 0.8, { hero: t < 1 / FPS, light: 0.7 });
    p.glowLine(xl, yl + bow * 0.5, xr, yr + bow * 0.5, 12, C[4], 0.22 * k);
    for (const [x, y] of [[xl, yl], [xr, yr]]) {
      p.circle(x, y, 1.8 + 0.6 * k, C[5]);
      p.px(x, y, WHITE);
      p.glow(x, y, 12, C[5], 0.55 * k);
    }
    if (t < 0.1) p.glow(0, -11, 26, C[6], 0.45 * (1 - t / 0.1));
  } else if (a < 2 / FPS) {
    // the snap: two stubs left clinging to the rods, a flash where it broke
    const [xl, yl] = rodAt(-1, H + 1.5), [xr, yr] = rodAt(1, H + 1.5);
    for (const [x0, y0, s] of [[xl, yl, 1], [xr, yr, -1]]) crackle(p, zigzag(r, x0, y0, x0 + s * r.range(5, 9), y0 - r.range(2, 6), 0.4, 0.3), 0.7, C, 0.4);
    p.glow(0, yl - 8, 30, C[4], 0.5);
  } else if (t > P - 0.16) {
    // anticipation: little sparks jump the narrow gap before it strikes again
    if (r.next() < 0.7) crackle(p, zigzag(r, -4.5, -10.5 - r.range(0, 2), 4.5, -10.5 - r.range(0, 2), 0.5, 0), 0.4 + 0.3 * r.next(), C, 0.35);
  }
  // ozone and smoke rise off the arc while it climbs, and from where it snapped
  for (let j = 0; j < 3; j++) {
    const born = ((j + 1) / 3.2) * SNAP, age = (((t - born) % P) + P) % P, life = 1;
    if (age >= life) continue;
    const y0 = -9 - height(born) - 6;
    puff(p, (j % 2 ? 3 : -3) + Math.sin(age * 3 + j) * 2, y0 - age * 20, 1.8 + j * 0.3, age / life, mix(ASH, C[5], 0.3));
  }
  // sparks: thrown from the roots as it strikes, sprayed up where it snaps, molten drips off the rods
  const burst = (t0, n, salt, from) => {
    const age = (((t - t0) % P) + P) % P;
    for (let j = 0; j < n; j++) {
      const q = rng(o.seed, salt, j), life = q.range(0.25, 0.6);
      if (age >= life) continue;
      const [x0, y0, a0, spread, sp0, sp1] = from(q, j), ang = a0 + q.range(-spread, spread), sp = q.range(sp0, sp1);
      const [x, y, vx, vy] = flight(x0, y0, Math.cos(ang) * sp, Math.sin(ang) * sp, age, { floor: 0 });
      spark(p, x, y, vx, vy, 1 - age / life, S);
    }
  };
  burst(0, 12, 11, (q, j) => [...rodAt(j % 2 ? 1 : -1, 1.5), -Math.PI / 2 + (j % 2 ? 0.6 : -0.6), 1, 60, 170]);
  burst(SNAP, 14, 12, (q, j) => [rodAt(1, H)[0] * q.range(-0.8, 0.8), -9 - H - 6, -Math.PI / 2, 1.3, 50, 160]);
  for (const [k, tt] of [[0, 0.45], [1, 0.8], [2, 1.15]]) burst(tt, 2, 20 + k, (q, j) => [...rodAt(j % 2 ? 1 : -1, height(tt)), Math.PI / 2, 0.5, 5, 30]);
  if (climbing || a < 0.25) p.glow(0, -9 - h - 3, 26, C[4], climbing ? 0.25 : 0.4 * (1 - a / 0.25));
}

// The same ladder standing in space, turned a little off the front so no side is ever edge-on: a round plate and two ribbed insulators, the rods a V, the arc
// bowing up and out in any direction as it climbs, smoke rising off it and sparks thrown every way round.
const TILT = 0.4, COS = Math.cos(TILT), SIN = Math.sin(TILT), R3 = (x, y, z) => [x * COS - z * SIN, y, x * SIN + z * COS];
export const three = {
  meta: { size: [136, 124], origin: [68, 110], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), S = o.sparks.map(hex), f = Math.floor(t * FPS + 1e-6) % N, r = rng(o.seed, 1, f);
    const climbing = t < SNAP, h = height(t), u = clamp(t / SNAP), a = t - SNAP, rod = (s, hh) => R3(...rodAt(s, hh), 0);
    // the stand: a round steel plate (top, rim, wall) and two ribbed ceramic insulators
    q.plane(0, -1, 0, null, 19, (x, z) => STEEL[0]);
    q.plane(0, -2, 0, null, 19, () => STEEL[1]);
    q.plane(0, -3, 0, null, 19, (x, z, out) => (Math.hypot(x, z) > 17.5 ? STEEL[4] : Math.hypot(x, z) > 16.5 ? STEEL[3] : STEEL[2]));
    for (const s of [-1, 1]) q.beam(...R3(s * 4.5, -3, 0), ...R3(s * 4.5, -9.5, 0), 5, (uu, v) => ((uu * 6) % 1 < 0.5 ? (v < 0.4 ? CERAMIC[3] : CERAMIC[2]) : v < 0.5 ? CERAMIC[1] : CERAMIC[0]));
    // the rods: steel, glowing where the arc has passed and cooling behind it
    for (const s of [-1, 1]) {
      for (let hh = 0; hh < 60; hh += 4) {
        const mid = hh + 2, tp = SNAP * Math.pow(clamp((mid - 1.5) / H), 1 / 1.35), age = t >= tp ? t - tp : t - tp + P;
        const hot = mid > H + 2 ? 0 : Math.exp(-age / 0.26), c = heat(hot * 1.05 - 0.12);
        q.beam(...rod(s, hh), ...rod(s, hh + 4.4), 2.2, (uu, v) => (c && v < 0.7 ? c : v < 0.45 ? (s < 0 ? STEEL[4] : STEEL[3]) : s < 0 ? STEEL[2] : STEEL[1]));
      }
      q.ball(...rod(s, 60), 1.7, (nx, ny) => (nx < -0.3 && ny < -0.3 ? STEEL[5] : STEEL[4]));
    }
    // the arc: struck white at the foot, flickering as it climbs and stretches, sputtering at the top
    if (climbing) {
      const L = rod(-1, h), Rr = rod(1, h), k0 = t < 1 / FPS ? 1 : 1 - 0.22 * u, sput = u > 0.88 && r.next() < 0.25 ? 0.4 : 1;
      const k = k0 * sput * (0.82 + 0.18 * r.next()), bow = (1.5 + 13 * u * u) * (0.8 + 0.4 * r.next());
      stroke3(q, bowed3(r, L, Rr, bow, 0.18 + 0.12 * u, 0.12 + 0.25 * u, [0, -1, r.range(-0.9, 0.9)]), k, C, t < 1 / FPS ? 0.95 : 0.8, { hero: t < 1 / FPS, light: 0.7 });
      q.glowLine(...L, ...Rr, 12, C[4], 0.22 * k);
      for (const e of [L, Rr]) {
        q.ball(...e, 1.9 + 0.6 * k, C[5]);
        q.glow(...e, 12, C[5], 0.55 * k);
      }
      if (t < 0.1) q.glow(0, -11, 0, 26, C[6], 0.45 * (1 - t / 0.1));
    } else if (a < 2 / FPS) {
      // the snap: two stubs left clinging to the rods, a flash where it broke
      const L = rod(-1, H + 1.5), Rr = rod(1, H + 1.5);
      for (const [e, s] of [[L, 1], [Rr, -1]]) {
        const e1 = [e[0] + s * r.range(5, 9) * COS, e[1] - r.range(2, 6), e[2] + s * r.range(5, 9) * SIN + r.range(-6, 6)];
        crackle3(q, zigzag3(r, e, e1, 0.4, 0.3), 0.7, C, 0.4);
      }
      q.glow(0, L[1] - 8, 0, 30, C[4], 0.5);
    } else if (t > P - 0.16) {
      // anticipation: little sparks jump the narrow gap before it strikes again
      if (r.next() < 0.7) crackle3(q, zigzag3(r, R3(-4.5, -10.5 - r.range(0, 2), 0), R3(4.5, -10.5 - r.range(0, 2), 0), 0.5, 0), 0.4 + 0.3 * r.next(), C, 0.35);
    }
    // sparks: thrown from the roots as it strikes, sprayed up where it snaps, molten drips off the rods
    const burst = (t0, n, salt, from) => {
      const age = (((t - t0) % P) + P) % P;
      for (let j = 0; j < n; j++) {
        const qq = rng(o.seed, salt, j), life = qq.range(0.25, 0.6);
        if (age >= life) continue;
        const [x0, y0, a0, spread, sp0, sp1, az] = from(qq, j), ang = a0 + qq.range(-spread, spread), sp = qq.range(sp0, sp1), phi = az === undefined ? qq.range(0, TAU) : az + qq.range(-1.1, 1.1);
        const hz = Math.cos(ang) * sp, [x, y, z, vx, vy, vz] = flight3(...R3(x0, y0, 0), hz * Math.cos(phi), Math.sin(ang) * sp, hz * Math.sin(phi), age, { floor: 0 });
        spark3(q, x, y, z, vx, vy, vz, 1 - age / life, S);
      }
    };
    burst(0, 12, 11, (qq, j) => [...rodAt(j % 2 ? 1 : -1, 1.5), -Math.PI / 2 + (j % 2 ? 0.6 : -0.6), 1, 60, 170, (j % 2 ? 0 : Math.PI) + TILT]);
    burst(SNAP, 14, 12, (qq) => [rodAt(1, H)[0] * qq.range(-0.8, 0.8), -9 - H - 6, -Math.PI / 2, 1.3, 50, 160]);
    for (const [k, tt] of [[0, 0.45], [1, 0.8], [2, 1.15]]) burst(tt, 2, 20 + k, (qq, j) => [...rodAt(j % 2 ? 1 : -1, height(tt)), Math.PI / 2, 0.5, 5, 30]);
    // light: a pool of cold light on the plate and the floor while it burns, round the arc
    pool(q, 0, 0, 52, C[3], (climbing ? 0.2 + 0.15 * (1 - u) : 0.06) * 1.6);
    q.glow(0, -14, 0, 50, C[3], climbing ? 0.2 + 0.15 * (1 - u) : 0.06);
    if (climbing || a < 0.25) q.glow(0, -9 - h - 3, 0, 26, C[4], climbing ? 0.25 : 0.4 * (1 - a / 0.25));
    for (const s of [-1, 1])
      for (let hh = 0; hh <= 60; hh += 4) {
        const mid = hh, tp = SNAP * Math.pow(clamp((mid - 1.5) / H), 1 / 1.35), age = t >= tp ? t - tp : t - tp + P, hot = mid > H + 2 ? 0 : Math.exp(-age / 0.26);
        if (hot > 0.3) q.glow(...rod(s, hh), 5, heat(hot * 1.05 - 0.12) || C[4], 0.25 * hot);
      }
    // ozone and smoke rise off the arc while it climbs, and from where it snapped, drifting out every way
    const smoke = [];
    for (let j = 0; j < 3; j++) {
      const born = ((j + 1) / 3.2) * SNAP, age = (((t - born) % P) + P) % P, life = 1;
      if (age >= life) continue;
      const y0 = -9 - height(born) - 6, ph = j * 2.1;
      smoke.push([(j % 2 ? 3 : -3) + Math.sin(age * 3 + j) * 2 + Math.cos(ph) * age * 5, y0 - age * 20, Math.sin(age * 2.4 + ph) * 3 + Math.sin(ph) * age * 5, age / life, 1.8 + j * 0.3]);
    }
    for (const [x, y, z, uu, sz] of q.sort(smoke, (e) => e)) puff3(q, x, y, z, sz, uu, mix(ASH, C[5], 0.3));
  },
};
