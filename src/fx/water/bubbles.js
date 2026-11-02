// The bubble shading (a lit rim top-left, a shaded rim bottom-right, a see-through body, a highlight and a
// refraction fleck, 2x2 and 1 px forms when small) and the surface line are adapted from Sprite Fusion's
// open-source bubbles (https://www.spritefusion.com/pixel-art-vfx/bubbles), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, cycle, clamp, smooth, rand, space, lit, TAU, WHITE } from "../../core/index.js";
import { WATER, ROCK, ring3, rock } from "./_lib.js";

export const meta = {
  name: "Bubbles",
  desc: "Bubbles stream up from a vent of pebbles, wobbling and swelling as they rise, flare as they cross shafts of light from the surface, then dome up and pop there.",
  tags: ["water", "bubbles", "underwater", "vent", "ambient", "loop"],
  size: [104, 112],
  origin: [52, 104],
  duration: 4,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: WATER, seed: 4 },
};

const D = meta.duration, TOP = -92, HALF = 48;

// the surface: a wavy lit line, a darker band under it
const surfaceY = (x, ph) => TOP + Math.sin(x * 0.13 + ph * TAU * 2) * 1.1 + Math.sin(x * 0.051 - ph * TAU) * 1.3;
// light shafts slanting down from the surface, drifting: how much of one a point is in
const shaft = (x, y, ph) => {
  const u = x + (y - TOP) * 0.32, s = Math.sin(u * 0.16 + ph * TAU) * 0.6 + Math.sin(u * 0.07 - ph * TAU + 1) * 0.4;
  return Math.max(0, s - 0.35) / 0.65;
};

// one bubble at (x, y), radius r, squash q: tiny ones a pixel or a shaded 2x2, bigger ones a lit rim round a
// see-through body with a highlight and a fleck of light refracted through it
function bubble(p, C, x, y, r, q, lit) {
  if (r < 0.9) return p.px(x, y, lit > 0.3 ? WHITE : r < 0.7 ? C[5] : C[6]);
  if (r < 1.5) {
    const X = Math.floor(x), Y = Math.floor(y);
    p.px(X, Y, WHITE);
    p.px(X + 1, Y, C[6]);
    p.px(X, Y + 1, C[5]);
    p.px(X + 1, Y + 1, C[4]);
    p.glow(x + 0.5, y + 0.5, 3, C[5], 0.12 + 0.2 * lit);
    return;
  }
  const rx = r * (1 + q), ry = r * (1 - q);
  p.shade(x - rx - 1, y - ry - 1, x + rx + 1, y + ry + 1, (px, py, out) => {
    const dx = (px - x) / rx, dy = (py - y) / ry, d = Math.hypot(dx, dy) * r;
    if (d > r + 0.5) return;
    const l = (-dx - dy) / Math.SQRT2 / Math.max(0.01, d / r);
    if (d > r - 0.6) out.c = l > 0.45 ? C[6] : l < -0.55 ? C[3] : C[4];
    else p.blend(px, py, C[5], 0.16 + 0.2 * lit);
  });
  p.px(Math.round(x - rx * 0.45), Math.round(y - ry * 0.45), WHITE);
  if (r >= 2.5) p.px(Math.round(x - rx * 0.45) + 1, Math.round(y - ry * 0.45), C[6]);
  if (r >= 2) p.px(Math.round(x + rx * 0.5), Math.round(y + ry * 0.5), C[6]);
  p.glow(x, y, r * 2.4 + 2, C[5], 0.12 + 0.3 * lit);
}

// the bubbles, from the vent's three mouths: each rises faster the bigger it is, swells as the pressure drops,
// wobbles side to side, and pops at the surface
const MOUTHS = [-5, 1, 6];
function each(t, S, fn) {
  cycle(t, D, 46, S, (g) => g.range(2.2, 3.4), (age, life, r, i) => {
    const m = MOUTHS[i % 3], r0 = r.next() < 0.7 ? r.range(0.5, 1.4) : r.range(1.6, 2.6), vy = 30 + 9 * r0 + r.range(-4, 4);
    const wf = r.range(3, 6), wa = 0.8 + r0 * 1.2, ph0 = r.range(0, TAU), drift = r.range(-4, 4);
    const y = -2 - vy * age, k = clamp(-y / -TOP), x = m + drift * k + Math.sin(age * wf + ph0) * wa * k;
    fn({ x, y, r: r0 * (1 + 0.45 * k), q: 0.12 * Math.sin(age * wf * 2 + ph0) * Math.min(1, r0 / 2), i, age, vy });
  });
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), ph = t / D;
  // the water: deeper toward the floor, light falling through it in shafts
  for (let Y = TOP - 2; Y < 0; Y++)
    for (let X = -HALF; X < HALF; X++) {
      const x = X + 0.5, y = Y + 0.5, sy = surfaceY(x, ph);
      if (y < sy) continue;
      const e = 1 - smooth(HALF - 14, HALF, Math.abs(x)), depth = (y - TOP) / -TOP;
      p.blend(x, y, C[1], (0.22 + 0.22 * depth) * e);
      const s = shaft(x, y, ph) * (1 - depth * 0.7) * e;
      if (s > 0.05) p.light(x, y, C[4], 0.2 * s);
    }
  // where the shafts reach the floor, caustic light dances on it
  for (let X = -HALF; X < HALF; X++) {
    const x = X + 0.5, e = 1 - smooth(HALF - 14, HALF, Math.abs(x)), s = shaft(x, -2, ph);
    const c = Math.max(0, 1 - Math.abs(Math.sin(x * 0.42 + Math.sin(x * 0.11 + ph * TAU * 2) * 2.2)) * 2.4);
    if (s * c * e > 0.05) {
      p.light(x, -1, C[5], 0.5 * s * c * e);
      p.light(x, -2, C[4], 0.25 * s * c * e);
      p.light(x, 0, C[4], 0.3 * s * c * e);
    }
  }
  // the vent: a little heap of pebbles round a dark mouth
  const ST = rock();
  for (const [x, y, rr] of [[-9, -1.5, 2.4], [-4, -1, 1.8], [3.5, -1.2, 2.2], [9, -1.4, 2.6], [0, -0.6, 1.4], [-12.5, -0.8, 1.6]])
    p.shade(x - rr - 1, y - rr - 1, x + rr + 1, y + rr + 1, (px, py, out) => {
      const dx = px - x, dy = py - y, d = Math.hypot(dx * 1.1, dy);
      if (d > rr + 0.7 || py > 0) return;
      out.c = d > rr ? ST[0] : dx + dy < -rr * 0.6 ? ST[5] : dx + dy < rr * 0.3 ? ST[3] : ST[2];
    });
  for (const m of MOUTHS) p.px(m, -1, ST[0]);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), ph = t / D, S = o.seed;
  // specks drifting in the water, flaring in the light
  cycle(t, D, 26, S + 7, D, (age, life, r) => {
    const x = r.range(-HALF + 6, HALF - 6) + Math.sin((age / D) * TAU + r.range(0, TAU)) * 3, y = TOP + 6 + ((r.range(0, 86) + age * 4) % 86);
    const s = shaft(x, y, ph), tw = Math.sin((age / D) * TAU * 3 + r.range(0, TAU));
    if (tw < -0.3 && s < 0.2) return;
    p.px(x, y, s > 0.4 ? WHITE : tw > 0.6 ? C[5] : C[4]);
    if (s > 0.4) p.glow(x, y, 3, C[5], 0.25 * s);
  });
  // the bubbles; when one reaches the surface it domes up, then pops with a ring and a couple of flecks
  each(t, S, (b) => {
    const sy = surfaceY(b.x, ph);
    if (b.y > sy + b.r) bubble(p, C, b.x, b.y, b.r, b.q, shaft(b.x, b.y, ph));
    else {
      const since = (sy + b.r - b.y) / b.vy;
      if (since < 0.12 && b.r >= 1.4) {
        for (let a = Math.PI; a <= TAU + 0.01; a += 0.4 / b.r) p.px(b.x + Math.cos(a) * b.r, sy + Math.sin(a) * b.r * 0.9, C[6]);
        p.px(b.x - b.r * 0.4, sy - b.r * 0.6, WHITE);
      } else if (since < (b.r >= 1.4 ? 0.32 : 0.2)) {
        const k = clamp((since - (b.r >= 1.4 ? 0.12 : 0)) / 0.2), w = Math.max(1, b.r + 1 + k * 4);
        for (let a = 0; a < Math.PI; a += 0.5 / w) if (Math.sin(a) > 0.15) p.dot(b.x + Math.cos(a) * w, sy + Math.sin(a) * w * 0.3, k < 0.4 ? WHITE : C[5], 1.2 - k);
        if (b.r >= 1.4 && k < 0.6) {
          p.px(b.x - 2, sy - 2 - k * 4, C[6]);
          p.px(b.x + 2, sy - 3 - k * 5, C[6]);
        }
      }
    }
  });
  // the surface: a lit line with glints running along it, a darker band under it
  for (let X = -HALF; X < HALF; X++) {
    const x = X + 0.5, y = surfaceY(x, ph), e = 1 - smooth(HALF - 12, HALF, Math.abs(x));
    const glint = Math.sin(x * 0.37 - ph * TAU * 3) * Math.sin(x * 0.13 + ph * TAU) > 0.55;
    p.dot(X, y, glint ? WHITE : C[5], e * 1.3);
    p.dot(X, y + 1, C[3], e * 1.3);
    if ((X & 3) === 0) p.glow(x, y + 1, 7, C[5], (glint ? 0.22 : 0.1) * e);
  }
}

// 3D: a column of water you can walk round. Bubbles leave the vent's three mouths on real helical paths (x and z wobble
// together), the surface is a translucent plane with wavy light lines and glints where a bubble domes up and pops with a
// true ring and flecks, the vent is a heap of lit pebbles, shafts of light slant down from the surface as beams and
// land on the floor as caustics, and specks drift at real positions through the water.
const SR = 44, ZM = [3, -4, 2], SLANT = [16, 90, 7];
const PEBBLES = [[-9, 1, 2.4], [-4, -6, 1.8], [3.5, 5, 2.2], [9, -3, 2.6], [0, -1, 1.4], [-12.5, 4, 1.6], [-7, 8, 2], [6, -8, 1.8], [12, 6, 1.7], [-2, 9, 1.6]];

// the shafts of light: six beams from the surface, circling slowly; start and floor point of each, and how strong now
const beams = (ph) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * TAU * 1.7 + 0.4 + (i % 2 ? -1 : 1) * ph * TAU, r = 13 + 15 * ((i * 5) % 3) / 2, x0 = Math.cos(a) * r, z0 = Math.sin(a) * r;
    return { x0, z0, x1: x0 + SLANT[0], z1: z0 + SLANT[2], k: 0.55 + 0.45 * Math.sin(ph * TAU + i * 2.3) };
  });
// how much of a shaft a point is in (0..1)
const inShaft = (bs, x, y, z) => {
  let s = 0;
  const f = clamp((y - TOP) / SLANT[1]);
  for (const b of bs) {
    const d = Math.hypot(x - (b.x0 + (b.x1 - b.x0) * f), z - (b.z0 + (b.z1 - b.z0) * f));
    s = Math.max(s, b.k * Math.max(0, 1 - d / 9) ** 1.3);
  }
  return s * (1 - f * 0.5);
};

// the bubbles on helical paths: the same rising, swelling and wobble as each(), with z swinging a quarter turn behind x
function each3(t, S, fn) {
  cycle(t, D, 46, S, (g) => g.range(2.2, 3.4), (age, life, r, i) => {
    const m = MOUTHS[i % 3], r0 = r.next() < 0.7 ? r.range(0.5, 1.4) : r.range(1.6, 2.6), vy = 30 + 9 * r0 + r.range(-4, 4);
    const wf = r.range(3, 6), wa = 0.8 + r0 * 1.2, ph0 = r.range(0, TAU), drift = r.range(-4, 4), dz = r.range(-4, 4);
    const y = -2 - vy * age, k = clamp(-y / -TOP);
    fn({ x: m + drift * k + Math.sin(age * wf + ph0) * wa * 1.5 * k, z: ZM[i % 3] + dz * k + Math.cos(age * wf + ph0) * wa * 1.5 * k, y, r: r0 * (1 + 0.45 * k), q: 0.12 * Math.sin(age * wf * 2 + ph0) * Math.min(1, r0 / 2), i, age, vy });
  });
}

export const three = {
  meta: { size: [104, 128], origin: [52, 108], camera: { pitch: 0.4 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), ph = t / D, S = o.seed, T = ph * TAU, bs = beams(ph), ST = rock();
    // the surface's lit lines and glints, as a function of where on it
    const glintAt = (x, z) => Math.sin(x * 0.9 - T * 3 + Math.sin(z * 0.37 + T) * 2.2) * Math.sin(z * 0.8 + T * 2 + Math.sin(x * 0.29 - T) * 2.2) > 0.96;
    // the floor: caustic light where each shaft lands, a web of bright lines dancing on it
    q.plane(0, 0, 0, null, SR, (x, z, out) => {
      let s = 0;
      for (const b of bs) s = Math.max(s, b.k * Math.max(0, 1 - Math.hypot(x - b.x1, z - b.z1) / 14) ** 1.4);
      if (s < 0.03) return;
      const c = Math.max(0, 1 - Math.abs(Math.sin(x * 0.42 + Math.sin(z * 0.37 + T * 2) * 2.2)) * 2.4);
      if (s * c > 0.05) (out.l = C[5]), (out.k = 0.85 * s * c + 0.15 * s);
      else (out.l = C[4]), (out.k = 0.18 * s);
    });
    // the vent: a heap of pebbles round three dark mouths
    for (const m of MOUTHS.map((x, i) => [x, ZM[i]])) q.plane(m[0], -0.4, m[1], null, 2.2, (u, v) => (Math.hypot(u, v) > 1.5 ? ST[2] : ST[0]));
    for (const [x, z, r] of PEBBLES) q.ball(x, -r * 0.9, z, r * 1.3, lit(ROCK));
    // specks drifting in the water, flaring in the light
    cycle(t, D, 26, S + 7, D, (age, life, r) => {
      let x = r.range(-HALF + 6, HALF - 6) + Math.sin((age / D) * TAU + r.range(0, TAU)) * 3;
      const y = TOP + 6 + ((r.range(0, 86) + age * 4) % 86), tw = Math.sin((age / D) * TAU * 3 + r.range(0, TAU));
      let z = r.range(-HALF + 6, HALF - 6) + Math.cos((age / D) * TAU + r.range(0, TAU)) * 3;
      const h = Math.hypot(x, z);
      if (h > SR - 6) (x *= (SR - 6) / h), (z *= (SR - 6) / h);
      const s = inShaft(bs, x, y, z);
      if (tw < -0.3 && s < 0.2) return;
      q.px(x, y, z, s > 0.4 ? WHITE : tw > 0.6 ? C[5] : C[4]);
      if (s > 0.4) q.glow(x, y, z, 3, C[5], 0.25 * s);
    });
    // the bubbles, far to near; one that reaches the surface domes up, then pops with a ring and flecks
    const all = [];
    each3(t, S, (b) => all.push(b));
    for (const b of q.sort(all, (v) => [v.x, v.y, v.z])) {
      if (b.y > TOP + b.r) {
        q.at(b.x, b.y, b.z, (pp, k) => bubble(pp, C, 0, 0, b.r * k, b.q, inShaft(bs, b.x, b.y, b.z)));
        continue;
      }
      const since = (TOP + b.r - b.y) / b.vy, big = b.r >= 1.4, a1 = b.i * 2.399;
      if (since < 0.12 && big) {
        q.at(b.x, TOP - b.r * 0.4, b.z, (pp, k) => {
          bubble(pp, C, 0, 0, b.r * k, -0.2, 0.5);
          pp.px(Math.round(-b.r * 0.4 * k), Math.round(-b.r * 0.6 * k), WHITE);
        });
      } else if (since < (big ? 0.32 : 0.2)) {
        const k = clamp((since - (big ? 0.12 : 0)) / 0.2);
        ring3(q, b.x, b.z, Math.max(1, b.r + 1 + k * 4), 1.1 * (1.2 - k) * 0.85, C, { n: 1, seed: b.i, hot: k < 0.4, y: TOP });
        if (big && k < 0.6)
          for (let f = 0; f < 3; f++) q.px(b.x + Math.cos(a1 + f * 2.1) * (2 + k * 3), TOP - 2 - k * (4 + f), b.z + Math.sin(a1 + f * 2.1) * (2 + k * 3), C[6]);
      }
    }
    // the surface: a see-through sheet with wavy lit lines, a bright meniscus round the wall and glints running over it
    q.plane(0, TOP, 0, null, SR, (x, z, out) => {
      const rho = Math.hypot(x, z) / SR, w = Math.sin(x * 0.11 + Math.sin(z * 0.09 + T) * 1.2 - T * 2) * Math.sin(z * 0.14 - x * 0.05 + T);
      out.blend = true;
      if (rho > 0.95) {
        out.c = glintAt(x * 2, z * 2) ? WHITE : C[5];
        out.a = 0.9;
        return;
      }
      if (glintAt(x, z) && w > 0) return void ((out.c = WHITE), (out.a = 0.9));
      if (Math.abs(w - 0.45) < 0.06) return void ((out.c = C[5]), (out.a = 0.55));
      if (Math.abs(w + 0.45) < 0.06) return void ((out.c = C[2]), (out.a = 0.5));
      out.c = C[3];
      out.a = 0.09 + 0.07 * (0.5 + 0.5 * w);
    });
    // the column's wall, as faint lit seams from the meniscus down to a ring on the floor
    q.ring(0, 0, 0, SR - 0.5, 1.3, C[3], 0.35);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3, x = Math.cos(a) * (SR - 1), z = Math.sin(a) * (SR - 1);
      q.line(x, TOP, z, x, -1, z, (u) => (u < 0.1 ? C[5] : C[3]), (u) => 0.4 * (1 - u) * (1 - u) + 0.06);
    }
    // light: the column's blue, shafts of light from the surface to the floor, glints on the surface
    q.glowLine(0, TOP + 4, 0, 0, -4, 0, 40, C[3], 0.1);
    for (const b of bs) q.glowLine(b.x0, TOP + 1, b.z0, b.x1, -2, b.z1, 8, C[4], 0.2 * b.k);
    for (let x = -40; x <= 40; x += 4)
      for (let z = -40; z <= 40; z += 4) if (x * x + z * z < 1600 && glintAt(x, z)) q.glow(x, TOP, z, 6, C[5], 0.2);
  },
};
