// Things that flutter down (a fall timed to land as their time in the air runs out, a flip by squashing across,
// a rest on the ground and a fade) after Sprite Fusion's open-source falling leaves
// (https://www.spritefusion.com/pixel-art-vfx/falling-leaves), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, smooth, rand, wrap, mix, fbm, space, TAU, WHITE, hex } from "../../core/index.js";
import { clip, rows, trips, bakeFloor3, layFloor3, orient3, tumble3 } from "./_lib.js";

export const meta = {
  name: "Cherry blossoms",
  desc: "Pink petals flutter down on a spring breeze, tumbling in little spirals and flashing as they catch the light, with a few whole blossoms spinning among them.",
  tags: ["weather", "cherry blossom", "sakura", "petals", "spring", "wind", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 10,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#4a1832", "#8e3460", "#d26a94", "#f2a2c0", "#ffd2e2", "#fff4f8"],
    seed: 12,
  },
};

const D = 10, FLOOR = 1;
const gust = (t) => 22 * Math.sin((TAU * t) / D + 0.4) + 7 * Math.sin((TAU * 2 * t) / D - 1);

export function drawBack(p, t, o) {
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 6);
  // a soft plum dusk, so the sky's stars don't read as petals
  const top = hex("#0e0a14"), low = mix(hex("#1a0e1a"), C[0], 0.4);
  rows(p, meta, -170, 9, (y, R) => {
    const k = (y + 170) / 180;
    R.c.fill(mix(top, low, k * k));
    R.a.fill(0.3 + 0.12 * k);
    R.b.fill(1);
  });
  scatter(q, S, C);
  petals(q, t, S, C, 0);
}

export function draw(p, t, o) {
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 6);
  petals(q, t, S, C, 1);
  blossoms(q, t, S, C);
}

// petals: each tumbles in a little spiral as it falls and drifts on the breeze, flipping fast; turned full face
// to the light it flashes
function petals(q, t, S, C, near) {
  const n = near ? 54 : 90, sd = S * 7 + near;
  trips(t, D, n, sd, 1, 2, (u, k, m, i) => {
    const j = wrap(k, m), R = (c) => rand(sd, i, j, c), dur = D / m, tf = dur * 0.84, a = Math.min(u * dur, tf), rest = u * dur - tf;
    const born = t - u * dur, x0 = -200 + R(1) * 330, y0 = -184, vy = (FLOOR + (near ? 2 : 0) - y0) / tf, vx = 9 + R(2) * 10;
    const rho = (near ? 3 : 2) + R(3) * 3, w = 2.2 + R(4) * 2.8, ph = R(5) * TAU, gk = near ? 1 : 0.6;
    const at = (aa) => [x0 + vx * aa + (gust(born + aa) - gust(born)) * gk + rho * Math.cos(w * aa + ph), y0 + vy * aa + rho * 0.6 * Math.sin(w * aa + ph)];
    const len = (near ? 3.6 : 2.6) + R(6) * 1.1;
    if (rest > 0) {
      const [x, y] = at(tf);
      // a landed petal settles and shrinks away (no dither, so the ground stays clean)
      const fade = 1 - rest / (dur - tf);
      return void (fade > 0.15 && petal(q, x, y, len * (0.35 + 0.65 * fade), (R(7) - 0.5) * 1.2, 0.5, C, 1));
    }
    const [x, y] = at(a), flip = Math.cos(R(8) * TAU + a * (3 + R(9) * 5)), ang = R(10) * TAU + a * (R(11) - 0.5) * 3;
    petal(q, x, y, len, ang, flip, C, 1);
    if (flip > 0.9) {
      const g = (flip - 0.9) / 0.1;
      q.px(x, y - 1, WHITE);
      q.glow(x, y, near ? 7 : 5, C[4], (near ? 0.32 : 0.22) * g);
    }
  });
}

// a petal: a little notched teardrop, squashed across as it flips; its pale face or its deeper back
function petal(q, x, y, len, ang, flip, C, a) {
  const fs = 0.3 + 0.7 * Math.abs(flip), back = flip < -0.2, c = Math.cos(ang), s = Math.sin(ang), e = len + 1;
  // deeper at the base, palest at the tip, lit on one side; the back is a step deeper all over
  const face = back ? [C[1], C[2], C[3]] : [C[2], C[3], C[4]], tip = back ? C[3] : C[5];
  q.shade(x - e, y - e, x + e, y + e, (px, py, out) => {
    const dx = px - x, dy = py - y, u = (dx * c + dy * s) / len, v = (-dx * s + dy * c) / (len * fs);
    if (u < -1 || u > 1) return;
    const hw = 0.55 * Math.sqrt(1 - u * u) * (1 + 0.35 * u);
    if (Math.abs(v) > hw || (u > 0.7 && Math.abs(v) < 0.12)) return;
    out.c = u > 0.45 && v < 0.1 ? tip : u < -0.45 ? face[0] : v < 0 ? face[2] : face[1];
    out.a = a;
  });
}

// a whole blossom: five petals round a gold heart, spinning slowly as it sinks
function blossoms(q, t, S, C) {
  trips(t, D, 7, S * 31, 1, 1, (u, k, m, i) => {
    const R = (c) => rand(S * 31, i, c), y = -190 + (FLOOR + 2 + 190) * Math.min(1, u / 0.9), born = t - u * D;
    if (u > 0.9) return;
    const x = -190 + R(1) * 330 + 14 * u * D * 0.1 + (gust(t) - gust(born)) + 6 * Math.sin(u * TAU * 2 + R(2) * 6), rot = R(3) * TAU + u * D * (R(4) - 0.5) * 2;
    const r = 3.6 + R(5) * 1.2;
    for (let p = 0; p < 5; p++) {
      const an = rot + (p * TAU) / 5;
      petal(q, x + Math.cos(an) * r * 0.75, y + Math.sin(an) * r * 0.75, r * 0.7, an, 1, C, 1);
    }
    q.px(x, y, hex("#ffe08a"));
    q.glow(x, y, 8, C[4], 0.2);
  });
}

// petals already fallen, scattered along the floor; they never move, so they're shaded once and replayed
const SCATTER = new Map();
function scatter(q, S, C) {
  const key = S + C.join();
  let px = SCATTER.get(key);
  if (!px) {
    px = [];
    const rec = {
      shade(x0, y0, x1, y1, fn) {
        const o = { c: 0, a: 1 };
        for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
          for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
            o.c = 0;
            const c = fn(x + 0.5, y + 0.5, o) || o.c;
            if (c) px.push(x + 0.5, y + 0.5, c, o.a);
          }
      },
    };
    for (let i = 0; i < 46; i++) petal(rec, -164 + rand(S, i, 71) * 328, FLOOR + Math.floor(rand(S, i, 72) * 3) * 2, 2.6 + rand(S, i, 73), (rand(S, i, 74) - 0.5) * 1.2, 0.5, C, 1);
    SCATTER.set(key, px);
  }
  for (let i = 0; i < px.length; i += 4) q.dot(px[i], px[i + 1], px[i + 2], px[i + 3]);
}

// ---- 3D: petals drifting down through a cylinder of air on the breeze, each a real flat petal that tumbles in a
// spiral, flips about its long axis and flashes when it turns square to the light; whole blossoms spin down among
// them and everything lands on a floor of fallen petals that gather in drifts. A pale shaft of light slants through.
const VR = 96, VH = 112, SC = 1.35, LIGHT = [-0.45, -0.6, 0.66], GOLD = hex("#ffe08a");
const edgeFade = (x, z) => 1 - smooth(VR * 0.92, VR * 1.1, Math.hypot(x, z));

// a petal's colour at (lu, lv) in its own axes (world px), len long: deeper at the base, palest at the tip, lit on
// one side and brighter turned to the light (lam); the back is a step deeper all over. 0 outside it.
function petalCol(lu, lv, len, back, lam, C) {
  const u = lu / len, v = lv / len;
  if (u < -1 || u > 1) return 0;
  const hw = 0.55 * Math.sqrt(1 - u * u) * (1 + 0.35 * u);
  if (Math.abs(v) > hw || (u > 0.7 && Math.abs(v) < 0.12)) return 0;
  const s = back ? 1 : lam > 0.78 ? 3 : 2, f = (i) => C[clamp(s + i, 0, 5)];
  return u > 0.45 && v < 0.1 ? (back ? C[3] : C[5]) : u < -0.45 ? f(0) : v < 0 ? f(2) : f(1);
}

// the view-space normal of a face and how square it is to the light, and which side shows
function lighting(q, N) {
  const l = Math.hypot(N[0], N[1], N[2]), Nv = q.view(N[0] / l, N[1] / l, N[2] / l), sgn = Nv[2] > 0 ? 1 : -1;
  return { lam: clamp((Nv[0] * LIGHT[0] + Nv[1] * LIGHT[1] + Nv[2] * LIGHT[2]) * sgn), back: Nv[2] < 0 };
}

function petals3(q, t, S, C, near) {
  const n = near ? 54 : 90, sd = S * 7 + near;
  trips(t, D, n, sd, 1, 2, (u, k, m, i) => {
    const j = wrap(k, m), R = (c) => rand(sd, i, j, c), dur = D / m, tf = dur * 0.84, a = Math.min(u * dur, tf), rest = u * dur - tf, born = t - u * dur;
    const gk = near ? 1 : 0.6, vx = 9 + R(2) * 10, rho = ((near ? 3 : 2) + R(3) * 3) * 1.5, w = 2.2 + R(4) * 2.8, ph = R(5) * TAU, len = ((near ? 3.6 : 2.6) + R(6) * 1.1) * SC;
    const r0 = VR * 0.96 * Math.sqrt(R(1)), g0 = R(12) * TAU, x0 = Math.cos(g0) * r0, z0 = Math.sin(g0) * r0, y0 = -VH, y1 = -0.8;
    // drifting on the breeze (along +x, gusting) while tumbling round a little helix
    const at = (aa) => [
      x0 + vx * (aa - tf / 2) + (gust(born + aa) - gust(born + tf / 2)) * gk + rho * Math.cos(w * aa + ph),
      y0 + (y1 - y0) * (aa / tf) + rho * 0.45 * Math.sin(w * aa + ph),
      z0 + 0.5 * (gust(born + aa + D / 4) - gust(born + tf / 2 + D / 4)) * gk + rho * Math.sin(w * aa + ph),
    ];
    const swing = R(13) * TAU, head = (aa) => R(10) * TAU + aa * (R(11) - 0.5) * 3;
    if (rest > 0) {
      // a landed petal settles and shrinks away (no dither, so the floor stays clean)
      const [x, , z] = at(tf), fade = 1 - rest / (dur - tf), al = edgeFade(x, z);
      if (fade < 0.15 || al < 0.5) return;
      const o = orient3(head(tf), 0, (R(7) - 0.5) * 0.3, swing), l = len * (0.35 + 0.65 * fade);
      tumble3(q, x, y1, z, o.N, o.U, l * 1.3, (lu, lv) => petalCol(lu, lv, l, false, 0.6, C));
      return;
    }
    const [x, y, z] = at(a), al = edgeFade(x, z) * smooth(0, 0.05, a / tf);
    if (al < 0.06) return;
    // flipping fast; near the floor it eases flat
    const land = smooth(0.9, 1, a / tf), f = R(8) * TAU + a * (3 + R(9) * 5);
    let o = orient3(head(a), f, 0.55 * Math.sin(w * a + ph), swing);
    if (land > 0) {
      const fl = orient3(head(a), 0, (R(7) - 0.5) * 0.3, swing);
      o = { N: o.N.map((v, c) => v + (fl.N[c] - v) * land), U: o.U.map((v, c) => v + (fl.U[c] - v) * land) };
    }
    const { lam, back } = lighting(q, o.N);
    const face = tumble3(q, x, y, z, o.N, o.U, len * 1.3, (lu, lv, out) => {
      const c = petalCol(lu, lv, len, back, lam, C);
      if (!c) return;
      out.c = c;
      out.a = al;
    }, { len: len * 0.9, c: back ? C[2] : C[3], a: al });
    // turned full face to the light it flashes
    if (face > 0 && lam > 0.9) {
      const g = (lam - 0.9) / 0.1;
      q.px(x, y - 1, z, WHITE);
      q.glow(x, y, z, near ? 7 : 5, C[4], (near ? 0.32 : 0.22) * g * al);
    }
  });
}

// a whole blossom: five petals round a gold heart, tumbling slowly as it sinks, its face turning to every side
function blossoms3(q, t, S, C) {
  trips(t, D, 8, S * 31, 1, 1, (u, k, m, i) => {
    const R = (c) => rand(S * 31, i, c), born = t - u * D, r = (3.6 + R(5) * 1.2) * 1.5;
    const fall = Math.min(1, u / 0.9), r0 = VR * 0.9 * Math.sqrt(R(1)), g0 = R(2) * TAU;
    const x = Math.cos(g0) * r0 + 14 * (u - 0.45) * D * 0.1 + (gust(t) - gust(born + 0.45 * D)) + 6 * Math.sin(u * TAU * 2 + R(6) * 6);
    const z = Math.sin(g0) * r0 + 6 * Math.cos(u * TAU * 2 + R(6) * 6) + 0.4 * (gust(t + D / 4) - gust(born + 0.45 * D + D / 4)), y = -VH + (VH - 3) * fall;
    const al = edgeFade(x, z) * smooth(0, 0.04, u) * (1 - smooth(0.9, 1, u));
    if (al < 0.06) return;
    // its face turns about: tipped over by about a radian, precessing as it spins
    const th = fall < 1 ? 0.8 + 0.4 * Math.sin(u * TAU * 2 + R(7) * 6) : 0.1, ph = R(8) * TAU + u * D * 0.4, spin = R(3) * TAU + u * D * (R(4) - 0.5) * 2;
    const N = [Math.sin(th) * Math.cos(ph), -Math.cos(th), Math.sin(th) * Math.sin(ph)];
    const e1 = [0, N[2], -N[1]], l1 = Math.hypot(...e1) || 1, E1 = e1.map((v) => v / l1), E2 = [N[1] * E1[2] - N[2] * E1[1], N[2] * E1[0] - N[0] * E1[2], N[0] * E1[1] - N[1] * E1[0]];
    const U = [0, 1, 2].map((c) => Math.cos(spin) * E1[c] + Math.sin(spin) * E2[c]);
    const { lam, back } = lighting(q, N);
    tumble3(q, x, y, z, N, U, r * 1.55, (lu, lv, out) => {
      const rr = Math.hypot(lu, lv);
      if (rr < 0.8) return void ((out.c = GOLD), (out.a = al));
      const ang = Math.atan2(lv, lu), kk = Math.round(ang / (TAU / 5)), d = ang - kk * (TAU / 5);
      const c = petalCol(rr * Math.cos(d) - 0.75 * r, rr * Math.sin(d), 0.7 * r, back, lam, C);
      if (!c) return;
      out.c = c;
      out.a = al;
    }, { len: r * 1.2, c: C[3], a: al });
    q.glow(x, y, z, 8, C[4], 0.2 * al);
  });
}

// petals already fallen, gathered in drifts along the floor; they never move, so they're baked once
function petalFloor(S, C) {
  return bakeFloor3("petals3" + S + C.join(), VR, (set) => {
    let n = 0;
    for (let i = 0; n < 320 && i < 4000; i++) {
      const r = VR * 0.98 * Math.sqrt(rand(S, i, 71)), g = rand(S, i, 72) * TAU, x = Math.cos(g) * r, z = Math.sin(g) * r;
      // gathered where the noise is high, in streaks the breeze has swept along x
      if (rand(S, i, 73) > 0.12 + 1.3 * Math.max(0, 0.5 + fbm(x / 60, z / 22, S + 5, 2)) ** 2) continue;
      n++;
      const len = (2.6 + rand(S, i, 74)) * SC, hd = rand(S, i, 75) * TAU, c = Math.cos(hd), s = Math.sin(hd), back = rand(S, i, 76) < 0.25, lam = 0.4 + rand(S, i, 77) * 0.4, ext = Math.ceil(len) + 1;
      for (let dz = -ext; dz <= ext; dz++)
        for (let dx = -ext; dx <= ext; dx++) {
          const k = petalCol(dx * c + dz * s, -dx * s + dz * c, len, back, lam, C);
          if (k) set(x + dx, z + dz, k);
        }
    }
  });
}

export const three = {
  meta: { size: [248, 194], origin: [124, 150], bg: "ground", camera: { pitch: 0.42 } },
  draw(p, t, o) {
    const q = space(p, o), S = o.seed, C = fit(o.palette, 6);
    layFloor3(q, petalFloor(S, C), -0.2, 0.72);
    // a pale shaft slanting through the petals, and where it falls on the floor
    const PALE = mix(C[4], WHITE, 0.35);
    q.plane(34, 0, 14, null, 30, (u, v, out) => {
      const f = 1 - Math.hypot(u, v * 1.1) / 30;
      if (f <= 0) return;
      out.l = PALE;
      out.k = f * f * 0.3;
    });
    q.glowLine(-26, -VH, -22, 34, -2, 14, 14, PALE, 0.1);
    q.glowLine(-26, -VH, -22, 34, -2, 14, 6, PALE, 0.08);
    blossoms3(q, t, S, C);
    petals3(q, t, S, C, 0);
    petals3(q, t, S, C, 1);
  },
};
