// The plasma ball (a lit rim, filaments from a white-hot heart, motes riding round it, zaps that spark where
// they land) follows Sprite Fusion's open-source energy orb (https://www.spritefusion.com/pixel-art-vfx/energy),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { P, Rng, fit, bolt, forks, tileFbm, space, clamp, smooth, lerp, ease, rand, rng, mix, TAU, WHITE } from "../../core/index.js";
import { Ghosts, since, strokeArc, strokeArc3, upright, cone, sphere, coreLine } from "./_lib.js";

export const meta = {
  name: "Energy core",
  desc: "A plasma core beating in a steel cage: it swells and throws a shock ring on each beat, two tilted rings orbit it, and arcs jump to the bars and spark.",
  tags: ["scifi", "reactor", "core", "power", "plasma", "machine", "prop", "ground", "loop"],
  size: [112, 100],
  origin: [56, 88],
  duration: 2.4,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#1a0516", "#3d0a33", "#701560", "#b0228f", "#f53cd1", "#ff86e6", "#ffd2f6", "#ffffff"],
    metal: ["#0e0d14", "#1e1c27", "#312e3e", "#4b4759", "#6f6a82", "#9d98b0"],
    seed: 35,
  },
};

const D = meta.duration, CY = -36, R0 = 11, RC = 24, TOPY = -64, BOTY = -9, SLOT = 0.1, NS = Math.round(D / SLOT);
// two heartbeats a loop, each a strong thump and a softer echo
const BEATS = [[0.05, 1, true], [0.25, 0.5, false], [1.25, 1, true], [1.45, 0.5, false]];
const env = (a) => (a < 0.03 ? a / 0.03 : Math.exp(-(a - 0.03) / 0.12));
const pulseAt = (t) => BEATS.reduce((m, [b, k]) => Math.max(m, k * env(since(t, b, D))), 0);
// the cage's bars round the core: angle, x, depth (> 0 in front)
const BARS = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * TAU + Math.PI / 6;
  return { x: RC * Math.sin(a), z: Math.cos(a) };
});
// a point on an orbiting ring, tilted and turning: [x, y, depth]
function ringPt(r, tilt, spin, a) {
  const x = r * Math.cos(a), z0 = r * Math.sin(a), y = -z0 * Math.sin(tilt), z = z0 * Math.cos(tilt);
  return [x * Math.cos(spin) + z * Math.sin(spin), CY - y, -x * Math.sin(spin) + z * Math.cos(spin)];
}
const RINGS = [
  { r: 17, tilt: 1.15, spin: (t) => TAU * (t / D) },
  { r: 19, tilt: -0.9, spin: (t) => -TAU * 2 * (t / D) + 1 },
];

const cache = new Map();
function setup(o) {
  const key = `${o.seed}:${o.palette.join()}`;
  if (cache.has(key)) return cache.get(key);
  const C = fit(o.palette, 8), rn = new Rng(o.seed);
  const g = new Ghosts(D, { ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]], haze: C[5], box: [-54, -98, 54, 11] });
  // arcs: each slot of the loop may fire one or two, more just after a thump
  const arcs = [];
  for (let s = 0; s < NS; s++) {
    const ts = s * SLOT, hot = BEATS.some(([b, , strong]) => strong && since(ts, b, D) < 0.16);
    for (let n = 0; n < (hot ? 2 : 1); n++) {
      if (!hot && !rn.chance(0.4)) continue;
      const bar = rn.pick(BARS.filter((b) => b.z > -0.2)), ty = rn.range(TOPY + 8, BOTY - 6), ang = Math.atan2(ty - CY, bar.x);
      const sx = Math.cos(ang) * R0, sy = CY + Math.sin(ang) * R0, path = bolt(rn, sx, sy, bar.x - Math.sign(bar.x) * 1.5, ty, { jag: 0.3, depth: 4 });
      arcs.push({ s, path, fk: forks(rn, path, { count: rn.int(0, 1), len: 7, jag: 0.35 }) });
      for (let i = 0; i < 5; i++) {
        const a = Math.atan2(ty - sy, bar.x - sx) + Math.PI + rn.range(-1.2, 1.2), sp = rn.range(60, 170);
        g.add(ts, P.SPARK, bar.x, ty, Math.cos(a) * sp, Math.sin(a) * sp - 40, rn.range(0.2, 0.5));
      }
    }
  }
  // each thump throws motes off the core
  for (const [b, , strong] of BEATS) {
    if (!strong) continue;
    for (let i = 0; i < 12; i++) {
      const a = rn.range(0, TAU), sp = rn.range(40, 110);
      g.add(b + 0.02, P.MOTE, Math.cos(a) * R0, CY + Math.sin(a) * R0, Math.cos(a) * sp, Math.sin(a) * sp, rn.range(0.25, 0.5), rn.pick([WHITE, C[6], C[5]]), 0.7);
    }
  }
  const v = { C, arcs, g };
  cache.set(key, v);
  return v;
}

// the plinth on the floor: a steel drum with a lit top and a row of status lights
function plinth(p, C, H, t, pulse) {
  p.shade(-30, -10, 30, 2, (x, y, out) => {
    const top = ((x / 29) ** 2 + ((y + 7) / 4) ** 2) <= 1, side = Math.abs(x) <= 29 && y > -7 && y <= 0;
    if (!top && !side) return;
    if (top) out.c = ((x / 29) ** 2 + ((y + 7) / 4) ** 2) > 0.82 ? H[0] : y < -8 ? H[5] : x < 0 ? H[4] : H[3];
    else out.c = Math.abs(x) > 28 || y === 0 ? H[0] : y === -6 ? H[4] : x < -14 ? H[3] : x > 14 ? H[1] : H[2];
  });
  for (let i = 0; i < 7; i++) {
    const x = -18 + i * 6, k = 0.5 + 0.5 * Math.cos(TAU * (2 * (t / D) - i / 7));
    p.px(x, -3, k > 0.75 ? WHITE : k > 0.4 ? C[5] : C[2]);
    if (k > 0.6) p.glow(x, -3, 4, C[4], 0.3 * k);
  }
  p.glow(0, -8, 26, C[4], 0.25 + 0.3 * pulse);
}

// a cage bar: steel, lit on the face toward the core
function barDraw(p, b, C, H, pulse, back) {
  const lit = back ? C[3] : pulse > 0.5 ? C[6] : C[5], inward = -Math.sign(b.x);
  for (let y = TOPY + 2; y < BOTY; y++)
    for (let i = -1; i <= 1; i++) {
      const face = i === inward;
      p.px(b.x + i, y, back ? (face ? lit : H[1]) : face ? lit : i === 0 ? H[3] : H[1]);
    }
}

// the cage's rings top and bottom: the far half or the near half of a steel hoop
function hoop(p, y, rx, H, C, near, pulse) {
  for (let i = 0, n = Math.ceil(rx * 8); i < n; i++) {
    const g = (i / n) * TAU, s = Math.sin(g);
    if (s >= 0 !== near) continue;
    const x = Math.cos(g) * rx, yy = y + s * 4;
    p.px(x, yy, near ? (s > 0.6 ? H[4] : H[3]) : H[1]);
    p.px(x, yy + 1, near ? H[1] : H[0]);
    if (near && s < 0.3) p.px(x, yy - 1, pulse > 0.5 ? C[5] : C[3]);
  }
}

// the core: dark plasma held in a hard rim, thin bright bands churning round a white-hot heart, filaments
// flickering out from it; a thump floods it with light
function core(p, t, C, R, pulse, seed) {
  const ph = t / D;
  p.shade(-R - 2, CY - R - 2, R + 2, CY + R + 2, (x, y, out) => {
    const dx = x, dy = y - CY, d = Math.sqrt(dx * dx + dy * dy) / R;
    if (d > 1.1) return;
    if (d > 1) return (out.c = C[2]);
    if (d > 0.9) return (out.c = dy < -R * 0.3 && dx < R * 0.3 ? C[6] : C[4]);
    const a = Math.atan2(dy, dx), n = 0.5 + 0.5 * tileFbm((a / TAU) * 6 + ph * 6 + d * 1.5, d * 2.2 - ph * 4, 6, 4, seed, 2);
    const band = Math.abs(n - 0.5) < 0.05 + 0.05 * pulse, heat = (1 - d) ** 2 + pulse * 0.45;
    if (band) out.c = heat > 0.5 ? WHITE : heat > 0.2 ? C[6] : C[5];
    else out.c = heat > 0.7 ? C[6] : heat > 0.42 ? C[5] : heat > 0.2 ? C[3] : n > 0.5 ? C[2] : C[1];
  });
  // filaments, redrawn every other frame
  const f = Math.floor(t * 15), r = rng(seed, f, 5);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + f * 0.7 + r.range(-0.4, 0.4), pts = bolt(r, 0, CY, Math.cos(a) * R * 0.88, CY + Math.sin(a) * R * 0.88, { jag: 0.32, depth: 3 });
    p.polyline(pts, (u) => (u < 0.4 ? WHITE : C[6]));
    const [ex, ey] = pts[pts.length - 1];
    p.px(ex, ey, WHITE);
    p.glow(ex, ey, 4, C[5], 0.4);
  }
  p.circle(0, CY, 1.8 + pulse * 2, WHITE);
  p.circle(0, CY, 3 + pulse * 2, (d) => (d > 0.6 ? C[6] : WHITE), 0.0001);
  // a glassy highlight top left
  p.px(-R * 0.45, CY - R * 0.55, WHITE);
  p.px(-R * 0.45 + 1, CY - R * 0.55, C[6]);
}

function ring(p, t, rg, C, front, pulse) {
  const spin = rg.spin(t), bead = (t / D) * TAU * 3;
  for (let i = 0, n = Math.ceil(rg.r * 9); i < n; i++) {
    const a = (i / n) * TAU, [x, y, z] = ringPt(rg.r, rg.tilt, spin, a);
    if (z >= 0 !== front) continue;
    const u = ((((a - bead) / TAU) % 1) + 1) % 1, head = u > 0.9;
    p.px(x, y, head ? WHITE : !front ? C[3] : z > 0.5 * rg.r || pulse > 0.6 ? C[6] : C[5]);
  }
  if (front) {
    const [x, y] = ringPt(rg.r, rg.tilt, spin, bead);
    p.glow(x, y, 6, C[5], 0.5);
  }
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), H = fit(o.metal, 6), pulse = pulseAt(t);
  hoop(p, BOTY, RC, H, C, false, pulse);
  hoop(p, TOPY, RC, H, C, false, pulse);
  for (const b of BARS) if (b.z < 0) barDraw(p, b, C, H, pulse, true);
  for (const rg of RINGS) ring(p, t, rg, C, false, pulse);
}

export function draw(p, t, o) {
  const { C, arcs, g } = setup(o), H = fit(o.metal, 6), pulse = pulseAt(t), R = R0 * (1 + 0.14 * pulse);
  plinth(p, C, H, t, pulse);
  core(p, t, C, R, pulse, o.seed);
  for (const rg of RINGS) ring(p, t, rg, C, true, pulse);
  for (const b of BARS) if (b.z >= 0) barDraw(p, b, C, H, pulse, false);
  hoop(p, BOTY, RC, H, C, true, pulse);
  hoop(p, TOPY, RC, H, C, true, pulse);
  // the cap: a steel dome with an emitter on top
  p.shade(-15, TOPY - 7, 15, TOPY, (x, y, out) => {
    const d = (x / 14.5) ** 2 + ((y - TOPY) / 6.5) ** 2;
    if (d > 1) return;
    const l = -x * 0.05 - (y - TOPY) * 0.12;
    out.c = d > 0.8 ? H[0] : l > 0.55 ? H[5] : l > 0.3 ? H[4] : H[3];
  });
  p.px(0, TOPY - 7, pulse > 0.4 ? WHITE : C[5]);
  p.glow(0, TOPY - 7, 5, C[4], 0.4 + 0.4 * pulse);
  // the arcs firing now
  const s = Math.floor(t / SLOT) % NS, k = 1 - (t - Math.floor(t / SLOT) * SLOT) / SLOT;
  for (const a of arcs) {
    if (a.s !== s) continue;
    strokeArc(p, a.path, [C[2], C[5], C[4]], k);
    for (const f of a.fk) strokeArc(p, f, [C[2], C[5], C[4]], k, 0.6);
    const [ex, ey] = a.path[a.path.length - 1];
    p.glow(ex, ey, 8, C[5], 0.6 * k);
  }
  // each thump: a shock ring rolls out from the core
  for (const [b, , strong] of BEATS) {
    const a = since(t, b, D);
    if (!strong || a > 0.45) continue;
    const q = a / 0.45, r = R0 + 34 * ease.outCubic(q);
    p.ring(0, CY, r, Math.max(1, 3 * (1 - q)), q < 0.25 ? WHITE : q < 0.5 ? C[6] : C[5], 1.1 - q);
    p.glowRing(0, CY, r, 6, C[4], 0.35 * (1 - q));
  }
  g.at(t).draw(p);
  // light: the core's heat, its white heart, the steel lit round it
  p.glow(0, CY, 46, C[4], 0.2 + 0.3 * pulse);
  p.glow(0, CY, 9, WHITE, 0.35 + 0.4 * pulse);
}

// 3D: the cage is six real bars round the core between two true hoops, the plinth a drum with its lights all the way
// round, the two rings orbit in space, the arcs jump from the core to the bars on every side, each thump throws a
// shock ring out across the plane of the core and a shell of light round it.
const cache3 = new Map();
function setup3(o) {
  const key = `${o.seed}:${o.palette.join()}`;
  if (cache3.has(key)) return cache3.get(key);
  const C = fit(o.palette, 8), rn = new Rng(o.seed + 11);
  const g = new Ghosts(D, { ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]], haze: C[5], box: [-80, -98, 80, 11] });
  const az = (i) => (i / 6) * TAU + Math.PI / 6, arcs = [];
  for (let s = 0; s < NS; s++) {
    const ts = s * SLOT, hot = BEATS.some(([b, , strong]) => strong && since(ts, b, D) < 0.16);
    for (let n = 0; n < (hot ? 2 : 1); n++) {
      if (!hot && !rn.chance(0.4)) continue;
      const bi = rn.int(0, 5), a = az(bi), ty = rn.range(TOPY + 8, BOTY - 6), ang = Math.atan2(ty - CY, RC);
      const sx = Math.cos(ang) * R0, sy = CY + Math.sin(ang) * R0, path = bolt(rn, sx, sy, RC - 1.5, ty, { jag: 0.3, depth: 4 });
      const fk = forks(rn, path, { count: rn.int(0, 1), len: 7, jag: 0.35 });
      arcs.push({ s, path: upright(path, a), fk: fk.map((f) => upright(f, a)) });
      for (let i = 0; i < 5; i++) {
        const sp = rn.range(60, 170), b = Math.atan2(ty - sy, RC - sx) + Math.PI + rn.range(-1.2, 1.2);
        g.add(ts, P.SPARK, 0, ty, Math.abs(Math.cos(b)) * sp, Math.sin(b) * sp - 40, rn.range(0.2, 0.5), WHITE, 1, 0, a + Math.PI + rn.range(-0.9, 0.9), Math.cos(a) * RC, Math.sin(a) * RC);
      }
    }
  }
  for (const [b, , strong] of BEATS) {
    if (!strong) continue;
    for (let i = 0; i < 16; i++) {
      const a = rn.range(0, TAU), sp = rn.range(40, 110), phi = rn.range(0, TAU);
      g.add(b + 0.02, P.MOTE, Math.cos(a) * R0, CY + Math.sin(a) * R0, Math.cos(a) * sp, Math.sin(a) * sp, rn.range(0.25, 0.5), rn.pick([WHITE, C[6], C[5]]), 0.7, 0, phi);
    }
  }
  const v = { C, arcs, g, az };
  cache3.set(key, v);
  return v;
}

export const three = {
  meta: { size: [120, 108], origin: [60, 94], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const { C, arcs, g, az } = setup3(o), H = fit(o.metal, 6), pulse = pulseAt(t), R = R0 * (1 + 0.14 * pulse), ph = t / D, q = space(p, o);
    // the plinth: a steel drum with a lit top and a ring of status lights round it
    cone(q, 0, 0, -7, 0, 29, 29, (h, out) => {
      if (!h.front) return;
      const l = -h.nx * 0.5 + h.nz * 0.45;
      out.c = h.y > -0.8 || h.y < -6.2 ? H[0] : l > 0.55 ? H[4] : l > 0.1 ? H[3] : l > -0.4 ? H[2] : H[1];
    });
    q.plane(0, -7, 0, null, 29, (u, v, out) => {
      const d = Math.hypot(u, v) / 29;
      out.c = d > 0.94 ? H[0] : d > 0.68 ? ((-u * 0.5 - v * 0.8) / 29 > 0.3 ? H[5] : H[4]) : H[3];
    });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, k = 0.5 + 0.5 * Math.cos(TAU * (2 * ph - i / 12)), x = Math.cos(a) * 29.2, z = Math.sin(a) * 29.2;
      q.ball(x, -3.2, z, 1, k > 0.75 ? WHITE : k > 0.4 ? C[5] : C[2]);
      if (k > 0.6) q.glow(x, -3.2, z, 4, C[4], 0.3 * k);
    }
    // the cage: six steel bars lit on the face toward the core, between two hoops
    for (let i = 0; i < 6; i++) {
      const a = az(i), x = Math.cos(a) * RC, z = Math.sin(a) * RC;
      q.beam(x, TOPY + 2, z, x, BOTY, z, 3, (u, v) => (v > 0.7 ? H[1] : H[3]));
      q.beam(x * (RC - 1.6) / RC, TOPY + 3, z * (RC - 1.6) / RC, x * (RC - 1.6) / RC, BOTY - 1, z * (RC - 1.6) / RC, 1.2, pulse > 0.5 ? C[6] : C[5]);
    }
    for (const y of [BOTY, TOPY])
      q.decal(0, y, 0, null, RC + 3, (pp) => {
        pp.ring(0, 0, RC + 1.2, 1.2, H[4]);
        pp.ring(0, 0, RC, 1.2, H[2]);
        pp.ring(0, 0, RC - 1.2, 1, pulse > 0.5 ? C[5] : C[3], 0.9);
      });
    // the cap: a steel dome with an emitter on top
    cone(q, 0, 0, TOPY - 6.5, TOPY, 9, 14.5, (h, out) => {
      if (!h.front) return;
      const l = -h.nx * 0.6 - h.ny * 0.5 + h.nz * 0.3;
      out.c = h.y > TOPY - 0.6 ? H[0] : l > 0.55 ? H[5] : l > 0.3 ? H[4] : H[3];
    });
    q.plane(0, TOPY - 6.5, 0, null, 9.2, (u, v, out) => (out.c = (-u * 0.4 - v * 0.5) / 9 > 0.2 ? H[5] : H[4]));
    q.ball(0, TOPY - 7.6, 0, 1.6, pulse > 0.4 ? WHITE : C[5]);
    q.glow(0, TOPY - 8, 0, 5, C[4], 0.4 + 0.4 * pulse);
    // the core: dark plasma held in a hard rim, thin bright bands churning round a white-hot heart, filaments
    // flickering over it; a thump floods it with light
    sphere(q, 0, CY, 0, R, (h, out) => {
      if (!h.front) return;
      const d = Math.sqrt(1 - h.vz * h.vz);
      if (d > 0.9) return (out.c = h.vy < -0.3 && h.vx < 0.3 ? C[6] : C[4]);
      const az2 = Math.atan2(h.z, h.x) / TAU, n = 0.5 + 0.5 * tileFbm(az2 * 6 + ph * 6, (h.y / R) * 2.2 - ph * 4, 6, 4, o.seed, 2);
      const band = Math.abs(n - 0.5) < 0.05 + 0.05 * pulse, heat = (1 - d) ** 2 + pulse * 0.45;
      if (band) out.c = heat > 0.5 ? WHITE : heat > 0.2 ? C[6] : C[5];
      else out.c = heat > 0.7 ? C[6] : heat > 0.42 ? C[5] : heat > 0.2 ? C[3] : n > 0.5 ? C[2] : C[1];
    });
    {
      const f = Math.floor(t * 15), r = rng(o.seed, f, 5);
      for (let i = 0; i < 4; i++) {
        // a filament crawls over the surface from a point on it
        let az0 = r.range(0, TAU), el = r.range(-1.2, 1.2);
        const pts = [];
        for (let j = 0; j < 7; j++) {
          pts.push([Math.cos(el) * Math.cos(az0) * R * 1.03, CY - Math.sin(el) * R * 1.03, Math.cos(el) * Math.sin(az0) * R * 1.03]);
          az0 += r.range(-0.25, 0.25) + 0.12;
          el += r.range(-0.3, 0.3);
        }
        for (let j = 1; j < pts.length; j++) coreLine(q, pts[j - 1], pts[j], j < 3 ? WHITE : C[6], 0.6);
        q.glow(...pts[pts.length - 1], 4, C[5], 0.4);
      }
    }
    // the two rings: beads on tilted rings, spinning, the far half dim
    for (const rg of RINGS) {
      const spin = rg.spin(t), bead = ph * TAU * 3, pts = [];
      for (let i = 0, n = Math.ceil(rg.r * 9); i < n; i++) {
        const a = (i / n) * TAU, pt = ringPt(rg.r, rg.tilt, spin, a), u = ((((a - bead) / TAU) % 1) + 1) % 1;
        const front = q.depth(...pt) < q.depth(0, CY, 0);
        q.px(...pt, u > 0.9 ? WHITE : !front ? C[3] : q.depth(...pt) < q.depth(0, CY, 0) - 0.5 * rg.r || pulse > 0.6 ? C[6] : C[5]);
      }
      const b = ringPt(rg.r, rg.tilt, spin, bead);
      q.glow(...b, 6, C[5], 0.5);
    }
    // the arcs firing now
    const s = Math.floor(t / SLOT) % NS, k = 1 - (t - Math.floor(t / SLOT) * SLOT) / SLOT;
    for (const a of arcs) {
      if (a.s !== s) continue;
      strokeArc3(q, a.path, [C[2], C[5], C[4]], k);
      for (const f of a.fk) strokeArc3(q, f, [C[2], C[5], C[4]], k, 0.6);
      q.glow(...a.path[a.path.length - 1], 8, C[5], 0.6 * k);
    }
    // each thump: a shock ring rolls out from the core across its plane, and a shell of light swells round it
    for (const [b, , strong] of BEATS) {
      const a = since(t, b, D);
      if (!strong || a > 0.45) continue;
      const u = a / 0.45, r = R0 + 34 * ease.outCubic(u), w = Math.max(1, 3 * (1 - u));
      q.decal(0, CY, 0, null, r + 2, (pp) => pp.ring(0, 0, r, w, u < 0.25 ? WHITE : u < 0.5 ? C[6] : C[5], 1.1 - u));
      q.glow(0, CY, 0, r + 6, C[4], 0.28 * (1 - u));
      sphere(q, 0, CY, 0, r * 0.9, (h, out) => {
        out.blend = true;
        out.c = u < 0.3 ? C[6] : C[5];
        out.a = (0.55 * (1 - u)) * Math.max(0, h.rim - 0.55) ** 2;
      });
    }
    g.at3(t).draw(q);
    // light: the core's heat, its white heart, the steel lit round it
    q.glow(0, CY, 0, 46, C[4], 0.2 + 0.3 * pulse);
    q.glow(0, CY, 0, 9, WHITE, 0.35 + 0.4 * pulse);
    q.glow(0, -8, 0, 26, C[4], 0.25 + 0.3 * pulse);
  },
};
