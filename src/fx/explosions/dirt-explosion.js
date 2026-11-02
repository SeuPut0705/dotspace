// The earth recipe (grit thrown in a fan, rocks that bounce and kick up dust, a dust column and dust rolling out along
// the floor) is adapted from Sprite Fusion's open-source explosion (https://www.spritefusion.com/pixel-art-vfx/explosion),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, PF, B, Rng, fit, band, smooth, ease, TAU, WHITE, hex, mix, rgb, scale, clamp, rand, space, lit } from "../../core/index.js";
import { drawDirt, crater, rock, dome, pool, cull, fadeEdges, rocks3, dome3, pool3 } from "./_lib.js";

export const meta = {
  name: "Dirt explosion",
  desc: "A buried charge goes off: a flash under the floor, a V of dirt clods and grit thrown high, a brown dust plume that billows and settles, and a crater left behind.",
  tags: ["explosion", "dirt", "earth", "dust", "debris", "ground", "one-shot"],
  size: [260, 240],
  origin: [130, 206],
  duration: 3.6,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#1c1610", "#33281c", "#4f3f2c", "#6e5a40", "#927a58", "#b89f78", "#dcc8a2"],
    fire: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
    seed: 3,
  },
};

export function create(o) {
  const E = fit(o.palette, 7), F = fit(o.fire, 8), R = new Rng(o.seed), floor = () => 0;
  const [W, H] = meta.size, [OX, OY] = meta.origin, X0 = -OX + 3, X1 = W - OX - 3, Y0 = -OY + 3, Y1 = H - OY - 3;
  const clod = { light: E[5], body: E[3], shade: E[2] }, DUST = mix(E[4], rgb(150, 140, 150), 0.2), SOIL = mix(E[3], rgb(90, 80, 90), 0.2), DARK = mix(E[2], rgb(60, 52, 60), 0.3);
  const ps = new Particles({ rng: R, ground: floor, sparks: [F[6], F[5], F[3], F[2]] }), lights = new Lights();
  const clods = new Bits({ ground: floor });
  let t = 0;

  lights.add(0, -10, 56, F[4], 0.7, 0.22);
  lights.add(0, -4, 26, WHITE, 0.6, 0.06);
  // the charge: a few sparks out of the hole
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + R.range(-0.7, 0.7), sp = R.range(160, 320);
    ps.spawn(P.SPARK, 0, -2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.15, 0.35));
  }
  // the fountain: grit in a V, clods thrown high, a few pebbles
  for (let i = 0; i < 300; i++) {
    const side = R.sign(), a = -Math.PI / 2 + side * R.range(0.05, 0.62), sp = R.range(150, 470) * (1 - 0.3 * Math.abs(a + Math.PI / 2));
    ps.spawn(P.GRIT, R.range(-4, 4), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1.2, 2.2), R.pick([E[1], E[2], E[2], E[3], E[3], E[4], E[5]]), R.chance(0.45) ? 2 : 1, R.range(0, 0.06));
  }
  for (let i = 0; i < 30; i++) {
    const side = R.sign(), a = -Math.PI / 2 + side * R.range(0.1, 0.6), sp = R.range(200, 430);
    clods.add({ kind: B.CHUNK, x: R.range(-5, 5), y: -2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 1, drag: 0.35, bounce: 0.25, life: R.range(2.2, 3), a: R.range(0, TAU), va: R.range(-12, 12), s: i < 12 ? R.range(2.6, 3.8) : R.range(1.4, 2.4) });
  }
  // the dust: a plume punched straight up, two lobes riding the V, and a skirt rolling out along the floor
  for (let i = 0; i < 22; i++)
    ps.spawn(P.SMOKE, R.range(-7, 7), -R.range(2, 12), R.range(-25, 25), -R.range(70, 180), R.range(1.8, 2.6), R.chance(0.6) ? SOIL : DUST, R.range(9, 14), R.range(0, 0.14), PF.BIG);
  for (let i = 0; i < 14; i++) {
    const side = R.sign(), a = -Math.PI / 2 + side * R.range(0.35, 0.6), sp = R.range(110, 210);
    ps.spawn(P.SMOKE, side * R.range(2, 8), -R.range(2, 8), Math.cos(a) * sp, Math.sin(a) * sp, R.range(1.6, 2.4), R.chance(0.5) ? SOIL : DUST, R.range(8, 12), R.range(0.02, 0.1), PF.BIG);
  }
  for (let i = 0; i < 16; i++) {
    const s = R.sign();
    ps.spawn(P.SMOKE, s * R.range(4, 16), -R.range(1, 5), s * R.range(70, 200), -R.range(2, 12), R.range(1.4, 2.2), DUST, R.range(6, 9), R.range(0.02, 0.1), PF.BIG);
  }
  // dark soil thrown up with it, heavier and lower
  for (let i = 0; i < 8; i++) ps.spawn(P.SMOKE, R.range(-8, 8), -R.range(2, 8), R.range(-40, 40), -R.range(40, 110), R.range(1.2, 1.8), DARK, R.range(6, 9), R.range(0, 0.05));

  return {
    update(dt) {
      t += dt;
      for (const b of clods.list) b.pvy = b.vy;
      clods.update(dt);
      // clods thud down: a puff of dust and a spray of crumbs where they land, the big ones break up
      for (let i = clods.list.length - 1; i >= 0; i--) {
        const b = clods.list[i];
        if (b.x < X0 + 4 || b.x > X1 - 4) {
          clods.list.splice(i, 1);
          continue;
        }
        const landed = (b.pvy > 0 && b.vy <= 0) || (b.rest && !b.thud);
        if (!landed || b.pvy < 80) {
          if (b.rest) b.thud = true;
          continue;
        }
        b.thud = b.rest;
        for (let j = 0; j < 2 + Math.round(b.s); j++) ps.spawn(P.DUST, b.x + R.range(-2, 2), -0.5, R.sign() * R.range(15, 55), -R.range(4, 22), R.range(0.35, 0.7), DUST, R.range(1.6, 1.2 + b.s));
        for (let j = 0; j < Math.round(b.s * 3); j++) ps.spawn(P.GRIT, b.x, -1, R.range(-70, 70), -R.range(40, 140), R.range(0.8, 1.4), R.pick([E[2], E[3], E[4]]), 1);
        if (b.s > 2.2 && b.pvy > 200) b.s *= 0.6;
      }
      ps.update(dt);
      cull(ps, X0, Y0, X1, Y1);
      fadeEdges(ps, X0, X1, 24, Y1);
      lights.update(dt);
    },
    drawBack(p) {
      crater(p, E, 0, 28, ease.outCubic(Math.min(1, t / 0.12)), 1 - smooth(meta.duration - 0.7, meta.duration - 0.1, t));
      const k = t / 0.45;
      if (k < 1) band(p, 0, 0.5, 90 * ease.outCubic(k), 0.16, Math.max(1, 3 * (1 - k)), 1.1 - k, [E[2], E[4], E[5], E[6]], (g) => Math.sin(g) < 0);
      drawDirt(p, ps, "back");
    },
    draw(p) {
      const k = t / 0.45;
      if (k < 1) band(p, 0, 0.5, 90 * ease.outCubic(k), 0.16, Math.max(1, 3 * (1 - k)), 1.1 - k, [E[2], E[4], E[5], E[6]], (g) => Math.sin(g) >= 0);
      // the flash out of the ground: a squat dome of white-hot air for a frame or two
      if (t < 0.09) dome(p, F, 0, 15 * (1 - t * 3), 1 - t / 0.09);
      for (const b of clods.list) rock(p, b, clod, F);
      drawDirt(p, ps, "front");
      pool(p, 0, 1, 60, 10, F[3], 0.5 * Math.max(0, 1 - t / 0.3));
      lights.draw(p);
    },
  };
}

// ---- 3D: the same blast standing in space. The crater is a true round pit in the floor with a lip of heaped clods
// round it, the dust skirt and the shock ring run out as circles, the grit is thrown in a hollow cone (a V seen from
// any side), the clods and the plume have a real x, y and z, the flash is a hemisphere of hot air.

const PITCH = 0.3, CP = Math.cos(PITCH), SP = Math.sin(PITCH);

export const three = {
  meta: { size: [260, 240], origin: [130, 204], camera: { pitch: PITCH } },
  create(o) {
    const E = fit(o.palette, 7), F = fit(o.fire, 8), R = new Rng(o.seed), floor = () => 0;
    const [W, H] = three.meta.size, [OX, OY] = three.meta.origin, RM = OX - 20, TOP = -OY + 3, BOT = H - OY - 3;
    const clod = { light: E[5], body: E[3], shade: E[2] }, DUST = mix(E[4], rgb(150, 140, 150), 0.2), SOIL = mix(E[3], rgb(90, 80, 90), 0.2), DARK = mix(E[2], rgb(60, 52, 60), 0.3);
    const SHOCK = [E[2], E[4], E[5], E[6]], HEAP = lit([E[1], E[2], E[3], E[4], E[5]]);
    const ps = new Particles({ rng: R, ground: floor, sparks: [F[6], F[5], F[3], F[2]] }), lights = new Lights();
    const clods = new Bits({ ground: floor });
    // the heaped lip round the pit and the loose earth scattered beyond it
    const lip = Array.from({ length: 24 }, (_, i) => ({ a: (i / 24) * TAU + R.range(-0.12, 0.12), d: R.range(1.0, 1.28), r: R.range(1.6, 3.4) }));
    const specks = Array.from({ length: 70 }, () => ({ a: R.range(0, TAU), d: R.range(1.2, 2.3), c: R.chance(0.5) ? E[3] : E[2] }));
    let t = 0;

    // a point and a velocity out on the cone `tilt` off the vertical, heading az round
    const cone = (tilt, az, sp) => [Math.sin(tilt) * Math.cos(az) * sp, -Math.cos(tilt) * sp, Math.sin(tilt) * Math.sin(az) * sp];
    lights.add(0, -10, 56, F[4], 0.7, 0.22);
    lights.add(0, -4, 26, WHITE, 0.6, 0.06);
    // the charge: a few sparks out of the hole
    for (let i = 0; i < 24; i++) {
      const [vx, vy, vz] = cone(R.range(0, 0.7), R.range(0, TAU), R.range(160, 320));
      ps.spawn3(P.SPARK, 0, -2, 0, vx, vy, vz, R.range(0.15, 0.35));
    }
    // the fountain: grit in a hollow cone, clods thrown high, a few pebbles
    for (let i = 0; i < 420; i++) {
      const tilt = R.range(0.05, 0.62), [vx, vy, vz] = cone(tilt, R.range(0, TAU), R.range(150, 470) * (1 - 0.3 * tilt));
      ps.spawn3(P.GRIT, R.range(-4, 4), -1, R.range(-4, 4), vx, vy, vz, R.range(1.2, 2.2), R.pick([E[1], E[2], E[2], E[3], E[3], E[4], E[5]]), R.chance(0.45) ? 2 : 1, R.range(0, 0.06));
    }
    for (let i = 0; i < 32; i++) {
      const [vx, vy, vz] = cone(R.range(0.1, 0.6), (i / 32) * TAU + R.range(-0.2, 0.2), R.range(200, 430));
      clods.add({ kind: B.CHUNK, x: R.range(-5, 5), y: -2, z: R.range(-5, 5), vx, vy, vz, g: 1, drag: 0.35, bounce: 0.25, life: R.range(2.2, 3), a: R.range(0, TAU), va: R.range(-12, 12), s: i < 12 ? R.range(2.6, 3.8) : R.range(1.4, 2.4) });
    }
    // the dust: a plume punched straight up, lobes riding the cone, and a skirt rolling out along the floor all round
    for (let i = 0; i < 28; i++)
      ps.spawn3(P.SMOKE, R.range(-7, 7), -R.range(2, 12), R.range(-7, 7), R.range(-25, 25), -R.range(70, 180), R.range(-25, 25), R.range(1.8, 2.6), R.chance(0.6) ? SOIL : DUST, R.range(9, 14), R.range(0, 0.14), PF.BIG);
    for (let i = 0; i < 24; i++) {
      const az = R.range(0, TAU), [vx, vy, vz] = cone(R.range(0.35, 0.6), az, R.range(110, 210));
      ps.spawn3(P.SMOKE, Math.cos(az) * R.range(2, 8), -R.range(2, 8), Math.sin(az) * R.range(2, 8), vx, vy, vz, R.range(1.6, 2.4), R.chance(0.5) ? SOIL : DUST, R.range(8, 12), R.range(0.02, 0.1), PF.BIG);
    }
    for (let i = 0; i < 40; i++) {
      const az = R.range(0, TAU), ca = Math.cos(az), sa = Math.sin(az), d = R.range(4, 16), sp = R.range(70, 200);
      ps.spawn3(P.SMOKE, ca * d, -R.range(1, 5), sa * d, ca * sp, -R.range(2, 12), sa * sp, R.range(1.4, 2.2), DUST, R.range(6, 9), R.range(0.02, 0.1), PF.BIG);
    }
    // dark soil thrown up with it, heavier and lower
    for (let i = 0; i < 12; i++) ps.spawn3(P.SMOKE, R.range(-8, 8), -R.range(2, 8), R.range(-8, 8), R.range(-40, 40), -R.range(40, 110), R.range(-40, 40), R.range(1.2, 1.8), DARK, R.range(6, 9), R.range(0, 0.05));

    return {
      update(dt) {
        t += dt;
        for (const b of clods.list) b.pvy = b.vy;
        clods.update(dt);
        // clods thud down: a puff of dust and a spray of crumbs where they land, the big ones break up
        for (let i = clods.list.length - 1; i >= 0; i--) {
          const b = clods.list[i];
          if (Math.hypot(b.x, b.z) > RM - 4) {
            clods.list.splice(i, 1);
            continue;
          }
          const landed = (b.pvy > 0 && b.vy <= 0) || (b.rest && !b.thud);
          if (!landed || b.pvy < 80) {
            if (b.rest) b.thud = true;
            continue;
          }
          b.thud = b.rest;
          for (let j = 0; j < 2 + Math.round(b.s); j++) {
            const az = R.range(0, TAU), sp = R.range(15, 55);
            ps.spawn3(P.DUST, b.x + R.range(-2, 2), -0.5, b.z + R.range(-2, 2), Math.cos(az) * sp, -R.range(4, 22), Math.sin(az) * sp, R.range(0.35, 0.7), DUST, R.range(1.6, 1.2 + b.s));
          }
          for (let j = 0; j < Math.round(b.s * 3); j++) ps.spawn3(P.GRIT, b.x, -1, b.z, R.range(-70, 70), -R.range(40, 140), R.range(-70, 70), R.range(0.8, 1.4), R.pick([E[2], E[3], E[4]]), 1);
          if (b.s > 2.2 && b.pvy > 200) b.s *= 0.6;
        }
        ps.update(dt);
        cull3(ps, RM, TOP, BOT);
        fade3(ps, RM, BOT);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), k = t / 0.45, open = ease.outCubic(Math.min(1, t / 0.12)), a = 1 - smooth(meta.duration - 0.7, meta.duration - 0.1, t);
        // the crater: a true round pit, its lip heaped up round it, loose earth scattered beyond
        if (a > 0.01) {
          const rx = 28 * open;
          if (rx > 1) {
            q.plane(0, 0, 0, null, rx * 1.1 + 1, (u, v, out) => {
              const rho = Math.hypot(u, v), d = rho / rx;
              if (d > 1.06) return;
              // +1 on the wall that faces the light (it comes from the left and front)
              const ln = rho > 0.01 ? ((u - v) * Math.SQRT1_2) / rho : 0, n = E.length, g = rand(Math.floor(u) * 31, Math.floor(v) + 5);
              out.a = a;
              if (d > 0.92) return ln > 0.2 ? E[n - 2] : ln > -0.4 ? E[3] : E[2];
              if (d > 0.6) return ln > 0.35 ? (g < 0.15 ? E[2] : E[3]) : ln > -0.2 ? E[2] : g < 0.2 ? E[0] : E[1];
              return d < 0.35 || g < 0.12 ? E[0] : E[1];
            });
            for (const l of lip) {
              const r = l.r * open, x = Math.cos(l.a) * rx * l.d, z = Math.sin(l.a) * rx * l.d;
              q.ball(x, -r * 0.55, z, r, HEAP, a);
            }
          }
          for (const s of specks) if (rand(Math.floor(s.a * 50), 11) < open) q.dot(Math.cos(s.a) * rx * s.d, -0.2, Math.sin(s.a) * rx * s.d, s.c, a);
        }
        // the shock ring of dust, a true circle running out across the floor
        if (k < 1) {
          const r = 90 * ease.outCubic(k), w = Math.max(2, 8 * (1 - k));
          q.ring(0, 0, 0, r, w, (v) => SHOCK[Math.min(3, Math.floor(v * 4))], clamp(1.4 - k));
        }
        // the flash out of the ground: a squat dome of white-hot air for a frame or two
        if (t < 0.09) dome3(q, F, 15 * (1 - t * 3), 1 - t / 0.09);
        rocks3(q, clods, clod, F);
        dirt3(q, ps);
        pool3(q, 60, F[3], 0.5 * Math.max(0, 1 - t / 0.3));
        lights.draw(q);
      },
    };
  },
};

// the grit as dirt in flight, in space: fast bits stretch into short streaks, slow ones are chips; the rest as usual
function dirt3(q, ps) {
  const all = ps.list, grit = [], rest = [];
  for (const g of all) (g.k === P.GRIT ? grit : rest).push(g);
  ps.list = rest;
  ps.draw(q);
  ps.list = all;
  for (const g of grit) {
    if (g.delay > 0) continue;
    const k = g.life / g.max, sp = Math.hypot(g.vx, g.vy, g.vz);
    if (k < 0.25 && k * 4 < 0.5) continue;
    if (sp > 140) {
      const L = Math.min(5, sp * 0.012), ux = g.vx / sp, uy = g.vy / sp, uz = g.vz / sp;
      q.line(g.x - ux * L, g.y - uy * L, g.z - uz * L, g.x, g.y, g.z, (u) => (u < 0.5 ? scale(g.col, 0.7) : g.col));
    } else if (g.size >= 2) q.ball(g.x, g.y, g.z, 1.2, g.col);
    else q.px(g.x, g.y, g.z, g.col);
  }
}

// particles out of the box (x and z are both radius on screen; the box's top and bottom follow the camera's pitch)
function cull3(ps, rm, top, bot) {
  const L = ps.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i], h = Math.hypot(q.x, q.z);
    if (h > rm || q.y * CP - h * SP < top || q.y * CP + h * SP > bot) L.splice(i, 1);
  }
}
const SOFT3 = new Set([P.SMOKE, P.DUST, P.VAPOUR]);
// soft particles thin out and go before they reach the sides or the bottom
function fade3(ps, rm, bot, w = 24) {
  const L = ps.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i];
    if (!SOFT3.has(q.k)) continue;
    const h = Math.hypot(q.x, q.z), r = q.size * 1.65, e = Math.min((rm - h - r) / w, (bot - (q.y * CP + h * SP) - r) / 6);
    if (e <= 0) L.splice(i, 1);
    else if (e < 1) q.life = Math.min(q.life, q.max * 0.42 * e);
  }
}
