// The glints (a cross of rays with a white heart and soft light, little twinkling stars around it) are adapted from
// Sprite Fusion's open-source sparkle (https://www.spritefusion.com/pixel-art-vfx/sparkle), MIT License,
// Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, smooth, rand, wrap, mix, at, space, TAU, WHITE, sparkle } from "../../core/index.js";
import { clip, rows, box } from "./_lib.js";

export const meta = {
  name: "Shooting stars",
  desc: "Meteors burn across a starry sky, white heads trailing gold and rose; the big ones flare and break up, and each leaves a glowing train that twists and fades.",
  tags: ["weather", "meteor", "shooting star", "night", "sky", "stars", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 180],
  duration: 10,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#3a1e5a", "#7a3a8a", "#e0607a", "#ffa86a", "#ffe6a8", "#ffffff"],
    sky: ["#141428", "#2a2a4a", "#4c4c7c", "#8e8ec4", "#dcdcff"],
    seed: 4,
  },
};

const D = 10;
// the meteors: when, where they start, which way, how fast, how long they burn, how big; the last flares
const METEORS = [
  { t0: 0.5, x: 60, y: -170, a: 2.45, v: 260, life: 0.55, s: 0.6 },
  { t0: 1.9, x: -40, y: -176, a: 2.2, v: 220, life: 0.7, s: 0.8 },
  { t0: 3.4, x: 150, y: -150, a: 2.62, v: 300, life: 0.45, s: 0.5 },
  { t0: 4.6, x: 130, y: -178, a: 2.35, v: 240, life: 1.05, s: 1.4, flare: true },
  { t0: 6.7, x: -90, y: -168, a: 2.05, v: 200, life: 0.6, s: 0.7 },
  { t0: 7.9, x: 20, y: -160, a: 2.5, v: 280, life: 0.5, s: 0.6 },
  { t0: 9.2, x: -10, y: -176, a: 2.28, v: 230, life: 0.8, s: 1, flare: true },
];
const TRAIN = 1.6;

export function draw(p, t, o) {
  const q = clip(p, meta), B = box(meta), S = o.seed, C = fit(o.palette, 6), K = fit(o.sky, 5);
  sky(p, q, t, S, K);
  METEORS.forEach((m, i) => meteor(q, wrap(t - m.t0, D), m, i, S, C));
}

// the starfield: a faint milky band across the sky, dim specks, steady stars, a few that twinkle with a glint
function sky(p, q, t, S, K) {
  rows(p, meta, -180, -1, (y, R) => {
    for (let i = 0; i < 320; i++) {
      const x = i - 160 + 0.5, d = Math.abs((y + 110) - (x * -0.32)) / 36;
      if (d >= 1) continue;
      const k = (1 - d) * (1 - d);
      R.l[i] = K[2];
      R.k[i] = 0.1 * k;
      if (rand(i, Math.floor(y), S, 5) < 0.05 * k) (R.c[i] = K[2]), (R.a[i] = 0.7);
    }
  });
  for (let i = 0; i < 130; i++) {
    const x = -160 + rand(S, i, 1) * 320, y = -180 + rand(S, i, 2) * 178, r = rand(S, i, 3), c = 1 + Math.floor(rand(S, i, 4) * 4);
    const tw = 0.5 + 0.5 * Math.sin((TAU * c * t) / D + rand(S, i, 5) * TAU);
    if (r < 0.6) q.dot(x, y, K[3], 0.35 + 0.5 * tw);
    else if (r < 0.94) (q.px(x, y, r < 0.8 ? K[4] : WHITE), q.glow(x + 0.5, y + 0.5, 3, K[3], 0.22 * tw));
    else sparkle(q, x, y, 1 + Math.round(tw * 2), K[4], K[3], 0.3 * tw);
  }
}

// one meteor, age seconds after it lights: a head that brightens and burns out, a trail cooling down the ramp
// behind it, a flare and fragments for the big ones, and the train it leaves glowing and twisting as it fades
function meteor(q, age, m, i, S, C) {
  const ca = Math.cos(m.a), sa = Math.sin(m.a), end = m.life + (m.flare ? 0.5 : 0) + TRAIN;
  if (age > end) return;
  const pos = (tt) => [m.x + ca * m.v * tt, m.y + sa * m.v * tt], burn = Math.min(age, m.life), [hx, hy] = pos(burn);
  // the train: the whole path it has burned, lingering, widening, drifting and twisting
  const trainK = age < m.life ? 1 : 1 - (age - m.life) / (TRAIN + (m.flare ? 0.5 : 0));
  if (trainK > 0) {
    const len = m.v * burn, nx = -sa, ny = ca;
    for (let d = 0; d < len; d += 1) {
      const passed = age - d / m.v;
      if (passed < 0.08) continue;
      const g = trainK * Math.min(1, (passed - 0.08) * 4) * (0.35 + 0.65 * Math.sin((Math.PI * d) / len)) * m.s, tw = Math.sin(d * 0.09 + passed * 1.7) * Math.min(4, passed * 3);
      const x = m.x + ca * d + nx * tw + passed * 4, y = m.y + sa * d + ny * tw;
      q.dot(x, y, passed < 0.6 ? C[2] : C[1], g * 0.75);
      if (d % 6 === 0) q.glow(x, y, 6 + passed * 4, C[1], 0.12 * g);
    }
  }
  if (age > m.life + (m.flare ? 0.5 : 0)) return;
  // the head brightens fast, holds, and burns out; the big ones flare as they go
  const u = age / m.life, k = age < m.life ? Math.min(1, u * 6) * (u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1) : 0;
  if (k > 0) {
    const L = (24 + 40 * m.s) * Math.min(1, u * 3);
    for (let d = 0; d <= L; d += 0.5) {
      const v = d / L, x = hx - ca * d, y = hy - sa * d;
      q.dot(x, y, v < 0.08 ? WHITE : at(C.slice(1).reverse(), v * 0.95), k * (v < 0.6 ? 1 : (1 - v) / 0.4));
      if (m.s > 0.9 && v < 0.4) q.dot(x - sa * 0.9, y + ca * 0.9, v < 0.15 ? C[4] : C[3], k * (1 - v / 0.4));
    }
    q.px(hx, hy, WHITE);
    if (m.s > 0.9) (q.px(hx + 1, hy, WHITE), q.px(hx, hy + 1, C[4]));
    q.glow(hx, hy, 8 + 10 * m.s, C[4], 0.45 * k);
    q.glow(hx - ca * L * 0.3, hy - sa * L * 0.3, 10 + 8 * m.s, C[3], 0.2 * k);
  }
  if (!m.flare || age < m.life * 0.82) return;
  // the flare: a burst of light and rays, fragments carrying on and fading
  const f = (age - m.life * 0.82) / (m.life * 0.18 + 0.5), [fx, fy] = pos(m.life * 0.86);
  if (f < 0.35) {
    sparkle(q, fx, fy, 9 * Math.sin((Math.PI * f) / 0.35) + 2, C[4], C[3], 0.6);
    q.glow(fx, fy, 40, C[3], 0.5 * (1 - f / 0.35));
  }
  // little stars scattered round the burst, each twinkling once and gone
  for (let j = 0; j < 7; j++) {
    const ang = rand(S, i, j, 5) * TAU, r = 5 + rand(S, i, j, 6) * 16, d0 = rand(S, i, j, 7) * 0.3, g = (f - d0) / 0.45;
    if (g <= 0 || g >= 1) continue;
    const sx = fx + Math.cos(ang) * r * (0.6 + g * 0.5), sy = fy + Math.sin(ang) * r * (0.6 + g * 0.5) - g * 3, arm = Math.round(2.5 * Math.sin(Math.PI * g));
    if (arm >= 1) sparkle(q, sx, sy, arm, j % 3 ? C[4] : WHITE, C[3], 0.3 * (1 - g));
    else q.px(sx, sy, C[4]);
  }
  for (let j = 0; j < 4; j++) {
    const da = (rand(S, i, j, 1) - 0.5) * 0.5, sp = m.v * (0.5 + rand(S, i, j, 2) * 0.4), tt = f * (m.life * 0.18 + 0.5), g = 1 - f;
    const x = fx + Math.cos(m.a + da) * sp * tt, y = fy + Math.sin(m.a + da) * sp * tt;
    if (g <= 0) continue;
    q.line(x - Math.cos(m.a + da) * 5 * g, y - Math.sin(m.a + da) * 5 * g, x, y, C[3], g);
    q.px(x, y, g > 0.5 ? WHITE : C[4]);
    q.glow(x, y, 5, C[3], 0.35 * g);
  }
}

// ---- the 3D variant: the sky is a dome over the floor. Far stars sit at real places on it (a faint milky arch
// of them across it), and each meteor is a real streak crossing the dome from one point to another at its own
// depth and direction, high or low, all the way round; the trains twist in a helix and drift on the wind.
const SR = 104, RAD = Math.PI / 180;
const dome = (f, e, R) => [R * Math.cos(e * RAD) * Math.sin(f), -R * Math.sin(e * RAD), R * Math.cos(e * RAD) * Math.cos(f)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a) => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// the 2D meteors' timing, size and flare, each now with a start and an end on the dome: [azimuth, elevation deg, radius]
const WAYS = [
  [[-2.6, 66, 100], [-1.2, 22, 92]],
  [[0.3, 72, 96], [1.7, 30, 100]],
  [[2.7, 52, 90], [3.9, 14, 98]],
  [[-0.3, 70, 100], [-1.7, 20, 86]],
  [[1.6, 44, 98], [2.8, 8, 94]],
  [[-3.0, 70, 94], [-1.9, 36, 100]],
  [[1.2, 58, 104], [-0.3, 16, 90]],
];
const M3 = METEORS.map((m, i) => {
  const a = dome(...WAYS[i][0]), b = dome(...WAYS[i][1]), d = sub(b, a), len = Math.hypot(...d), dir = unit(d), n1 = unit(cross(dir, [0, 1, 0])), n2 = cross(dir, n1);
  return { ...m, P0: a, dir, v: len / m.life, n1, n2 };
});

export const three = {
  meta: { size: [236, 160], origin: [118, 117], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), S = o.seed, C = fit(o.palette, 6), K = fit(o.sky, 5), glows = [], heads = [];
    q.ring(0, 0, 0, SR, 1.5, K[1], 0.6);
    stars3(q, t, S, K);
    M3.forEach((m, i) => meteor3(q, wrap(t - m.t0, D), m, i, S, C, glows, heads));
    // light: a faint wash on the floor under a burning meteor, then each glow
    if (heads.length)
      q.plane(0, 0, 0, null, SR, (u, v, out) => {
        let k = 0;
        for (const [x, z, g] of heads) {
          const e = 1 - Math.hypot(u - x, v - z) / 80;
          if (e > 0) k += e * e * g * 0.14;
        }
        out.l = C[3];
        out.k = Math.min(0.22, k);
      });
    for (const [x, y, z, r, c, k] of glows) q.glow(x, y, z, r, c, k);
  },
};

// the sky dome: dim specks, steady stars, a few bright ones that twinkle with a glint, and a faint milky arch of
// specks across it. The half of the dome nearer the eye is drawn dimmer so it never covers the scene.
function stars3(q, t, S, K) {
  const near = (x, y, z) => 0.3 + 0.7 * smooth(30, -30, q.toward(x, y, z));
  for (let i = 0; i < 130; i++) {
    const [x, y, z] = dome(rand(S, i, 1) * TAU, Math.asin(0.06 + 0.94 * rand(S, i, 2)) / RAD, 108), r = rand(S, i, 3), c = 1 + Math.floor(rand(S, i, 4) * 4);
    const tw = 0.5 + 0.5 * Math.sin((TAU * c * t) / D + rand(S, i, 5) * TAU), nr = near(x, y, z);
    if (r < 0.6) q.dot(x, y, z, K[3], (0.35 + 0.5 * tw) * nr);
    else if (r < 0.95) {
      q.px(x, y, z, r < 0.8 ? K[4] : WHITE);
      q.glow(x, y, z, 3, K[3], 0.22 * tw * nr);
    } else q.at(x, y, z, (pp) => sparkle(pp, 0, 0, 1 + Math.round(tw * 2), K[4], K[3], 0.3 * nr));
  }
  // the arch: points on a tilted great circle, thickest in the middle of the band
  const al = 0.8, ca = Math.cos(al), sa = Math.sin(al);
  for (let i = 0; i < 90; i++) {
    const u = 0.12 + (Math.PI - 0.24) * rand(S, i, 11), w = (rand(S, i, 12) + rand(S, i, 13) - 1) * 0.34;
    const bx = Math.cos(u), by = -Math.sin(u), x = bx * ca + w * sa, z = -bx * sa + w * ca, y = by;
    const l = Math.hypot(x, y, z), X = (x / l) * 108, Y = (y / l) * 108, Z = (z / l) * 108;
    if (Y > -6) continue;
    q.dot(X, Y, Z, K[2], (0.55 - Math.abs(w)) * near(X, Y, Z) * 1.1);
  }
}

// one meteor, age seconds after it lights, as in 2D but along its own line through the dome: a head that
// brightens and burns out, a trail cooling down the ramp, a flare and fragments for the big ones, and a train
function meteor3(q, age, m, i, S, C, glows, heads) {
  const end = m.life + (m.flare ? 0.5 : 0) + TRAIN;
  if (age > end) return;
  const { P0, dir, v, n1, n2 } = m, on = (d) => [P0[0] + dir[0] * d, P0[1] + dir[1] * d, P0[2] + dir[2] * d];
  const burn = Math.min(age, m.life), [hx, hy, hz] = on(v * burn);
  // the train: the whole path it has burned, lingering, widening, drifting and twisting about its line
  const trainK = age < m.life ? 1 : 1 - (age - m.life) / (TRAIN + (m.flare ? 0.5 : 0));
  if (trainK > 0) {
    const len = v * burn;
    for (let d = 0; d < len; d += 1) {
      const passed = age - d / v;
      if (passed < 0.08) continue;
      const g = trainK * Math.min(1, (passed - 0.08) * 4) * (0.35 + 0.65 * Math.sin((Math.PI * d) / len)) * m.s, ph = d * 0.09 + passed * 1.7, am = Math.min(4, passed * 3);
      const [x, y, z] = on(d), tx = x + n1[0] * Math.sin(ph) * am + n2[0] * Math.cos(ph) * am * 0.8 + passed * 3.2, ty = y + n1[1] * Math.sin(ph) * am + n2[1] * Math.cos(ph) * am * 0.8, tz = z + n1[2] * Math.sin(ph) * am + n2[2] * Math.cos(ph) * am * 0.8 + passed * 2.4;
      q.dot(tx, ty, tz, passed < 0.9 ? C[2] : C[1], Math.min(1, g * 1.05));
      if (d % 6 === 0) glows.push([tx, ty, tz, 6 + passed * 4, C[1], 0.12 * g]);
    }
  }
  if (age > m.life + (m.flare ? 0.5 : 0)) return;
  // the head brightens fast, holds, and burns out; the big ones flare as they go
  const u = age / m.life, k = age < m.life ? Math.min(1, u * 6) * (u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1) : 0;
  if (k > 0) {
    const L = Math.min((24 + 40 * m.s) * Math.min(1, u * 3), v * burn + 2), tail = [hx - dir[0] * L, hy - dir[1] * L, hz - dir[2] * L];
    q.line(...tail, hx, hy, hz, (w) => { const d = 1 - w; return d < 0.08 ? WHITE : at(C.slice(1).reverse(), d * 0.95); }, (w) => k * (1 - w < 0.6 ? 1 : w / 0.4));
    if (m.s > 0.9) {
      const o = 0.9, a = [hx - dir[0] * L * 0.4 + n1[0] * o, hy - dir[1] * L * 0.4 + n1[1] * o, hz - dir[2] * L * 0.4 + n1[2] * o];
      q.line(...a, hx + n1[0] * o, hy + n1[1] * o, hz + n1[2] * o, (w) => ((1 - w) * 0.4 < 0.15 ? C[4] : C[3]), (w) => k * w);
    }
    // a thick hot core on the head's first stretch, and light all along the streak
    const cl = L * 0.4;
    q.beam(hx - dir[0] * cl, hy - dir[1] * cl, hz - dir[2] * cl, hx, hy, hz, 1 + 0.7 * m.s, (w, a) => (w > 0.55 && a < 0.5 ? WHITE : C[4]), (w) => k * (0.3 + 0.7 * w));
    q.glowLine(...tail, hx, hy, hz, 5 + 4 * m.s, C[3], 0.2 * k);
    q.at(hx, hy, hz, (pp) => {
      pp.px(0, 0, WHITE);
      if (m.s > 0.9) (pp.px(1, 0, WHITE), pp.px(0, 1, C[4]));
    });
    glows.push([hx, hy, hz, 8 + 10 * m.s, C[4], 0.45 * k], [hx - dir[0] * L * 0.3, hy - dir[1] * L * 0.3, hz - dir[2] * L * 0.3, 10 + 8 * m.s, C[3], 0.2 * k]);
    heads.push([hx, hz, k]);
  }
  if (!m.flare || age < m.life * 0.82) return;
  // the flare: a burst of light and rays, fragments carrying on and fading
  const f = (age - m.life * 0.82) / (m.life * 0.18 + 0.5), [fx, fy, fz] = on(v * m.life * 0.86);
  if (f < 0.35) {
    q.at(fx, fy, fz, (pp) => sparkle(pp, 0, 0, 9 * Math.sin((Math.PI * f) / 0.35) + 2, C[4], C[3], 0.6));
    glows.push([fx, fy, fz, 40, C[3], 0.5 * (1 - f / 0.35)]);
  }
  // little stars scattered round the burst in every direction, each twinkling once and gone
  for (let j = 0; j < 7; j++) {
    const ang = rand(S, i, j, 5) * TAU, cz = rand(S, i, j, 8) * 2 - 1, sz = Math.sqrt(1 - cz * cz), r = 5 + rand(S, i, j, 6) * 16, d0 = rand(S, i, j, 7) * 0.3, g = (f - d0) / 0.45;
    if (g <= 0 || g >= 1) continue;
    const rr = r * (0.6 + g * 0.5), sx = fx + Math.cos(ang) * sz * rr, sy = fy + cz * rr - g * 3, sz3 = fz + Math.sin(ang) * sz * rr, arm = Math.round(2.5 * Math.sin(Math.PI * g));
    if (arm >= 1) q.at(sx, sy, sz3, (pp) => sparkle(pp, 0, 0, arm, j % 3 ? C[4] : WHITE, C[3], 0.3 * (1 - g)));
    else q.px(sx, sy, sz3, C[4]);
  }
  for (let j = 0; j < 4; j++) {
    const ph = rand(S, i, j, 3) * TAU, am = 0.1 + 0.35 * rand(S, i, j, 1), fd = unit([dir[0] + (n1[0] * Math.cos(ph) + n2[0] * Math.sin(ph)) * am, dir[1] + (n1[1] * Math.cos(ph) + n2[1] * Math.sin(ph)) * am, dir[2] + (n1[2] * Math.cos(ph) + n2[2] * Math.sin(ph)) * am]);
    const sp = v * (0.5 + rand(S, i, j, 2) * 0.4), tt = f * (m.life * 0.18 + 0.5), g = 1 - f;
    if (g <= 0) continue;
    const x = fx + fd[0] * sp * tt, y = fy + fd[1] * sp * tt, z = fz + fd[2] * sp * tt;
    if (y > -1 || Math.hypot(x, z) > SR) continue; // spent on the floor, or gone past the dome
    q.line(x - fd[0] * 5 * g, y - fd[1] * 5 * g, z - fd[2] * 5 * g, x, y, z, C[3], g);
    q.at(x, y, z, (pp) => pp.px(0, 0, g > 0.5 ? WHITE : C[4]));
    glows.push([x, y, z, 5, C[3], 0.35 * g]);
  }
}
