// The stream's build (a white core banded out to darker edges, surges running along it, light down its length, a
// flare where it leaves the source) follows Sprite Fusion's open-source energy beam
// (https://www.spritefusion.com/pixel-art-vfx/energy), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, cycle, tileNoise, clamp, smooth, space, TAU, WHITE } from "../../core/index.js";
import { WATER, bead } from "./_lib.js";

export const meta = {
  name: "Water jet",
  desc: "A pressurised stream blasts right: a tight glassy rod with surges running down it that swells, roughens, bends under its weight and breaks into chunks, spray and mist.",
  tags: ["water", "jet", "stream", "hose", "spray", "directional", "loop"],
  size: [188, 80],
  origin: [14, 32],
  duration: 1,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: WATER, length: 118, seed: 3 },
};

const D = meta.duration, G = 520, SPEED = 260;

// the stream's centre line drops as it goes, and how thick it is there
const drop = (x, L) => (x / L) ** 2 * 9;
const thick = (x, L) => 2.6 + 5.4 * Math.pow(x / L, 1.1);

export function draw(p, t, o) {
  const C = fit(o.palette, 8), ph = t / D, L = o.length, S = o.seed, T = ph * TAU;
  // the stream, column by column: white down its core, banded out to blue edges, shadowed underneath; streaks race
  // along it and surges bulge through; past halfway it roughens, and its far end tears into chunks with gaps
  for (let X = 0; X <= L + 3; X++) {
    const x = X + 0.5, u = x / L;
    if (u > 1) break;
    const yc = drop(x, L), rough = smooth(0.25, 1, u), sd = ((((x - ph * SPEED * 2) % 130) + 130) % 130) - 65;
    const w0 = thick(x, L) + Math.exp(-(sd * sd) / 90) * 1.4 * (1 - u * 0.5);
    const up = w0 + tileNoise(x * 0.18 - ph * 30, 9, 30, 0, S + 1) * 2.2 * rough, dn = w0 + tileNoise(x * 0.18 - ph * 30, 3, 30, 0, S + 1) * 2.2 * rough;
    for (let Y = Math.floor(yc - up); Y <= Math.ceil(yc + dn); Y++) {
      const y = Y + 0.5, q = (y - yc) / Math.max(0.8, y < yc ? up : dn), aq = Math.abs(q);
      if (aq > 1) continue;
      if (u > 0.55 && tileNoise(x * 0.12 - ph * 25, (y - yc) * 0.25, 25, 0, S + 2) < -0.9 + 1.6 * smooth(0.55, 1, u)) continue;
      const streak = tileNoise(x * 0.06 - ph * 40, Math.floor(y - yc + 20) * 1.7, 40, 0, S);
      let lvl = aq < 0.2 ? 0 : aq < 0.48 ? 1 : aq < 0.78 ? 2 : 3;
      if (streak > 0.35) lvl = Math.max(0, lvl - 1);
      if (q > 0.4) lvl = Math.min(3, lvl + 1);
      p.px(X, Y, [WHITE, C[6], C[5], C[4]][lvl]);
      if (lvl === 0) p.light(x, y, C[5], 0.12);
    }
  }
  // the nozzle flare: a white burst where it leaves, ringed with light
  const fl = 0.85 + 0.15 * Math.sin(T * 6);
  p.circle(0, 0, 4.4 * fl, C[5]);
  p.circle(0, 0, 3.4 * fl, C[6]);
  p.circle(0, 0, 2.2 * fl, WHITE);
  for (let a = 0; a < TAU; a += 0.35) p.dot(Math.cos(a + T * 2) * 5.2 * fl, Math.sin(a + T * 2) * 5.2 * fl, C[5], 0.6);
  p.glow(0, 0, 24, C[5], 0.6 * fl);
  p.glow(0, 0, 8, WHITE, 0.4 * fl);
  // where it pinches apart: beads strung out along the end of the stream, racing on
  for (let k = 0; k < 6; k++) {
    const x = L * 0.82 + ((k * 13 + ph * SPEED) % 78), y = drop(Math.min(x, L), L) + (x > L ? ((x - L) / 60) ** 2 * 10 : 0) + Math.sin(k * 2.1) * 1.5;
    if (x < L + 34) bead(p, x, y, SPEED, 40, k % 3 === 0 ? 3 : 2, C);
  }
  // spray: a widening cone of drops shed from the stream and torn off its end, arcing down
  cycle(t, D, 70, S + 3, (g) => g.range(0.2, 0.42), (age, life, r) => {
    const f = Math.sqrt(r.next()), x0 = L * (0.3 + 0.7 * f), y0 = drop(x0, L) + r.range(-1, 1) * thick(x0, L);
    const vx = r.range(150, 270) * (0.55 + 0.45 * f), vy = r.range(-1, 1) * 110 * f + r.range(-10, 20);
    const x = x0 + vx * age, y = y0 + vy * age + 0.5 * G * age * age, k = age / life;
    if (x > L + 50 || y > 40 || y < -28 || (k > 0.75 && r.next() < (k - 0.75) * 4)) return;
    if (r.next() < 0.45) p.px(x, y, k < 0.5 ? WHITE : C[6]);
    else bead(p, x, y, vx, vy + G * age, r.next() < 0.2 ? 2 : 1, C);
  });
  // mist blooming off the end
  cycle(t, D, 12, S + 4, (g) => g.range(0.7, 1), (age, life, r) => {
    const k = age / life, x = L * r.range(0.7, 1) + age * r.range(20, 45), y = drop(Math.min(x, L), L) + r.range(-5, 5) + age * r.range(4, 14);
    const rad = r.range(3, 5) + k * r.range(5, 9), a = r.range(0.1, 0.18) * Math.min(1, k / 0.15) * Math.pow(1 - k, 1.5);
    p.disc(x, y, rad, C[6], (d) => a * (1 - d * d));
  });
  // light: down the core, brightest near the nozzle
  for (let x = 0; x < L; x += 10) p.glow(x, drop(x, L), 14 + x * 0.1, C[4], 0.26 * (1 - (x / L) * 0.5));
  p.glow(L * 0.9, drop(L * 0.9, L), 26, C[5], 0.22);
}

// 3D: the stream is a tube in space. Its centre line droops under its weight (a real drop in y); a white core runs
// down the middle of a banded blue shell (sampled all the way round, so head on it is a ring of blue round a white
// disc), surges swell it, it roughens and tears into chunks at the far end. The spray is a cone shed all round the
// axis (spread in y and z, gravity pulling y), beads string out past the end, the flare is a ring across the nozzle.
export const three = {
  meta: { size: [352, 152], origin: [176, 72], camera: { pitch: 0.22 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), ph = t / D, L = o.length, S = o.seed, T = ph * TAU;
    const shell = [C[5], C[4], C[3]];
    // the core: white, banded to a pale edge, streaks racing along it; it parts where the stream tears
    for (let X = 0; X < L; X += 2) {
      const x = X + 1.3, u = x / L, rough = smooth(0.25, 1, u), sd = ((((x - ph * SPEED * 2) % 130) + 130) % 130) - 65;
      const w0 = thick(x, L) + Math.exp(-(sd * sd) / 90) * 1.4 * (1 - u * 0.5), rc = 0.62 * Math.max(1.4, w0 - 2.2 * rough);
      if (u > 0.55 && tileNoise(x * 0.12 - ph * 25, 0, 25, 0, S + 2) < -0.9 + 1.6 * smooth(0.55, 1, u)) continue;
      q.beam(X, drop(X, L), 0, X + 2.7, drop(X + 2.7, L), 0, rc * 2, (g, v) => (v < 0.5 || tileNoise((X + g * 2.7) * 0.06 - ph * 40, 3, 40, 0, S) > 0.35 ? WHITE : C[6]));
    }
    // the shell, column by column, all the way round: banded by how side-on it faces the camera (the part facing
    // it is the core showing through), shadowed underneath, brighter in the surge and in the streaks
    for (let X = 0; X <= L; X++) {
      const x = X + 0.5, u = x / L, rough = smooth(0.25, 1, u), yc = drop(x, L), sd = ((((x - ph * SPEED * 2) % 130) + 130) % 130) - 65, surge = Math.exp(-(sd * sd) / 90);
      const w0 = thick(x, L) + surge * 1.4 * (1 - u * 0.5), rc = 0.62 * Math.max(1.4, w0 - 2.2 * rough), gap = -0.9 + 1.6 * smooth(0.55, 1, u);
      const n = Math.ceil(TAU * (w0 + 2) * 1.25);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + X * 0.37, sa = Math.sin(a), ca = Math.cos(a);
        const R = Math.max(1.4, w0 + tileNoise(x * 0.18 - ph * 30, 3 + 2.5 * sa + 1.5 * ca, 30, 0, S + 1) * 2.2 * rough);
        const [vr, vd] = q.view(0, sa, ca), off = R * Math.hypot(vr, vd);
        if (off < rc) continue;
        if (u > 0.55 && tileNoise(x * 0.12 - ph * 25, (sa * 0.25 + ca * 0.18) * R, 25, 0, S + 2) < gap) continue;
        const aq = off / R, streak = tileNoise(x * 0.06 - ph * 40, Math.floor(a * 3) * 1.7, 40, 0, S);
        let lvl = aq < 0.78 ? 0 : 1;
        if (streak > 0.35 || surge > 0.55) lvl = Math.max(0, lvl - 1);
        if (sa > 0.4) lvl = Math.min(2, lvl + 1);
        q.px(x, yc + sa * R, ca * R, shell[lvl]);
      }
    }
    // the nozzle flare: a white burst where it leaves, a ring of dots round the axis across the nozzle
    const fl = 0.85 + 0.15 * Math.sin(T * 6);
    q.at(0, 0, 0, (pp, k) => {
      pp.z -= 2;
      pp.circle(0, 0, 4.4 * fl * k, C[5]);
      pp.circle(0, 0, 3.4 * fl * k, C[6]);
      pp.circle(0, 0, 2.2 * fl * k, WHITE);
    });
    for (let a = 0; a < TAU; a += 0.35) q.dot(-1, Math.sin(a + T * 2) * 5.2 * fl, Math.cos(a + T * 2) * 5.2 * fl, C[5], 0.6);
    // where it pinches apart: beads strung out along the end of the stream, racing on
    for (let k = 0; k < 6; k++) {
      const x = L * 0.82 + ((k * 13 + ph * SPEED) % 78), y = drop(Math.min(x, L), L) + (x > L ? ((x - L) / 60) ** 2 * 10 : 0) + Math.sin(k * 2.1) * 1.5;
      if (x >= L + 34) continue;
      const [wx, wy] = q.view(SPEED, 40, 0);
      q.at(x, y, Math.cos(k * 2.9) * 1.5, (pp) => bead(pp, 0, 0, wx, wy, k % 3 === 0 ? 3 : 2, C));
    }
    // spray: a cone of drops shed from the stream and torn off its end, thrown out all round the axis, arcing down
    cycle(t, D, 120, S + 3, (g) => g.range(0.2, 0.42), (age, life, r) => {
      const f = Math.sqrt(r.next()), x0 = L * (0.3 + 0.7 * f), a = r.range(0, TAU), m = r.range(0.25, 1) * 110 * f, tk = thick(x0, L) * 0.9;
      const vx = r.range(150, 270) * (0.55 + 0.45 * f), vy = Math.sin(a) * m + r.range(-10, 20), vz = Math.cos(a) * m;
      const x = x0 + vx * age, y = drop(x0, L) + Math.sin(a) * tk + vy * age + 0.5 * G * age * age, z = Math.cos(a) * tk + vz * age, k = age / life;
      if (x > L + 50 || y > 40 || y < -28 || Math.abs(z) > 52 || (k > 0.75 && r.next() < (k - 0.75) * 4)) return;
      if (r.next() < 0.45) q.px(x, y, z, k < 0.5 ? WHITE : C[6]);
      else {
        const [wx, wy] = q.view(vx, vy + G * age, vz);
        q.at(x, y, z, (pp) => bead(pp, 0, 0, wx, wy, r.next() < 0.2 ? 2 : 1, C));
      }
    });
    // light: down the core, brightest near the nozzle
    q.glow(0, 0, 0, 24, C[5], 0.6 * fl);
    q.glow(0, 0, 0, 8, WHITE, 0.4 * fl);
    for (let x = 0; x < L; x += 10) q.glow(x, drop(x, L), 0, 14 + x * 0.1, C[4], 0.26 * (1 - (x / L) * 0.5));
    q.glow(L * 0.9, drop(L * 0.9, L), 0, 26, C[5], 0.22);
    // mist blooming off the end, far to near
    const puffs = [];
    cycle(t, D, 18, S + 4, (g) => g.range(0.7, 1), (age, life, r) => {
      const k = age / life, x = L * r.range(0.7, 1) + age * r.range(20, 45);
      puffs.push([x, drop(Math.min(x, L), L) + r.range(-5, 5) + age * r.range(4, 14), r.range(-5, 5) + age * r.range(-14, 14), r.range(3, 5) + k * r.range(5, 9), r.range(0.1, 0.18) * Math.min(1, k / 0.15) * Math.pow(1 - k, 1.5)]);
    });
    for (const [x, y, z, rad, a] of q.sort(puffs, (m) => m)) q.at(x, y, z, (pp, k) => pp.disc(0, 0, rad * k, C[6], (d) => a * (1 - d * d)));
  },
};
