// The orb (a glassy bubble that thickens towards its rim, a hot core, a double rim, a highlight arc and spot,
// motes orbiting in front and behind) is adapted from Sprite Fusion's open-source energy orb
// (https://www.spritefusion.com/pixel-art-vfx/energy), MIT License, Copyright (c) 2026 Hugo Duprez.
import { PAL, fit, cycle, sparkle, space, clamp, TAU, WHITE } from "../../core/index.js";
import { mote } from "./_lib.js";

const D = 2.4, RAD = 17, Y0 = -52;

export const meta = {
  name: "Arcane orb",
  desc: "A floating orb of smoky violet glass with a swirl turning round a white-hot heart, two tilted rings of light orbiting behind and in front.",
  tags: ["arcane", "orb", "sphere", "magic", "floating", "loop"],
  size: [136, 112],
  origin: [68, 104],
  duration: D,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: PAL.arcane, seed: 6 },
};

// two rings, each a circle tilted in depth (sy) and rolled in the picture (rot), beads running round it
const RINGS = [
  { r: 31, sy: 0.24, rot: 0.36, beads: 3, turn: 2, c: 0 },
  { r: 27, sy: 0.3, rot: -0.55, beads: 2, turn: -3, c: 1 },
];

function setup(t) {
  const ph = t / D;
  return { ph, cx: 0, cy: Y0 + Math.sin(ph * TAU) * 2 };
}

// one ring's points on the near (z > 0) or far side; beads brighter, with light
function ring(p, C, s, R, near) {
  const { ph, cx, cy } = s, rot = R.rot + 0.12 * Math.sin(ph * TAU + R.c), cr = Math.cos(rot), sr = Math.sin(rot), n = Math.ceil(R.r * TAU * 1.5);
  const pos = (g) => {
    const lx = Math.cos(g) * R.r, ly = Math.sin(g) * R.r * R.sy;
    return [cx + lx * cr - ly * sr, cy + lx * sr + ly * cr];
  };
  for (let j = 0; j < n; j++) {
    const g = (j / n) * TAU, z = Math.sin(g);
    if (z > 0 !== near) continue;
    const [x, y] = pos(g);
    p.dot(x, y, near ? C[5] : C[4], near ? 0.7 : 0.4);
  }
  for (let b = 0; b < R.beads; b++) {
    const g = ph * TAU * R.turn + (b * TAU) / R.beads;
    for (let k = 0; k < 7; k++) {
      // a bead and its trail along the ring
      const gg = g - Math.sign(R.turn) * k * 0.07, z = Math.sin(gg);
      if (z > 0 !== near) continue;
      const [x, y] = pos(gg);
      p.dot(x, y, k === 0 ? WHITE : k < 3 ? C[6] : C[5], k < 4 ? 1 : 1 - (k - 3) / 4);
      if (k === 0) p.glow(x, y, near ? 7 : 5, C[6], near ? 0.5 : 0.25);
    }
  }
}

// the orb itself: smoky glass, the swirl, the heart, the rim, the highlights
function orb(p, C, s) {
  const { ph, cx, cy } = s;
  // the glass: translucent, thicker towards the rim
  p.disc(cx, cy, RAD, (d) => (d > 0.82 ? C[2] : C[1]), (d) => 0.32 + 0.5 * d * d);
  // the swirl: two bright arms and two faint ones turning round the heart, twice a loop
  // the swirl: two bright arms with a lilac edge, and two faint ones between, turning twice a loop
  for (const [s0, main] of [[0, 1], [Math.PI, 1], [Math.PI / 2, 0], [(3 * Math.PI) / 2, 0]])
    for (let u = 0.08; u <= 0.85; u += 0.012) {
      const a = ph * TAU * 2 + s0 + u * 3.4, r = u * RAD * 0.92, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, fade = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.25;
      if (!main) {
        p.dot(x, y, C[4], fade * 0.8);
        continue;
      }
      // the arm's lit edge trails just behind it
      const b = a - 0.16, xb = cx + Math.cos(b) * r, yb = cy + Math.sin(b) * r;
      p.dot(xb, yb, u < 0.4 ? C[6] : C[5], fade);
      p.dot(x, y, u < 0.3 ? WHITE : u < 0.55 ? C[6] : C[5], fade);
    }
  // the heart
  const pulse = 0.85 + 0.15 * Math.sin(ph * TAU * 3);
  p.circle(cx, cy, 3.6 * pulse + 1, C[5]);
  p.circle(cx, cy, 2.8 * pulse, C[6]);
  p.circle(cx, cy, 1.7 * pulse, WHITE);
  // the rim: a bright line just inside a dark one, a highlight arc and spot top left, a glint bottom right
  p.ring(cx, cy, RAD + 0.4, 1, C[5]);
  p.ring(cx, cy, RAD + 1.3, 1, C[2], 0.8);
  for (let a = 3.5; a < 4.7; a += 0.03) p.dot(cx + Math.cos(a) * (RAD - 2.4), cy + Math.sin(a) * (RAD - 2.4), a > 3.85 && a < 4.35 ? WHITE : C[6]);
  p.circle(cx - RAD * 0.42, cy - RAD * 0.5, 1.3, WHITE);
  p.dot(cx + RAD * 0.52, cy + RAD * 0.55, C[6]);
  p.glow(cx, cy, 20, C[6], 0.26 * pulse);
  p.glowRing(cx, cy, RAD, 6, C[5], 0.25);
}

// motes orbiting on tilted paths, and sparks drifting off the orb
function motes(p, C, s, S, near) {
  const { ph, cx, cy } = s;
  for (let i = 0; i < 8; i++) {
    const a = ((i * 2.4 + S) % TAU) + ph * TAU * (i % 2 ? 1 : -1) * (1 + (i % 3)), rr = RAD + 5 + ((i * 0.37) % 1) * 12, tilt = (((i * 0.71) % 1) - 0.5) * 1.4;
    const x0 = Math.cos(a) * rr, z = Math.sin(a);
    if (z > 0 !== near) continue;
    const x = cx + x0 * Math.cos(tilt), y = cy + x0 * Math.sin(tilt) + z * rr * 0.28, dir = i % 2 ? 1 : -1;
    p.dot(x, y, near ? WHITE : C[5]);
    p.dot(x - dir, y, near ? C[6] : C[4], near ? 1 : 0.6);
    if (near) p.dot(x - 2 * dir, y, C[4], 0.6), p.glow(x, y, 5, C[6], 0.35);
  }
  if (!near) return;
  cycle(ph * D, D, 10, S * 3 + 1, (g) => g.range(0.6, 1), (age, life, r) => {
    const a = r.range(0, TAU), q = age / life, d = RAD + 1 + q * r.range(8, 18);
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d - q * 10;
    mote(p, x, y, Math.cos(a) * 25, Math.sin(a) * 25 - 12, r.chance(0.5) ? C[6] : C[5], 0.6, 1 - q, 0.3);
  });
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), s = setup(t), lift = (s.cy - Y0) / 2;
  // the light it throws on the floor, stronger as it bobs down
  p.glow(0, -1, 36, C[4], 0.26 - 0.04 * lift);
  for (let x = -20; x <= 20; x++) {
    const u = Math.abs(x + 0.5) / 20;
    p.dot(x, 0, u < 0.3 ? C[6] : C[5], (1.1 - u) * (0.9 - 0.15 * lift));
  }
  p.glow(s.cx, s.cy, 60, C[4], 0.36);
  for (const R of RINGS) ring(p, C, s, R, false);
  motes(p, C, s, o.seed, false);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), s = setup(t);
  orb(p, C, s);
  for (const R of RINGS) ring(p, C, s, R, true);
  motes(p, C, s, o.seed, true);
  sparkle(p, s.cx - RAD * 0.42, s.cy - RAD * 0.5, 1.5 + Math.max(0, Math.sin(s.ph * TAU * 2)) * 2, C[6], C[5], 0.3);
}

// ---- 3D: an armillary of two true rings round a glassy sphere, a swirl of arms in tilted planes round its heart,
// motes on inclined orbits and sparks leaving it in every direction. The glass, heart and rim stay upright to the
// camera; everything spread out has a real x, y and z, so it sorts round the orb from every side.
const v3 = ([x, y, z]) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};
const x3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// a plane tilted by `tilt` from the floor towards azimuth `az`: its unit axes, and a point on its circle at angle g
function tilted(tilt, az) {
  const n = [Math.sin(tilt) * Math.cos(az), -Math.cos(tilt), Math.sin(tilt) * Math.sin(az)];
  const e1 = Math.abs(n[1]) > 0.999 ? [1, 0, 0] : v3(x3(n, [0, -1, 0])), e2 = x3(n, e1);
  return (g, r) => [(Math.cos(g) * e1[0] + Math.sin(g) * e2[0]) * r, (Math.cos(g) * e1[1] + Math.sin(g) * e2[1]) * r, (Math.cos(g) * e1[2] + Math.sin(g) * e2[2]) * r];
}
const RINGS3 = [
  { r: 31, tilt: 0.5, az: 0, beads: 3, turn: 2, c: 0 },
  { r: 27, tilt: 0.62, az: 2.1, beads: 2, turn: -3, c: 1 },
];

export const three = {
  meta: { camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), s = setup(t), { ph, cx, cy } = s, lift = (cy - Y0) / 2, S = o.seed;
    const d0 = q.depth(cx, cy, 0), pulse = 0.85 + 0.15 * Math.sin(ph * TAU * 3);
    // how near a point is on its orbit: 1 in front of the orb, 0 behind it
    const near = (x, y, z, r) => clamp(0.5 - (q.depth(x, y, z) - d0) / (2 * r));
    // the light it throws on the floor, stronger as it bobs down
    q.plane(0, 0, 0, null, 24, (u, v, out) => {
      const d = Math.hypot(u, v) / 22;
      if (d >= 1) return;
      out.l = d < 0.3 ? C[6] : C[5];
      out.k = (1 - d) * (0.55 - 0.1 * lift);
    });
    // the two rings: true circles in tilted planes, far half dim, near half bright, beads running round them
    const beads = [];
    RINGS3.forEach((R, ri) => {
      const at = tilted(R.tilt + 0.1 * Math.sin(ph * TAU + R.c), R.az + 0.25 * Math.sin(ph * TAU * 2 + R.c * 2));
      const n = Math.ceil(R.r * TAU * 0.7), pt = (g) => {
        const [x, y, z] = at(g, R.r);
        return [cx + x, cy + y, z];
      };
      let a = pt(0);
      for (let j = 1; j <= n; j++) {
        const b = pt((j / n) * TAU), f = near((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, R.r);
        q.line(...a, ...b, f > 0.5 ? C[5] : C[4], 0.5 + 0.45 * f);
        a = b;
      }
      for (let b = 0; b < R.beads; b++) {
        const g = ph * TAU * R.turn + (b * TAU) / R.beads;
        for (let k = 0; k < 7; k++) {
          const [x, y, z] = pt(g - Math.sign(R.turn) * k * 0.07), f = near(x, y, z, R.r);
          if (k === 0) {
            q.ball(x, y, z, 1.4, WHITE);
            beads.push([x, y, z, f]);
          } else q.dot(x, y, z, k < 3 ? C[6] : C[5], k < 4 ? 1 : 1 - (k - 3) / 4);
        }
      }
    });
    // motes on inclined orbits, a short trail each
    const motes = [];
    for (let i = 0; i < 8; i++) {
      const dir = i % 2 ? 1 : -1, a = ((i * 2.4 + S) % TAU) + ph * TAU * dir * (1 + (i % 3)), rr = RAD + 5 + ((i * 0.37) % 1) * 12;
      const at = tilted(0.25 + ((i * 0.53) % 1) * 1.1, i * 1.9);
      const P = (g) => {
        const [x, y, z] = at(g, rr);
        return [cx + x, cy + y, z];
      };
      const [x, y, z] = P(a), f = near(x, y, z, rr);
      q.ball(x, y, z, 1.1, f > 0.5 ? WHITE : C[5]);
      for (let k = 1; k <= 3; k++) {
        const [tx, ty, tz] = P(a - dir * k * 0.09);
        q.dot(tx, ty, tz, k < 2 ? (f > 0.5 ? C[6] : C[4]) : C[4], (f > 0.5 ? 1 : 0.6) * (1 - (k - 1) / 3));
      }
      motes.push([x, y, z, f]);
    }
    // the orb: the far side's rim and the glass over everything behind it, then what is inside it
    q.disc(cx, cy, 0, RAD, (d) => (d > 0.82 ? C[2] : C[1]), (d) => 0.32 + 0.5 * d * d);
    // the swirl: two bright arms and two faint ones turning twice a loop, in two planes tilted through the heart
    const spin = ph * TAU * 2, bright = tilted(0.55, 0.5), faint = tilted(0.55, 0.5 + Math.PI / 2 + 0.3);
    for (const [s0, main] of [[0, 1], [Math.PI, 1], [Math.PI / 2, 0], [(3 * Math.PI) / 2, 0]])
      for (let u = 0.08; u <= 0.85; u += 0.012) {
        const aa = spin + s0 + u * 3.4, r = u * RAD * 0.92, fade = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.25, A = main ? bright : faint;
        if (!main) {
          const [x, y, z] = A(aa, r);
          q.dot(cx + x, cy + y, z, C[4], fade * 0.8);
          continue;
        }
        const [xb, yb, zb] = A(aa - 0.16, r), [x, y, z] = A(aa, r);
        q.dot(cx + xb, cy + yb, zb, u < 0.4 ? C[6] : C[5], fade);
        q.dot(cx + x, cy + y, z, u < 0.3 ? WHITE : u < 0.55 ? C[6] : C[5], fade);
      }
    // the heart
    q.ball(cx, cy, 0, 3.6 * pulse + 1, (nx, ny, nz) => (nz > 0.7 ? WHITE : nz > 0.35 ? C[6] : C[5]));
    // the rim, upright to the camera, and the highlights on the face turned towards it
    q.at(cx, cy, 0, (pp) => {
      pp.ring(0, 0, RAD + 0.4, 1, C[5]);
      pp.ring(0, 0, RAD + 1.3, 1, C[2], 0.8);
      pp.z -= RAD * 0.55;
      for (let a = 3.5; a < 4.7; a += 0.03) pp.dot(Math.cos(a) * (RAD - 2.4), Math.sin(a) * (RAD - 2.4), a > 3.85 && a < 4.35 ? WHITE : C[6]);
      pp.z -= RAD * 0.2;
      pp.circle(-RAD * 0.42, -RAD * 0.5, 1.3, WHITE);
      pp.dot(RAD * 0.52, RAD * 0.55, C[6]);
      sparkle(pp, -RAD * 0.42, -RAD * 0.5, 1.5 + Math.max(0, Math.sin(ph * TAU * 2)) * 2, C[6], C[5], 0.3);
    });
    // light: the big soft one, the heart's, the glass's edge, each bead and mote
    q.glow(cx, cy, 0, 60, C[4], 0.36);
    q.glow(cx, cy, 0, 20, C[6], 0.26 * pulse);
    q.at(cx, cy, 0, (pp) => ((pp.z -= RAD), pp.glowRing(0, 0, RAD, 6, C[5], 0.25)));
    for (const [x, y, z, f] of beads) q.glow(x, y, z, f > 0.5 ? 7 : 5, C[6], f > 0.5 ? 0.5 : 0.25);
    for (const [x, y, z, f] of motes) if (f > 0.5) q.glow(x, y, z, 5, C[6], 0.35);
    // sparks drifting off the orb, out in every direction
    cycle(ph * D, D, 10, S * 3 + 1, (g) => g.range(0.6, 1), (age, life, r) => {
      const az = r.range(0, TAU), el = r.range(-1, 1), k = age / life, d = RAD + 1 + k * r.range(8, 18), c = r.chance(0.5) ? C[6] : C[5];
      const dx = Math.cos(az) * Math.cos(el), dy = Math.sin(el), dz = Math.sin(az) * Math.cos(el), x = cx + dx * d, y = cy + dy * d - k * 10, z = dz * d;
      q.line(x - dx * 2, y - dy * 2, z - dz * 2, x, y, z, c, (1 - k) * 0.8);
      q.dot(x, y, z, c, 1 - k);
      q.glow(x, y, z, 3, c, 0.3 * (1 - k));
    });
  },
};
