// The blast recipe (fire puffs that cool into smoke, sparks, embers, burning brands, grit, rocks, scorch, rings) is
// adapted from Sprite Fusion's open-source explosion (https://www.spritefusion.com/pixel-art-vfx/explosion),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, Blazes, P, PF, B, Rng, fit, band, flare, smooth, ease, TAU, WHITE, hex, mix, space } from "../../core/index.js";
import { stone, fireRamp, heatRamp, drawPs, draft, cull, scorch, rock, dome, glowDome, pool, trail, Plume, Column, drawPs3, rocks3, trail3, scorch3, pool3, dome3, shell3 } from "./_lib.js";

export const meta = {
  name: "Big explosion",
  desc: "A huge ground blast in three beats: a white dome, a rolling fireball that climbs into a mushrooming smoke column, heavy rocks, and fires left burning.",
  tags: ["explosion", "fire", "smoke", "debris", "mushroom", "big", "ground", "one-shot"],
  size: [360, 300],
  origin: [180, 262],
  duration: 7.2,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"], stone: "#4a3f69", seed: 11 },
};

const RAD = 30, POWER = 1.45, EARTH = 1.6;
// the plume's smoke, lit on top to sooty underneath
const SM = ["#83777f", "#6e6470", "#575060", "#3f3947", "#29242f"].map(hex);
// three detonations, a beat apart, climbing as they go
const BLASTS = [
  { t: 0, x: 0, y: -9, rad: RAD, power: POWER, main: true },
  { t: 0.13, x: -17, y: -30, rad: 17, power: 0.9 },
  { t: 0.25, x: 15, y: -46, rad: 15, power: 0.8 },
];

export function create(o) {
  const F = fit(o.palette, 8), FR = fireRamp(F), HR = heatRamp(FR), st = stone(o.stone), R = new Rng(o.seed), floor = () => 0, WARM = mix(F[3], F[6], 0.45);
  const [W, H] = meta.size, [OX, OY] = meta.origin, X0 = -OX + 3, X1 = W - OX - 3, Y0 = -OY + 3, Y1 = H - OY - 3;
  let blazes;
  const ps = new Particles({ rng: R, ground: floor, sparks: [F[6], F[5], F[3], F[2]], onLand: (x, y) => blazes.add(x, y - 0.25, R.range(3, 4.4), R.range(0.7, 1.25)) });
  blazes = new Blazes(ps);
  const rocks = new Bits({ ground: floor }), lights = new Lights(), flashes = [], rings = [];
  const plume = new Plume(R, {
    x: 0, y: -34, rise: 118, tau: 1.25, drift: 4, tube: [9, 21], ring: [2, 19], grow: 1.0, n: 42, size: [6, 11], swell: 0.9,
    spin: 2.6, spinTau: 1.7, heat: 1.2, cool: 0.42, under: 0.5, tilt: 0.22, squash: 0.72, fade: [4.4, 6.4], spread: 22,
  });
  const column = new Column(R, { w: 5, foot: 18, speed: 85, size: [7, 11], n: 28, sway: 2.5 });
  const top = () => { const S = plume.shape(); return S.y + S.tube * 0.45; };
  let t = 0, next = 0;

  const blast = ({ x, y, rad, power, main }) => {
    // the later beats flash and ring in the air; the first is a dome on the floor (drawn from t)
    if (!main) flashes.push({ x, y, r: rad * 1.05, life: 0.06, max: 0.06 });
    if (!main) rings.push({ x, y, r0: rad * 0.45, r1: rad * 2.7, life: 0.36, max: 0.36, thick: 3, c: F[5] }, { x, y, r0: rad * 0.3, r1: rad * 1.6, life: 0.24, max: 0.24, thick: 1.8, c: F[3] });
    // light: a big warm flare (raised for a ground blast, so it lights the air and the floor gets a pool)
    lights.add(x, main ? y - 24 : y, main ? 72 : rad * 3.4, WARM, 0.6 * power, 0.8);
    lights.add(x, main ? y - 12 : y, main ? 44 : rad * 1.6, WHITE, 0.6, 0.1);
    const down = main ? 0.25 : Math.PI; // a ground blast throws nothing into the floor
    for (let i = 0; i < 5; i++) ps.spawn(P.FIRE, x + R.range(-2.5, 2.5), y + R.range(-2.5, 2.5), R.range(-20, 20), R.range(-40, -10), R.range(0.18, 0.3), 0, R.range(rad * 0.4, rad * 0.55));
    for (let i = 0; i < Math.round(26 * power); i++) {
      const a = main ? R.range(-Math.PI - down, down) : R.range(0, TAU), d = R.range(0, rad * 0.55), sp = R.range(40, 200) * power;
      ps.spawn(P.FIRE, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.cos(a) * sp, Math.sin(a) * sp * 0.8 - 40, R.range(0.55, 1.15), 0, R.range(rad * 0.22, rad * 0.46), 0, R.chance(0.45) ? PF.SMOKES | PF.BIG : 0);
    }
    for (let i = 0; i < 5; i++) {
      const a = R.range(-Math.PI, 0), d = R.range(rad * 0.1, rad * 0.5);
      ps.spawn(P.SMOKE, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.cos(a) * 30, Math.sin(a) * 20 - 30, R.range(0.9, 1.5), hex("#221d26"), R.range(rad * 0.15, rad * 0.26), R.range(0.06, 0.2), PF.BIG);
    }
    for (let i = 0; i < Math.round(8 * power); i++) {
      const a = R.range(-Math.PI, 0), d = R.range(0, rad * 0.7), sp = R.range(15, 90);
      ps.spawn(P.SMOKE, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.cos(a) * sp, Math.sin(a) * sp * 0.6 - 35, R.range(1.8, 2.8), 0, R.range(rad * 0.26, rad * 0.4), R.range(0.12, 0.45), PF.BIG);
    }
    for (let i = 0; i < Math.round(80 * power); i++) {
      const a = R.range(0, TAU), sp = R.range(170, main ? 470 : 380);
      ps.spawn(P.SPARK, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 70, R.range(0.2, 0.65));
    }
    for (let i = 0; i < Math.round(30 * power); i++) {
      const a = R.range(0, TAU), sp = R.range(30, 150);
      ps.spawn(P.EMBER, x + Math.cos(a) * rad * 0.4, y + Math.sin(a) * rad * 0.4, Math.cos(a) * sp, Math.sin(a) * sp - 75, R.range(1.4, 3), F[3]);
    }
    if (!main) return;
    // burning brands that land and keep the ground on fire
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI / 2 + R.range(-1.3, 1.3), sp = R.range(160, 340);
      ps.spawn(P.BRAND, x, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.8, 1.5));
    }
    // the ground's part: dust rolling out along the floor, a dust column, grit and heavy rocks thrown up
    for (let i = 0; i < 18; i++) {
      const s = R.sign();
      ps.spawn(P.SMOKE, s * R.range(0, RAD * 0.6), -R.range(1, 6), s * R.range(3, 9) * RAD, -R.range(2, 15), R.range(1.3, 2.2), st.dust, R.range(8, 12), R.range(0, 0.06), PF.BIG);
    }
    for (let i = 0; i < Math.round(EARTH * 12); i++)
      ps.spawn(P.SMOKE, R.range(-0.3, 0.3) * RAD, -R.range(2, RAD * 0.6), R.range(-15, 15), -R.range(60, 190) * EARTH * 0.6, R.range(1.6, 2.6), st.dust, R.range(8, 12), R.range(0, 0.15), PF.BIG);
    for (let i = 0; i < Math.round(EARTH * RAD * 4); i++) {
      const u = R.range(-1, 1), a = -Math.PI / 2 + u * 0.55, sp = R.range(5, 15) * RAD * (1 - 0.45 * Math.abs(u));
      ps.spawn(P.GRIT, u * 0.25 * RAD, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1.4, 2.4), R.pick([st.light, st.body, st.body, st.shade]), R.chance(0.45) ? 2 : 1);
    }
    for (let i = 0; i < 26; i++) {
      const big = i < 10, hot = R.chance(0.45), sx = R.sign();
      rocks.add({ kind: B.CHUNK, x: R.range(-0.4, 0.4) * RAD, y: -4, vx: sx * R.range(30, big ? 120 : 150), vy: -R.range(big ? 280 : 320, big ? 480 : 560), g: 1, drag: 0.3, bounce: 0.3, life: R.range(3.6, 5), a: R.range(0, TAU), va: R.range(-14, 14), s: big ? R.range(2.6, 3.8) : R.range(1.2, 2.4), heat: hot ? R.range(0.6, 1) : 0 });
    }
  };

  return {
    update(dt) {
      t += dt;
      while (next < BLASTS.length && t >= BLASTS[next].t) blast(BLASTS[next++]);
      if (t > 0.08) plume.update(dt);
      const S = plume.shape(), k = 1 - smooth(2.2, 3.1, t);
      // the column: smoke and fire boil up off the floor into the fireball, dust is drawn in along the ground
      if (t > 0.2 && t < 3.1) {
        if (R.chance(8 * k * dt)) ps.spawn(P.SMOKE, R.range(-10, 10), -R.range(1, 6), R.range(-8, 8), -R.range(40, 80), R.range(1.5, 2.3), st.dust, R.range(5, 8), 0, PF.BIG);
        if (t < 1.5 && R.chance(16 * dt)) ps.spawn(P.FIRE, R.range(-6, 6), -R.range(4, 14), R.range(-10, 10), -R.range(90, 150), R.range(0.5, 0.8), 0, R.range(4, 7.5), 0, R.chance(0.5) ? PF.SMOKES | PF.BIG : 0);
        if (t > 0.45 && R.chance(12 * k * dt)) {
          const s = R.sign();
          ps.spawn(P.SMOKE, s * R.range(40, 120), -R.range(1, 4), -s * R.range(10, 30), -R.range(0, 5), R.range(1.3, 1.9), st.dust, R.range(3.5, 5.5), 0, PF.BIG);
        }
      }
      // the fireball sheds embers, then ash drifts down out of the cloud
      if (t > 0.3 && t < 3 && R.chance(10 * plume.hot() * dt)) {
        const a = R.range(0, TAU);
        ps.spawn(P.EMBER, S.x + Math.cos(a) * (S.ring + S.tube), S.y + Math.sin(a) * S.tube * 0.5, Math.cos(a) * R.range(40, 90), -R.range(10, 60), R.range(1.2, 2.4), F[3]);
      }
      if (t > 1.4 && t < 4.6 && R.chance(7 * dt)) ps.spawn(P.FLAKE, S.x + R.range(-1, 1) * (S.ring + S.tube), S.y + S.tube * 0.6, R.range(-6, 6), R.range(0, 10), R.range(2, 3), R.pick([SM[1], SM[2], F[2]]), R.range(0.6, 1.2));
      column.update(dt, top(), t > 0.22 && t < 2.5 ? 1 : 0);
      draft(ps, dt, { x: 0, top: S.y + S.tube * 0.4, w: 9 + 7 * Math.min(1, t), up: 170, pull: 130, low: 12, reach: 130, k: 1 - smooth(2.5, 3.8, t) });
      for (const a of [flashes, rings]) for (let i = a.length - 1; i >= 0; i--) if ((a[i].life -= dt) <= 0) a.splice(i, 1);
      // rocks: molten ones cool and trail smoke and flame; every hard landing kicks up dust
      for (const b of rocks.list) b.pvy = b.vy;
      rocks.update(dt);
      for (let i = rocks.list.length - 1; i >= 0; i--) {
        const b = rocks.list[i];
        if (b.x < X0 + 4 || b.x > X1 - 4) {
          rocks.list.splice(i, 1);
          continue;
        }
        if (b.heat > 0) {
          b.heat = Math.max(0, b.heat - dt * 0.3);
          if (!b.rest && b.heat > 0.25) {
            (b.pts ??= []).push({ x: b.x, y: b.y, t });
            if (R.chance(14 * dt)) ps.spawn(P.FIRE, b.x, b.y, b.vx * 0.1, b.vy * 0.1 - 8, R.range(0.16, 0.3), 0, R.range(1.2, 2.2));
          } else if (b.rest && R.chance(3 * b.heat * dt)) ps.spawn(P.SMOKE, b.x, b.y - 1, R.range(-3, 3), -R.range(5, 12), R.range(0.8, 1.4), 0, R.range(1.6, 2.6));
        }
        const landed = (b.pvy > 0 && b.vy <= 0) || (b.rest && !b.dusted);
        if (landed && b.pvy > 60) {
          for (let j = 0; j < 2 + Math.round(b.s); j++) ps.spawn(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, R.sign() * R.range(10, 50), -R.range(2, 20), R.range(0.3, 0.7), st.dust, R.range(1.3, 1 + b.s));
          if (b.heat > 0.5 && !b.dusted) blazes.add(b.x, -0.25, R.range(1.2, 2.2), 0.45);
        }
        if (b.rest) b.dusted = true;
        if (b.pts) while (b.pts.length && t - b.pts[0].t > 0.45) b.pts.shift();
      }
      blazes.update(dt);
      ps.update(dt);
      cull(ps, X0, Y0, X1, Y1);
      lights.update(dt);
    },
    drawBack(p) {
      scorch(p, HR, t, 52, 3.4, 1 - smooth(meta.duration - 1.6, meta.duration - 0.3, t), 3);
      const k = t / 0.6;
      if (k < 1) band(p, 0, 0.5, 132 * ease.outCubic(k), 0.16, Math.max(1, 6 * (1 - k)), 1.15 - k, [st.body, st.light, F[3], F[6]], (g) => Math.sin(g) < 0);
      drawPs(p, ps, "back", FR);
      column.draw(p, top(), FR, SM, 1 - t / 1.4, plume.hot());
      plume.draw(p, FR, SM);
      blazes.drawBack(p);
    },
    draw(p) {
      const k = t / 0.6;
      if (k < 1) band(p, 0, 0.5, 132 * ease.outCubic(k), 0.16, Math.max(1, 6 * (1 - k)), 1.15 - k, [st.body, st.light, F[3], F[6]], (g) => Math.sin(g) >= 0);
      // the first beat: a white hero frame, a dome of white-hot air that cools into the fire, a flare, a shell of light
      if (t < 0.04) {
        dome(p, F, 0, 44, 1);
        p.glow(0, -30, 68, WHITE, 0.6);
      } else if (t < 0.11) dome(p, F, 0, 38 - (t - 0.04) * 120, 1 - (t - 0.04) / 0.07);
      for (const b of rocks.list) {
        if (b.pts) trail(p, b.pts, t, FR, SM, 0.45, 0.6 + b.s * 0.3, b.heat);
        rock(p, b, st, FR);
      }
      drawPs(p, ps, "front", FR);
      if (t < 0.24) flare(p, 0, -14, 70 * Math.pow(1 - t / 0.24, 1.4), 1 - t / 0.24, F);
      if (t < 0.5) {
        const u = t / 0.5, r = 34 + 80 * ease.outCubic(u);
        p.ring(0, 0, r, Math.max(1, 3 * (1 - u) + 0.5), u < 0.3 ? F[6] : u < 0.6 ? F[5] : F[3], (v, a) => (Math.sin(a) > 0 ? 0 : Math.min(1, (1 - u) * 1.6)));
        glowDome(p, 0, 0, r, 6, F[4], 0.35 * (1 - u));
      }
      for (const f of flashes) {
        const k2 = f.life / f.max, r = f.r * (0.8 + 0.2 * k2);
        p.circle(f.x, f.y, r + 1.2, F[2]);
        p.circle(f.x, f.y, r, k2 > 0.45 ? F[6] : F[5]);
        p.circle(f.x, f.y, r * 0.6, k2 > 0.45 ? WHITE : F[6]);
      }
      for (const r of rings) {
        const k2 = r.life / r.max, e = 1 - Math.pow(k2, 3);
        p.ring(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, Math.max(1, r.thick * k2 + 0.4), r.c, Math.min(1, k2 * 1.6));
      }
      // the fireball lights the floor under it while it burns
      const hot = plume.hot(), flash = Math.max(0, 1 - t / 0.9);
      pool(p, 0, 1, 150, 22, F[3], 0.24 * hot + 0.5 * flash * flash);
      lights.draw(p);
    },
  };
}

// ---- 3D: the same blast standing in space. The plume is a torus of lobes rolling round the vertical axis, the stem a
// column of lobes, and everything the 2D blast sends left and right goes out round the full circle: sparks, fire, smoke,
// brands, grit, rocks, a dust surge and a shock ring that run across the floor as true circles, an air shock that is a
// sphere's silhouette. The two later detonations burst at their own x, y and z round the axis.
const PITCH = 0.28, SIZE3 = [380, 300], ORIGIN3 = [190, 244];
const RMAX = 172, TOP3 = ORIGIN3[1] - 4, SC = Math.sin(PITCH), CC = Math.cos(PITCH);
const WIDE = 1.4; // a full circle takes more of everything than a left and right half
const SOFT3 = new Set([P.SMOKE, P.DUST, P.VAPOUR]), LIFT3 = new Set([P.SMOKE, P.DUST, P.FIRE, P.EMBER, P.VAPOUR]);
const Z3 = [0, 9, -10];
const BLASTS3 = BLASTS.map((b, i) => ({ ...b, z: Z3[i] }));

// inside the box seen from any side: a floor radius RMAX, and a height that leaves room for the tilt
const inBox3 = (x, y, z, pad = 0) => {
  const r = Math.hypot(x, z);
  return r + pad <= RMAX && -y * CC + r * SC + pad <= TOP3;
};
const cull3 = (list) => {
  for (let i = list.length - 1; i >= 0; i--) if (!inBox3(list[i].x, list[i].y, list[i].z)) list.splice(i, 1);
};
// soft particles thin out as they near the edge of the box (fadeEdges, round the axis)
const fade3 = (ps, w = 30) => {
  const L = ps.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i];
    if (!SOFT3.has(q.k)) continue;
    const r = Math.hypot(q.x, q.z), s = q.size * 1.65, e = Math.min((RMAX - r - s) / w, (TOP3 + q.y * CC - r * SC - s) / 20);
    if (e <= 0) L.splice(i, 1);
    else if (e < 1) q.life = Math.min(q.life, q.max * 0.42 * e);
  }
};
// draft() round the axis: lift and squeeze towards it in x and z, pull in along the floor from afar
const draft3 = (ps, dt, { top, w, up, squeeze = 4, pull, low, reach, k }) => {
  if (k <= 0) return;
  for (const q of ps.list) {
    if (q.delay > 0 || !LIFT3.has(q.k) || q.y < top) continue;
    const ax = Math.hypot(q.x, q.z), u = ax / w;
    if (u < 1) {
      const f = (1 - u * u) * k;
      q.vy -= up * f * dt;
      q.vx -= q.x * squeeze * f * dt;
      q.vz -= q.z * squeeze * f * dt;
    }
    if (pull && q.y > -low && ax > w * 0.4 && ax < reach) {
      const g = (pull * k * (1 - ax / reach) * dt) / ax;
      q.vx -= q.x * g;
      q.vz -= q.z * g;
    }
  }
};

function create3(o) {
  const F = fit(o.palette, 8), FR = fireRamp(F), HR = heatRamp(FR), st = stone(o.stone), R = new Rng(o.seed), floor = () => 0, WARM = mix(F[3], F[6], 0.45);
  let blazes;
  const ps = new Particles({ rng: R, ground: floor, sparks: [F[6], F[5], F[3], F[2]], onLand: (x, y, z) => blazes.add(x, y - 0.25, R.range(3, 4.4), R.range(0.7, 1.25), z) });
  blazes = new Blazes(ps);
  const rocks = new Bits({ ground: floor }), lights = new Lights(), flashes = [], rings = [];
  const plume = new Plume(R, {
    x: 0, y: -34, rise: 118, tau: 1.25, drift: 4, tube: [9, 21], ring: [2, 19], grow: 1.0, n: 42, size: [6, 11], swell: 0.9,
    spin: 2.6, spinTau: 1.7, heat: 1.2, cool: 0.42, under: 0.5, tilt: 0.22, squash: 0.72, fade: [4.4, 6.4], spread: 22,
  });
  const column = new Column(R, { w: 5, foot: 18, speed: 85, size: [7, 11], n: 28, sway: 2.5 });
  const top = () => { const S = plume.shape(); return S.y + S.tube * 0.45; };
  let t = 0, next = 0;
  // a point in the horizontal disc of radius r (uniform), as [x, z]
  const disc = (r) => { const f = R.range(0, TAU), d = r * Math.sqrt(R.next()); return [Math.cos(f) * d, Math.sin(f) * d]; };

  const blast = ({ x, y, z, rad, power, main }) => {
    const N = (n) => Math.round(n * power * WIDE);
    if (!main) flashes.push({ x, y, z, r: rad * 1.05, life: 0.06, max: 0.06 });
    if (!main) rings.push({ x, y, z, r0: rad * 0.45, r1: rad * 2.7, life: 0.36, max: 0.36, thick: 3, c: F[5] }, { x, y, z, r0: rad * 0.3, r1: rad * 1.6, life: 0.24, max: 0.24, thick: 1.8, c: F[3] });
    lights.add(x, main ? y - 24 : y, main ? 72 : rad * 3.4, WARM, 0.6 * power, 0.8, z);
    lights.add(x, main ? y - 12 : y, main ? 44 : rad * 1.6, WHITE, 0.6, 0.1, z);
    const down = main ? 0.25 : Math.PI;
    for (let i = 0; i < 6; i++) ps.spawn3(P.FIRE, x + R.range(-2.5, 2.5), y + R.range(-2.5, 2.5), z + R.range(-2.5, 2.5), R.range(-20, 20), R.range(-40, -10), R.range(-20, 20), R.range(0.18, 0.3), 0, R.range(rad * 0.4, rad * 0.55));
    for (let i = 0; i < N(26); i++) {
      const a = main ? R.range(-Math.PI - down, down) : R.range(0, TAU), f = R.range(0, TAU), ch = Math.abs(Math.cos(a)), sn = Math.sin(a), cf = Math.cos(f) * ch, sf = Math.sin(f) * ch;
      const d = R.range(0, rad * 0.55), sp = R.range(40, 200) * power;
      ps.spawn3(P.FIRE, x + cf * d, y + sn * d, z + sf * d, cf * sp, sn * sp * 0.8 - 40, sf * sp, R.range(0.55, 1.15), 0, R.range(rad * 0.22, rad * 0.46), 0, R.chance(0.45) ? PF.SMOKES | PF.BIG : 0);
    }
    for (let i = 0; i < Math.round(5 * WIDE); i++) {
      const a = R.range(-Math.PI, 0), f = R.range(0, TAU), ch = Math.abs(Math.cos(a)), cf = Math.cos(f) * ch, sf = Math.sin(f) * ch, d = R.range(rad * 0.1, rad * 0.5);
      ps.spawn3(P.SMOKE, x + cf * d, y + Math.sin(a) * d, z + sf * d, cf * 30, Math.sin(a) * 20 - 30, sf * 30, R.range(0.9, 1.5), hex("#221d26"), R.range(rad * 0.15, rad * 0.26), R.range(0.06, 0.2), PF.BIG);
    }
    for (let i = 0; i < Math.round(8 * power * WIDE); i++) {
      const a = R.range(-Math.PI, 0), f = R.range(0, TAU), ch = Math.abs(Math.cos(a)), cf = Math.cos(f) * ch, sf = Math.sin(f) * ch, d = R.range(0, rad * 0.7), sp = R.range(15, 90);
      ps.spawn3(P.SMOKE, x + cf * d, y + Math.sin(a) * d, z + sf * d, cf * sp, Math.sin(a) * sp * 0.6 - 35, sf * sp, R.range(1.8, 2.8), 0, R.range(rad * 0.26, rad * 0.4), R.range(0.12, 0.45), PF.BIG);
    }
    for (let i = 0; i < N(80); i++) {
      const a = R.range(0, TAU), f = R.range(0, TAU), ch = Math.cos(a), sp = R.range(170, main ? 470 : 380);
      ps.spawn3(P.SPARK, x, y, z, Math.cos(f) * ch * sp, Math.sin(a) * sp - 70, Math.sin(f) * ch * sp, R.range(0.2, 0.65));
    }
    for (let i = 0; i < N(30); i++) {
      const a = R.range(0, TAU), f = R.range(0, TAU), ch = Math.cos(a), sp = R.range(30, 150), cf = Math.cos(f) * ch, sf = Math.sin(f) * ch;
      ps.spawn3(P.EMBER, x + cf * rad * 0.4, y + Math.sin(a) * rad * 0.4, z + sf * rad * 0.4, cf * sp, Math.sin(a) * sp - 75, sf * sp, R.range(1.4, 3), F[3]);
    }
    if (!main) return;
    // burning brands that land and keep the ground on fire
    for (let i = 0; i < Math.round(14 * WIDE); i++) {
      const a = -Math.PI / 2 + R.range(-1.3, 1.3), f = R.range(0, TAU), ch = Math.abs(Math.cos(a)), sp = R.range(150, 270);
      ps.spawn3(P.BRAND, x, y, z, Math.cos(f) * ch * sp, Math.sin(a) * sp, Math.sin(f) * ch * sp, R.range(0.8, 1.5));
    }
    // the ground's part: dust surging out along the floor all round, a dust column, grit and heavy rocks thrown up
    for (let i = 0; i < Math.round(18 * 2); i++) {
      const f = R.range(0, TAU), r0 = R.range(0, RAD * 0.6), sp = R.range(3, 8) * RAD;
      ps.spawn3(P.SMOKE, Math.cos(f) * r0, -R.range(1, 6), Math.sin(f) * r0, Math.cos(f) * sp, -R.range(2, 15), Math.sin(f) * sp, R.range(1.3, 2.2), st.dust, R.range(8, 12), R.range(0, 0.06), PF.BIG);
    }
    for (let i = 0; i < Math.round(EARTH * 12); i++) {
      const [dx, dz] = disc(0.3 * RAD);
      ps.spawn3(P.SMOKE, dx, -R.range(2, RAD * 0.6), dz, R.range(-15, 15), -R.range(60, 190) * EARTH * 0.6, R.range(-15, 15), R.range(1.6, 2.6), st.dust, R.range(8, 12), R.range(0, 0.15), PF.BIG);
    }
    for (let i = 0; i < Math.round(EARTH * RAD * 4 * 1.3); i++) {
      const u = R.range(-1, 1), a = -Math.PI / 2 + u * 0.55, f = R.range(0, TAU), sp = R.range(5, 15) * RAD * (1 - 0.45 * Math.abs(u)), ch = Math.abs(Math.cos(a));
      ps.spawn3(P.GRIT, Math.cos(f) * Math.abs(u) * 0.25 * RAD, -1, Math.sin(f) * Math.abs(u) * 0.25 * RAD, Math.cos(f) * ch * sp, Math.sin(a) * sp, Math.sin(f) * ch * sp, R.range(1.4, 2.4), R.pick([st.light, st.body, st.body, st.shade]), R.chance(0.45) ? 2 : 1);
    }
    for (let i = 0; i < 34; i++) {
      const big = i < 13, hot = R.chance(0.45), f = R.range(0, TAU), vh = R.range(30, big ? 120 : 150), [dx, dz] = disc(0.4 * RAD);
      rocks.add({ kind: B.CHUNK, x: dx, y: -4, z: dz, vx: Math.cos(f) * vh, vz: Math.sin(f) * vh, vy: -R.range(big ? 280 : 320, big ? 480 : 560), g: 1, drag: 0.3, bounce: 0.3, life: R.range(3.6, 5), a: R.range(0, TAU), va: R.range(-14, 14), s: big ? R.range(2.6, 3.8) : R.range(1.2, 2.4), heat: hot ? R.range(0.6, 1) : 0 });
    }
  };

  return {
    update(dt) {
      t += dt;
      while (next < BLASTS3.length && t >= BLASTS3[next].t) blast(BLASTS3[next++]);
      if (t > 0.08) plume.update(dt);
      const S = plume.shape(), k = 1 - smooth(2.2, 3.1, t);
      // the column: smoke and fire boil up off the floor into the fireball, dust is drawn in along the ground
      if (t > 0.2 && t < 3.1) {
        if (R.chance(8 * k * dt)) {
          const [dx, dz] = disc(10);
          ps.spawn3(P.SMOKE, dx, -R.range(1, 6), dz, R.range(-8, 8), -R.range(40, 80), R.range(-8, 8), R.range(1.5, 2.3), st.dust, R.range(5, 8), 0, PF.BIG);
        }
        if (t < 1.5 && R.chance(16 * dt)) {
          const [dx, dz] = disc(6);
          ps.spawn3(P.FIRE, dx, -R.range(4, 14), dz, R.range(-10, 10), -R.range(90, 150), R.range(-10, 10), R.range(0.5, 0.8), 0, R.range(4, 7.5), 0, R.chance(0.5) ? PF.SMOKES | PF.BIG : 0);
        }
        if (t > 0.45 && R.chance(12 * k * dt)) {
          const f = R.range(0, TAU), r = R.range(40, 120), v = R.range(10, 30);
          ps.spawn3(P.SMOKE, Math.cos(f) * r, -R.range(1, 4), Math.sin(f) * r, -Math.cos(f) * v, -R.range(0, 5), -Math.sin(f) * v, R.range(1.3, 1.9), st.dust, R.range(3.5, 5.5), 0, PF.BIG);
        }
      }
      // the fireball sheds embers, then ash drifts down out of the cloud
      if (t > 0.3 && t < 3 && R.chance(10 * plume.hot() * dt)) {
        const a = R.range(0, TAU), f = R.range(0, TAU), rho = S.ring + S.tube * Math.cos(a), v = R.range(40, 90) * Math.cos(a);
        ps.spawn3(P.EMBER, S.x + Math.cos(f) * rho, S.y + Math.sin(a) * S.tube * 0.5, Math.sin(f) * rho, Math.cos(f) * v, -R.range(10, 60), Math.sin(f) * v, R.range(1.2, 2.4), F[3]);
      }
      if (t > 1.4 && t < 4.6 && R.chance(7 * dt)) {
        const [dx, dz] = disc(S.ring + S.tube);
        ps.spawn3(P.FLAKE, S.x + dx, S.y + S.tube * 0.6, dz, R.range(-6, 6), R.range(0, 10), R.range(-6, 6), R.range(2, 3), R.pick([SM[1], SM[2], F[2]]), R.range(0.6, 1.2));
      }
      column.update(dt, top(), t > 0.22 && t < 2.5 ? 1 : 0);
      draft3(ps, dt, { top: S.y + S.tube * 0.4, w: 9 + 7 * Math.min(1, t), up: 170, pull: 130, low: 12, reach: 130, k: 1 - smooth(2.5, 3.8, t) });
      for (const a of [flashes, rings]) for (let i = a.length - 1; i >= 0; i--) if ((a[i].life -= dt) <= 0) a.splice(i, 1);
      // rocks: molten ones cool and trail smoke and flame; every hard landing kicks up dust
      for (const b of rocks.list) b.pvy = b.vy;
      rocks.update(dt);
      for (let i = rocks.list.length - 1; i >= 0; i--) {
        const b = rocks.list[i];
        if (!inBox3(b.x, b.y, b.z, 4)) {
          rocks.list.splice(i, 1);
          continue;
        }
        if (b.heat > 0) {
          b.heat = Math.max(0, b.heat - dt * 0.3);
          if (!b.rest && b.heat > 0.25) {
            (b.pts ??= []).push({ x: b.x, y: b.y, z: b.z, t });
            if (R.chance(14 * dt)) ps.spawn3(P.FIRE, b.x, b.y, b.z, b.vx * 0.1, b.vy * 0.1 - 8, b.vz * 0.1, R.range(0.16, 0.3), 0, R.range(1.2, 2.2));
          } else if (b.rest && R.chance(3 * b.heat * dt)) ps.spawn3(P.SMOKE, b.x, b.y - 1, b.z, R.range(-3, 3), -R.range(5, 12), R.range(-3, 3), R.range(0.8, 1.4), 0, R.range(1.6, 2.6));
        }
        const landed = (b.pvy > 0 && b.vy <= 0) || (b.rest && !b.dusted);
        if (landed && b.pvy > 60) {
          for (let j = 0; j < 2 + Math.round(b.s); j++) {
            const f = R.range(0, TAU), v = R.range(10, 50);
            ps.spawn3(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, b.z + R.range(-1.5, 1.5), Math.cos(f) * v, -R.range(2, 20), Math.sin(f) * v, R.range(0.3, 0.7), st.dust, R.range(1.3, 1 + b.s));
          }
          if (b.heat > 0.5 && !b.dusted) blazes.add(b.x, -0.25, R.range(1.2, 2.2), 0.45, b.z);
        }
        if (b.rest) b.dusted = true;
        if (b.pts) while (b.pts.length && t - b.pts[0].t > 0.45) b.pts.shift();
      }
      blazes.update(dt);
      ps.update(dt);
      cull3(ps.list);
      fade3(ps);
      lights.update(dt);
    },
    draw(p) {
      const q = space(p, o), D = meta.duration, k = t / 0.6;
      // the floor: scorch, the dust ring racing out as a true circle, the first beat's dome
      scorch3(q, HR, t, 56, 3.4, 1 - smooth(D - 1.6, D - 0.3, t));
      if (k < 1) {
        const r = 150 * ease.outCubic(k), w = 5 + 12 * (1 - k), a = Math.min(1, 1.9 * (1 - k) + 0.15);
        q.plane(0, 0, 0, null, r, (u, v, out) => {
          const b = (r - Math.hypot(u, v)) / w;
          if (b < 0 || b > 1) return;
          out.c = b < 0.16 ? F[6] : b < 0.36 ? F[3] : b < 0.68 ? st.light : st.body;
          out.a = a * (b < 0.36 ? 1.1 : 1.1 - b);
          if (b < 0.36) (out.l = F[4]), (out.k = 0.3 * (1 - b) * a);
        });
      }
      if (t < 0.04) dome3(q, F, 44, 1);
      else if (t < 0.11) dome3(q, F, 38 - (t - 0.04) * 120, 1 - (t - 0.04) / 0.07);
      for (const f of flashes) {
        const k2 = f.life / f.max, r = f.r * (0.8 + 0.2 * k2);
        q.ball(f.x, f.y, f.z, r + 1.2, (nx, ny) => {
          const d = Math.hypot(nx, ny);
          return d > 0.9 ? F[2] : d > 0.55 ? (k2 > 0.45 ? F[6] : F[5]) : k2 > 0.45 ? WHITE : F[6];
        });
      }
      // rocks (molten ones with trails behind them), little fires where they landed
      rocks3(q, rocks, st, FR);
      for (const b of rocks.list) if (b.pts) trail3(q, b.pts, t, FR, SM, 0.45, 0.6 + b.s * 0.3, b.heat);
      blazes.drawBack(q);
      // the stem and the rolling cap, then the fire puffs and smoke round them, all by depth
      column.draw3(q, top(), FR, SM, 1 - t / 1.4, plume.hot());
      plume.draw3(q, FR, SM);
      drawPs3(q, ps, FR);
      // the air shock: the silhouette of a sphere on the floor, and the light hugging it
      if (t < 0.5) {
        const u = t / 0.5, r = 34 + 80 * ease.outCubic(u);
        shell3(q, 0, 0, 0, r, Math.max(1, 3 * (1 - u) + 0.5), u < 0.3 ? F[6] : u < 0.6 ? F[5] : F[3], Math.min(1, (1 - u) * 1.6));
        q.at(0, 0, 0, (pp, kk) => glowDome(pp, 0, 0, r * kk, 6, F[4], 0.35 * (1 - u)));
      }
      for (const r of rings) {
        const k2 = r.life / r.max, e = 1 - Math.pow(k2, 3);
        shell3(q, r.x, r.y, r.z, r.r0 + (r.r1 - r.r0) * e, Math.max(1, r.thick * k2 + 0.4), r.c, Math.min(1, k2 * 1.6));
      }
      if (t < 0.24) {
        const u = 1 - t / 0.24;
        q.at(0, -14, 0, (pp, kk) => flare(pp, 0, 0, 70 * Math.pow(u, 1.4) * kk, u, F));
      }
      if (t < 0.04) q.glow(0, -30, 0, 68, WHITE, 0.6);
      // the fireball lights the floor under it while it burns
      const hot = plume.hot(), flash = Math.max(0, 1 - t / 0.9);
      pool3(q, 140, F[3], 0.24 * hot + 0.5 * flash * flash);
      lights.draw(q);
    },
  };
}

export const three = {
  meta: { size: SIZE3, origin: ORIGIN3, bg: "ground", camera: { pitch: PITCH } },
  create: create3,
};
