// The projectile recipe (a hot head, a trail that thins behind it, motes shed along the way, light riding the
// head) is adapted from Sprite Fusion's open-source energy bolt (https://www.spritefusion.com/pixel-art-vfx/energy),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, cycle, fly, clamp, space, TAU, WHITE } from "../../core/index.js";
import { blade, cone3 } from "./_lib.js";

export const meta = {
  name: "Ice lance",
  desc: "A faceted ice spear flying right: a light pulse runs through its core, rings of cold air shear off the tip, frost peels off into a wake and crystals shed behind it.",
  tags: ["ice", "lance", "spear", "projectile", "directional", "magic", "loop"],
  size: [176, 64],
  origin: [146, 32],
  duration: 0.8,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#dcfbff", "#ffffff"], length: 40, seed: 13 },
};

// the spear: a hexagonal shaft seen from the side, row by row (a white top edge, a lit upper facet, a bright
// ridge, a cool lower facet, a deep keel, a dark rim), a long cutting point, a light pulse running through
// its ridge to the tip, a glint sliding back along the top
function spear(p, C, L, pulse, glint) {
  const T = 16, H = 3.5;
  const half = (x) => (x > -T ? H * (-x / T) + 0.3 : x < -L + 3 ? H * (0.7 + 0.3 * ((x + L) / 3)) : H);
  p.shade(-L - 1, -H - 2, 1, H + 2, (x, y, o) => {
    if (x > 0 || x < -L) return;
    const h = half(x);
    if (Math.abs(y) > h + 0.5) {
      if (Math.abs(y) < h + 1.5) o.c = C[1];
      return;
    }
    const v = y / Math.max(0.5, h);
    if (x > -1.5) return (o.c = WHITE);
    // three faces lit from above: a pale top facet, a mid front facet with a bright ridge, a deep underside
    if (v > -0.3 && v < 0.35 && Math.abs(x - pulse) < 2.5) return (o.c = WHITE);
    if (v < -0.3 && Math.abs(x - glint) < 1) return (o.c = WHITE);
    o.c = v < -0.72 ? WHITE : v < -0.36 ? C[6] : v < -0.18 ? C[7] : v < 0.38 ? C[4] : v < 0.78 ? C[2] : C[1];
  });
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), D = meta.duration, S = o.seed, L = o.length, ph = t / D;
  // the wake: a ribbon of frost narrowing behind the spear, with cold light in it
  p.each(-L - 100, -12, -L + 4, 12, (x, y, sx, sy) => {
    const u = (-L + 4 - x) / 104, w = 4.5 * (1 - u) ** 0.7 + 0.5 + 1.5 * Math.sin(u * 9 - ph * TAU * 2) * u, v = Math.abs(y) / w;
    if (v >= 1) return;
    const a = (1 - v * v) * (1 - u) ** 1.4;
    if (a < 0.04) return;
    p.blendPx(sx, sy, v < 0.25 && u < 0.4 ? C[6] : v < 0.6 ? C[5] : C[4], a * 0.7);
    if (a > 0.3) p.add(sx, sy, C[5], 0.12 * a);
  });
  p.glowLine(-L - 60, 0, 0, 0, 14, C[4], 0.22);
  // frost peeling off the shaft into soft puffs left behind
  cycle(t, D, 14, S, (g) => g.range(0.35, 0.55), (age, life, r) => {
    const x0 = r.range(-L + 2, -8), [x, y] = fly(x0, r.range(-2.5, 2.5), -r.range(150, 230), r.sign() * r.range(8, 30), age, 0, 2.2);
    const k = age / life, rad = 1.2 + 5.5 * k, a = 0.5 * (1 - k) ** 1.3;
    p.disc(x, y, rad, k < 0.3 ? C[6] : C[5], (d) => a * (1 - d * d));
    p.glow(x, y, rad * 1.6, C[4], 0.1 * (1 - k));
  });
  // crystals shed along the way: short tumbling shards with a white edge, glinting, falling back
  cycle(t, D, 9, S + 1, (g) => g.range(0.4, 0.6), (age, life, r) => {
    const [x, y] = fly(r.range(-L, -6), r.range(-3, 3), -r.range(170, 260), r.range(-35, 35), age, 60, 1.2);
    const k = age / life, a = r.range(0, TAU) + age * r.range(10, 18) * r.sign(), l = r.range(1.2, 2.2), ca = Math.cos(a), sa = Math.sin(a);
    if (k > 0.85 && (age * 30) % 2 < 1) return;
    p.line(x - ca * l, y - sa * l, x + ca * l, y + sa * l, C[5]);
    p.px(x + ca * l, y + sa * l, WHITE);
    if (Math.cos(a * 2) > 0.9) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(x + dx, y + dy, C[6]);
      p.glow(x, y, 6, C[5], 0.45);
    }
  });
  // speed lines: the air streaming past above and below
  cycle(t, D, 12, S + 2, (g) => g.range(0.16, 0.26), (age, life, r) => {
    const y = r.sign() * r.range(4, 13), x = r.range(-20, 0) - age * r.range(280, 380), l = r.range(6, 16), k = age / life;
    p.line(x, y, x + l, y, (u) => (u > 0.7 ? C[6] : C[4]), (u) => u * (1 - k) * 1.4);
  });
  // rings of cold air shearing off the point and sliding back along the shaft: the near arc bright, the far dim
  for (let i = 0; i < 3; i++) {
    const q = (ph * 3 + i / 3) % 1, x = -4 - q * (L + 20), ry = 4.5 + q * 8, rx = 1.2 + q * 2.6;
    if (q > 0.8) continue;
    for (let k = 0; k < 40; k++) {
      const an = (k / 40) * TAU, px = x + Math.cos(an) * rx, py = Math.sin(an) * ry;
      if (Math.abs(py) < 4.6 && px > -L - 2) continue;
      p.px(px, py, Math.cos(an) > 0 ? (q < 0.35 ? WHITE : C[6]) : q < 0.4 ? C[5] : C[4]);
    }
    p.glowRing(x, 0, ry * 0.75, 3, C[5], 0.14 * (1 - q));
  }
  // the ice fletching at the back: three shards fanning out behind the shaft
  for (const [dy, l, w] of [[-1, 10, 4], [1, 9, 4], [-0.2, 6, 3]]) blade(p, -L + 3, dy * 1.5, -L + 3 - l, dy * (2 + l * 0.5), w, C);
  // the spear itself, a pulse of light running through it, a glint sliding back along the top
  const pulse = -L + ((ph * 2) % 1) * (L + 6), glint = -((ph * 2 + 0.5) % 1) * L * 1.2;
  spear(p, C, L, pulse, glint);
  p.glowLine(-L, 0, 0, 0, 10, C[4], 0.1);
  p.glow(pulse, 0, 8, C[6], 0.3);
  p.glow(0, 0, 8, WHITE, 0.4);
  p.glow(-L * 0.4, 0, 30, C[3], 0.16);
}

// 3D: a real hexagonal spear flying +x: a faceted shaft and long point (the facets turn to the light as the camera
// goes round), four ice blades splayed round the tail, rings of cold air that are true circles round the axis, a wake
// that spirals back, frost and shed crystals thrown out all the way round it, speed lines parallel to the flight.
export const three = {
  meta: { size: [184, 100], origin: [92, 70], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), D = meta.duration, S = o.seed, L = o.length, ph = t / D;
    const Y = -22, WAKE = 84, TX = (L + WAKE) / 2, R = 4.6, T = 18, spin = (ph * TAU) / 2;
    const radial = (a, r) => [Y - Math.cos(a) * r, -Math.sin(a) * r]; // about the x axis, as cone3's phase turns
    const wy = (u) => Math.sin(u * 9 - ph * TAU * 2) * 1.6 * u, wz = (u) => Math.cos(u * 9 - ph * TAU * 2) * 1.6 * u;
    // its shadow slides along the floor under it
    q.plane(TX - L * 0.5 - 4, 0, 0, null, L / 2 + 16, (u, v, out) => {
      const d = (u / (L / 2 + 10)) ** 2 + (v / 4.5) ** 2;
      if (d > 1) return;
      out.c = C[0];
      out.a = 0.4 * (1 - d);
      out.blend = true;
    });
    // the spear: shaft and point share six facets; a highlight slides back along the shaft
    const gpos = TX - ((ph * 2 + 0.5) % 1) * L * 1.2, gu = (gpos - (TX - L)) / (L - T);
    cone3(q, [TX - L, Y, 0], [TX - T, Y, 0], R, R, C, { sides: 6, phase: 0.4 + spin, glint: gu >= 0 && gu <= 1 ? gu : -1 });
    cone3(q, [TX - T, Y, 0], [TX, Y, 0], R, 0, C, { sides: 6, phase: 0.4 + spin, cap: false });
    // the ice fletching: four blades splayed round the tail
    [13, 11, 13, 11].forEach((l, i) => {
      const a = 0.4 + spin + (i * TAU) / 4, [y0, z0] = radial(a, 1.5), [y1, z1] = radial(a, 2.5 + l * 0.55);
      cone3(q, [TX - L + 3, y0, z0], [TX - L + 3 - l, y1, z1], 2.2, 0, C, { sides: 4, phase: a, dim: i % 2 });
    });
    // crystals shed along the way: small tumbling bipyramids thrown out all round, falling back
    cycle(t, D, 9, S + 1, (g) => g.range(0.4, 0.6), (age, life, r) => {
      const x0 = TX + r.range(-L, -6), an = r.range(0, TAU), sp = r.range(0, 35), vx = -r.range(170, 260);
      const [x, y] = fly(x0, Y + r.range(-3, 3), vx, -Math.cos(an) * sp, age, 60, 1.2), z = fly(0, 0, 0, -Math.sin(an) * sp, age, 0, 1.2)[1];
      const k = age / life, a = r.range(0, TAU) + age * r.range(10, 18) * r.sign(), l = r.range(1.4, 2.4), cb = r.range(0, TAU);
      if (k > 0.85 && (age * 30) % 2 < 1) return;
      const dx = Math.cos(a) * Math.cos(cb) * l, dy = Math.sin(a) * l, dz = Math.cos(a) * Math.sin(cb) * l;
      cone3(q, [x, y, z], [x + dx, y + dy, z + dz], 0.9, 0, C, { sides: 4, phase: a, dim: 0 });
      cone3(q, [x, y, z], [x - dx, y - dy, z - dz], 0.9, 0, C, { sides: 4, phase: a, dim: 1 });
      if (Math.cos(a * 2) > 0.9) {
        q.at(x, y, z, (pp) => {
          pp.z -= 3;
          for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pp.px(ax * 2, ay * 2, C[6]);
        });
        q.glow(x, y, z, 6, C[5], 0.45);
      }
    });
    // rings of cold air shearing off the point and sliding back: true circles in planes across the flight
    const V1 = q.view(0, 0, -1), V2 = q.view(0, 1, 0);
    for (let i = 0; i < 3; i++) {
      const g = (ph * 3 + i / 3) % 1;
      if (g > 0.8) continue;
      const x = TX - 4 - g * (L + 20), rr = 7 + g * 9;
      q.ring(x, Y, 0, rr, 2, (v, an) => (Math.cos(an) * V1[2] + Math.sin(an) * V2[2] > 0 ? (g < 0.35 ? WHITE : C[6]) : g < 0.4 ? C[5] : C[4]), (v, an) => (Math.cos(an) * V1[2] + Math.sin(an) * V2[2] > 0 ? 1.2 - g : 0.9 - g * 0.6), [1, 0, 0]);
    }
    // the light pulse running through the shaft to the tip: a bright band round it
    const pulse = TX - L + ((ph * 2) % 1) * (L + 6);
    if (pulse < TX - 2) q.ring(pulse, Y, 0, pulse < TX - T ? R + 1.2 : (R * (TX - pulse)) / T + 1.2, 1.5, WHITE, 0.9, [1, 0, 0]);
    // speed lines: the air streaming past all round the shaft
    cycle(t, D, 12, S + 2, (g) => g.range(0.16, 0.26), (age, life, r) => {
      const [y, z] = radial(r.range(0, TAU), r.range(5, 14)), x = TX + r.range(-20, 0) - age * r.range(280, 380), l = r.range(6, 16), k = age / life;
      q.line(x, y, z, x + l, y, z, (u) => (u > 0.7 ? C[6] : C[4]), (u) => u * (1 - k) * 1.4);
    });
    // light
    q.glowLine(TX - L - 60, Y, 0, TX, Y, 0, 14, C[4], 0.14);
    q.glowLine(TX - L, Y, 0, TX, Y, 0, 10, C[4], 0.04);
    q.glow(pulse, Y, 0, 8, C[6], 0.18);
    q.glow(TX, Y, 0, 7, WHITE, 0.25);
    q.glow(TX - L * 0.4, Y, 0, 30, C[3], 0.1);
    // translucent last, far to near: the wake spiralling back and frost peeling off the shaft in every direction
    const puffs = [];
    for (let i = 0; i < 18; i++) {
      const u = i / 18, w = 4.5 * (1 - u) ** 0.7 + 0.5 + 1.5 * Math.sin(u * 9 - ph * TAU * 2) * u;
      puffs.push({ x: TX - L + 4 - u * WAKE, y: Y + wy(u), z: wz(u), r: w * 1.1 + 1, a: 0.34 * (1 - u) ** 1.2, u });
    }
    cycle(t, D, 14, S, (g) => g.range(0.35, 0.55), (age, life, r) => {
      const x0 = TX + r.range(-L + 2, -8), an = r.range(0, TAU), sp = r.range(8, 30), vx = -r.range(150, 230), f = (1 - Math.exp(-2.2 * age)) / 2.2;
      const k = age / life;
      puffs.push({ x: x0 + vx * f, y: Y - Math.cos(an) * sp * f, z: -Math.sin(an) * sp * f, r: 1.2 + 5.5 * k, a: 0.5 * (1 - k) ** 1.3, k, glow: 0.1 * (1 - k) });
    });
    for (const s of q.sort(puffs, (s) => [s.x, s.y, s.z])) {
      q.disc(s.x, s.y, s.z, s.r, (d) => (d < 0.35 && (s.u ?? s.k) < 0.4 ? C[6] : d < 0.7 ? C[5] : C[4]), (d) => s.a * (1 - d * d));
      if (s.glow) q.glow(s.x, s.y, s.z, s.r * 1.6, C[4], s.glow);
    }
  },
};
