// The pool's caustic light (two warped sine nets, light where they cross zero) is adapted from Sprite Fusion's
// open-source bubbles (https://www.spritefusion.com/pixel-art-vfx/bubbles), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, cycle, tileNoise, noise2, rand, clamp, smooth, ease, space, TAU, WHITE } from "../../core/index.js";
import { WATER, bead, ring, ring3, billow, rock } from "./_lib.js";

export const meta = {
  name: "Waterfall",
  desc: "A river pours from a notch in a rock outcrop: a white curl, a deep sheet that splits into strands, churning foam, spray, drifting mist and rings on a dark pool.",
  tags: ["water", "waterfall", "cascade", "foam", "mist", "ambient", "loop"],
  size: [144, 136],
  origin: [72, 118],
  duration: 2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: WATER, height: 92, width: 13, ledge: true, seed: 5 },
};

const D = meta.duration, SY = 0.2, G = 760, POOL = [56, 11];

// half the sheet's width at depth d below the lip: it spreads a little as it falls
const halfW = (W, d, H) => W + 3.2 * Math.pow(clamp(d / H), 1.6);

// the falling sheet, in 1 px lanes. Lanes on the far side of the fall are dark and see-through, so the night shows
// between strands; the front lanes carry white dashes sliding down them, stretching as the water speeds up (the
// texture runs in fall time, √depth). The top is glassy and dark, and the lower third splits into strands that
// fan apart with gaps between, each lit down its left edge.
function sheet(p, C, ph, H, W, S) {
  for (let y = -H + 2; y <= -1; y++) {
    const d = y + 0.5 + H, v = d / H, s = Math.sqrt(d + 3), hw0 = halfW(W, d, H), split = smooth(0.56, 0.95, v), glass = 1 - smooth(4, 24, d);
    const wl = tileNoise(2, s * 1.4 - ph * 12, 0, 12, S + 2) * (0.4 + 1.8 * v), wr = tileNoise(11, s * 1.4 - ph * 12, 0, 12, S + 2) * (0.4 + 1.8 * v);
    const fan = split > 0 ? tileNoise(3, s * 0.8 - ph * 4, 0, 4, S + 61) * 1.6 : 0, sd = s * 1.5 - ph * 20, sb = s * 0.45 - ph * 6;
    for (let X = -W - 8; X <= W + 8; X++) {
      const x = X + 0.5, hw = hw0 + (x < 0 ? wl : wr), ax = Math.abs(x);
      if (ax > hw) continue;
      const e = ax / hw;
      let edge = false;
      if (split > 0) {
        const f = ((((x / (1 + 0.22 * split) + fan + 64) / 5.4) % 1) + 1) % 1;
        if (f > 1 - 0.46 * split) continue;
        edge = f < 0.2;
      }
      const dash = tileNoise(X * 1.618 + 0.31, sd, 0, 20, S);
      if (rand(X, S + 60) < 0.48 && e < 0.86 && !edge) {
        p.blend(x, y + 0.5, dash > 0.45 ? C[4] : glass > 0.5 ? C[3] : C[2], dash > 0.45 ? 0.7 : 0.42 + 0.15 * v);
        continue;
      }
      const broad = tileNoise(Math.floor((x + 40) / 3) * 2.7, sb, 0, 6, S + 1);
      let b = -0.34 + 0.46 * v + 0.3 * broad - glass * 0.5 + 0.35 * smooth(0.7, 1, e) * (x < 0 ? 1 : 0.3) - (x > 0 ? 0.12 * e : 0) + (edge ? 0.3 : 0);
      if (dash > 0.2 - 0.22 * v) b += 0.36 + 0.7 * (dash - 0.2);
      if (b > -0.2) p.px(X, y, b > 0.62 ? WHITE : b > 0.34 ? C[6] : b > 0.08 ? C[5] : C[4]);
      else p.blend(x, y + 0.5, C[3], 0.8);
    }
  }
  // strands peel off the edges and fall free
  cycle(ph * D, D, 16, S + 30, 0.4, (age, life, r) => {
    const side = r.sign(), d0 = r.range(14, H * 0.7), d = d0 + 50 * age + 260 * age * age, k = age / life;
    if (d > H - 6) return;
    const x = side * (halfW(W, d, H) + 1.5 + age * r.range(6, 16)), y = -H + d, len = 2 + 6 * k;
    p.line(x, y - len, x, y, (u) => (u > 0.7 ? C[6] : C[4]), 1 - k * 0.5);
  });
}

// the outcrop the river pours from: boulders shaded like the explosion's rocks (a lit top edge, shaded faces, a
// dark underside, a dark rim), creased where they meet, cracked; dark and glossy where the water runs over them
// which boulder is frontmost at each pixel of the outcrop, and how much light its face catches there
const ROCKS = new Map();
function rockMap(lumps, x0, y0, w, hgt, Lx, Ly, Lz, S) {
  const id = new Int8Array(w * hgt).fill(-1), lit = new Float32Array(w * hgt);
  for (let j = 0; j < hgt; j++)
    for (let i = 0; i < w; i++) {
      const x = x0 + i + 0.5, y = y0 + j + 0.5;
      let best = -1, z = -1e9, l = 0;
      lumps.forEach(([cx, cy, rx, ry], k) => {
        const nx = (x - cx) / rx, ny = (y - cy) / ry, r2 = nx * nx + ny * ny;
        if (r2 >= 1) return;
        const nz = Math.sqrt(1 - r2), depth = nz * ry + (k === 5 ? -6 : k === 2 ? -3 : k > 2 ? -1 : 0);
        if (depth > z) (z = depth), (best = k), (l = nx * Lx + ny * Ly + nz * Lz);
      });
      id[j * w + i] = best;
      lit[j * w + i] = l + 0.2 * tileNoise(x * 0.32, y * 0.32, 0, 0, S + 70);
    }
  return { id, lit };
}

function outcrop(p, C, ph, H, W, S) {
  const ST = rock(), Lx = -0.55, Ly = -0.72, Lz = 0.42;
  // [x, y, rx, ry]: a big boulder left of the notch, a smaller one right, the sill the water runs over, two feet,
  // and a slab behind that joins them, the notch cut into it
  const lumps = [[-W - 11, -H - 4, 13, 10], [W + 8, -H - 2, 9, 7.5], [0, -H + 3.5, W + 3, 4.2], [-W - 21, -H + 4, 7, 5.5], [W + 15, -H + 4.5, 5, 4], [-2, -H - 5, W + 7, 6.5]];
  const x0 = -W - 29, x1 = W + 21, y0 = -H - 15, y1 = -H + 10, w = x1 - x0 + 1, hgt = y1 - y0 + 1, key = `${W}|${H}|${S}`;
  let map = ROCKS.get(key);
  if (!map) ROCKS.set(key, (map = rockMap(lumps, x0, y0, w, hgt, Lx, Ly, Lz, S)));
  const { id, lit } = map;
  // a soft shadow under it on whatever is behind
  p.each(-W - 26, -H, W + 18, -H + 20, (x, y, sx, sy) => {
    const k = 1 - Math.hypot((x + 4) / (W + 22), (y + H) / 20);
    if (k > 0) p.blendPx(sx, sy, ST[0], 0.4 * Math.min(1, k * 3));
  });
  const at = (i, j) => (i < 0 || j < 0 || i >= w || j >= hgt ? -1 : id[j * w + i]);
  for (let j = 0; j < hgt; j++)
    for (let i = 0; i < w; i++) {
      const k = id[j * w + i], x = x0 + i, y = y0 + j;
      // the river runs over the sill: nothing of the sill shows through it
      if ((k === 2 || k === 5 || k < 0) && y >= -H - 5 && y < -H + 1 && Math.abs(x + 0.5) < W + 1.5) continue;
      if (k < 0) {
        if (at(i - 1, j) >= 0 || at(i + 1, j) >= 0 || at(i, j - 1) >= 0 || at(i, j + 1) >= 0) p.px(x, y, ST[0]);
        continue;
      }
      // a crease where one boulder sits in front of another
      const r = at(i + 1, j), b = at(i, j + 1);
      if ((r >= 0 && r !== k && r < k) || (b >= 0 && b !== k)) {
        p.px(x, y, ST[1]);
        continue;
      }
      const l = lit[j * w + i], wet = Math.abs(x + 0.5) < W + 6 && y > -H - 9;
      let c = l > 0.9 ? ST[5] : l > 0.64 ? ST[4] : l > 0.3 ? ST[3] : l > -0.05 ? ST[2] : ST[1];
      if (k === 5) c = l > 0.7 ? ST[3] : l > 0.2 ? ST[2] : ST[1];
      if (at(i, j - 1) < 0 && l > 0.25) c = ST[5];
      if (wet) {
        // wet stone: a step darker, a cool gloss running down it where the light catches
        c = l > 0.9 ? ST[4] : l > 0.64 ? ST[3] : l > 0.3 ? ST[2] : ST[1];
        if (l > 0.3 && tileNoise(x * 0.9, y * 0.6 - ph * 8, 0, 8, S + 71) > 0.42) c = l > 0.6 ? C[6] : C[4];
      }
      p.px(x, y, c);
    }
  // cracks: dark lines with a lit lip above them
  for (let q = 0; q < 3; q++) {
    const L = lumps[q % 2], cx = Math.floor(L[0] + (q === 2 ? -0.5 : 0.15) * L[2]), cy = Math.floor(L[1] + L[3] * (q === 2 ? 0.1 : -0.25));
    const len = 3 + Math.floor(rand(q, S + 74) * 4), dx = rand(q, S + 75) < 0.5 ? 1 : -1;
    for (let n = 0; n <= len; n++) {
      const x = cx + Math.round(n * 0.6) * dx, y = cy + n, i = x - x0, j = y - y0;
      if (at(i, j) < 0 || at(i, j) > 1 || at(i, j + 1) < 0) break;
      p.px(x, y, n === len ? ST[1] : ST[0]);
      if (n === 0) p.px(x - dx, y - 1, ST[4]);
    }
  }
  // trickles run down the wet faces either side of the notch
  for (const sx of [-W - 3, W + 3]) {
    for (let y = -H - 2; y < -H + 7; y++) {
      const g = ((y * 0.35 - ph * 6) % 1 + 1) % 1, i = Math.floor(sx) - x0, j = Math.floor(y) - y0;
      if (at(i, j) >= 0) p.px(sx, y, g < 0.3 ? C[6] : C[3]);
    }
  }
}

// the river sliding out of the notch between the boulders, seen from just above: flow lines sliding to the edge
function river(p, C, ph, H, W, S) {
  const top = -H - 6;
  p.shade(-W - 3, top, W + 3, -H, (x, y, out) => {
    const back = top + 1.5 + tileNoise(x * 0.3, 4, 0, 0, S + 62) * 1.5, v = (y - back) / (-H - back), hw = W + 2 - (1 - v) * 3;
    if (y < back || Math.abs(x) > hw) return;
    const n = tileNoise(x * 0.32, (y - top) * 0.7 - ph * 8, 0, 8, S + 3);
    out.c = n > 0.66 ? C[6] : n > 0.4 ? C[5] : v < 0.5 ? C[3] : C[4];
  });
}

// the curl over the edge: glassy blue as it rolls, a hard white line along the bend; its light on the stone
function curl(p, C, ph, H, W, S) {
  for (let x = -W; x <= W; x++) {
    const g = tileNoise(x * 0.45, ph * 4, 0, 4, S + 4);
    p.px(x, -H - 1, C[4]);
    p.px(x, -H, WHITE);
    p.px(x, -H + 1, g > 0.2 ? C[6] : C[5]);
  }
  p.glowLine(-W, -H, W, -H, 6, C[6], 0.18);
  p.glow(0, -H, 34, C[5], 0.2);
  // glints run along it
  cycle(ph * D, D, 4, S + 5, 0.36, (age, life, r) => {
    const k = Math.sin((Math.PI * age) / life), x = r.range(-W, W);
    if (k > 0.5) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(x + dx, -H + dy, C[6]);
    p.glow(x, -H, 6, C[5], 0.4 * k);
  });
}

// the pool: dark see-through water, a lit far rim, caustic light swimming in it, the falls' reflection
function pool(p, C, ph, W, S) {
  const [RX, RY] = POOL, cy = 2;
  const T = ph * TAU, cols = [];
  for (let X = -RX; X < RX; X++) {
    const x = X + 0.5;
    cols.push([Math.sin(x * 0.11 - T * 2), Math.sin(T + x * 0.05) * 1.4 + x * 0.13]);
  }
  for (let Y = Math.floor(cy - RY); Y < cy + RY; Y++) {
    const y = Y + 0.5, dy = (y - cy) / RY, sy = Math.sin(y * 0.5 + T);
    for (let X = -RX; X < RX; X++) {
      const x = X + 0.5, dx = x / RX, d = dx * dx + dy * dy;
      if (d > 1) continue;
      p.blend(x, y, d < 0.12 ? C[2] : C[1], 0.62 * Math.min(1, (1 - d) * 4));
      // caustics: two warped sine nets, light where either crosses zero
      const [cx1, cx2] = cols[X + RX], u = x * 0.2 + 1.8 * sy, w = y * 0.55 + 1.8 * cx1;
      const f = (Math.max(0, 1 - Math.abs(Math.sin(u) + Math.sin(w)) * 2.6) + 0.6 * Math.max(0, 1 - Math.abs(Math.sin(cx2 + y * 0.3)) * 3)) * (1 - d);
      if (f > 0.5) p.light(x, y, C[5], 0.18 * f);
    }
  }
  // a few glints sit on the far shore
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (1.12 + 0.76 * ((i + 0.5) / 7)), x = Math.cos(a) * RX * 0.96, y = cy + Math.sin(a) * RY * 0.96, g = Math.sin(ph * TAU * 2 + i * 2.4);
    if (g > 0.2) p.px(x, y, g > 0.8 ? C[6] : C[4]);
  }
  // the falls mirrored in the water, broken by the chop
  p.shade(-W - 3, 3, W + 3, 10, (x, y, out) => {
    const n = tileNoise(x * 0.9, (y - 3) * 0.35 + ph * 6, 0, 6, S + 6), k = 1 - (y - 3) / 7;
    if (Math.abs(x) > W + 2 - (y - 3) * 0.4 || n < 0.25 + (1 - k) * 0.4) return;
    out.c = n > 0.6 && k > 0.6 ? C[6] : C[5];
  });
}

// the foot: a churning white band, billows rolling out of it, spray thrown clear landing with rings
function foam(p, C, t, ph, W, S) {
  const R = W + 10;
  p.shade(-R, -13, R, 3, (x, y, out) => {
    const ax = Math.abs(x), lump = tileNoise(x * 0.22, ph * 6, 0, 6, S + 7) * 3 + tileNoise(x * 0.55 + 9, ph * 12, 0, 12, S + 8) * 1.5;
    const top = -8 + lump + Math.pow(ax / R, 2) * 7;
    if (ax > R - Math.max(0, -y - 1) * 0.6 || y < top) return;
    // the churn in lumps: each boil lit on top, shadowed under, darker where it meets the pool
    const n = tileNoise(x * 0.5, (y - top) * 0.5 - ph * 10, 0, 10, S + 9), boil = tileNoise(x * 0.42 + 3, y * 0.42 - ph * 8, 0, 8, S + 12), u = y - top;
    if (y > 1) out.c = n > 0 ? C[5] : C[4];
    else if (u < 1.2) out.c = WHITE;
    else if (boil < -0.3) out.c = u > 4 ? C[4] : C[5];
    else if (boil < -0.05) out.c = C[6];
    else out.c = n > -0.2 ? WHITE : C[6];
  });
  cycle(t, D, 30, S + 10, 0.7, (age, life, r) => {
    const k = age / life, side = r.sign(), x0 = r.range(-W, W) * 0.9, sp = r.range(2, 8), up = r.range(2, 8);
    const x = x0 + side * ease.outCubic(k) * sp, y = -r.range(2, 5) - ease.outCubic(k) * up, rad = r.range(1.4, 3) * Math.pow(Math.sin(Math.PI * k), 0.7);
    if (rad > 0.6) billow(p, x, y, rad, C);
  });
  // spray: beads thrown clear of the churn, landing in the pool with a ring
  cycle(t, D, 18, S + 11, 1, (age, life, r) => {
    const side = r.sign(), x0 = side * r.range(2, W + 4), vx = side * r.range(12, 60), vy = -r.range(70, 150), z = r.range(-3, 9), s = r.next() < 0.3 ? 2 : 1;
    const land = z * SY, tl = (-vy + Math.sqrt(vy * vy + 2 * G * (land + 5))) / G;
    if (age < tl) bead(p, x0 + vx * age, -5 + vy * age + 0.5 * G * age * age, vx, vy + G * age, s, C);
    else if (age < tl + 0.35) ring(p, x0 + vx * tl, land, 1 + (age - tl) * 12, SY, 1 - (age - tl) / 0.35, C, { n: 1 });
  });
}

// mist: soft puffs rolled out of the churn that drift sideways along the pool, swell and thin, with a cool light
function mist(p, C, t, S, n, seed) {
  cycle(t, D, n, S + seed, (g) => g.range(1.8, 2.8), (age, life, r) => {
    const k = age / life, side = r.sign(), drift = ease.outCubic(k);
    const x = side * (r.range(3, 12) + drift * r.range(24, 48)), y = -r.range(2, 7) - k * r.range(3, 12);
    const rad = r.range(4, 6) + k * r.range(5, 9), a = r.range(0.2, 0.3) * Math.min(1, k / 0.12) * Math.pow(1 - k, 1.7);
    p.disc(x, y, rad, C[6], (d) => a * (1 - d * d));
    if (a > 0.05) p.glow(x, y, rad * 1.2, C[4], 0.35 * a);
  });
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), ph = t / D, W = o.width;
  pool(p, C, ph, W, o.seed);
  for (let i = 0; i < 3; i++) {
    const f = (ph + i / 3) % 1;
    ring(p, 0, 1, W + 6 + f * 38, SY, 0.95 * Math.pow(1 - f, 1.5), C, { n: 1, half: -1, seed: i + 1 });
  }
  mist(p, C, t, o.seed, 7, 20);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), ph = t / D, H = o.height, W = o.width, S = o.seed, T = ph * TAU;
  for (let i = 0; i < 3; i++) {
    const f = (ph + i / 3) % 1;
    ring(p, 0, 1, W + 6 + f * 38, SY, 0.95 * Math.pow(1 - f, 1.5), C, { n: 1, half: 1, seed: i + 1, glint: f < 0.4 ? 1 - f * 2.5 : 0 });
  }
  river(p, C, ph, H, W, S);
  if (o.ledge) outcrop(p, C, ph, H, W, S);
  sheet(p, C, ph, H, W, S);
  curl(p, C, ph, H, W, S);
  foam(p, C, t, ph, W, S);
  mist(p, C, t, S, 5, 21);
  // glints wink on the falling water and in the spray
  cycle(t, D, 12, S + 50, (g) => g.range(0.2, 0.4), (age, life, r) => {
    const k = Math.sin((Math.PI * age) / life), low = r.next() < 0.45, d = low ? H - r.range(4, 16) : r.range(12, H - 16);
    const x = low ? r.range(-W - 10, W + 10) : r.range(-0.8, 0.8) * halfW(W, d, H), y = -H + d - (age / life) * (low ? 6 : -10);
    p.px(x, y, WHITE);
    if (k > 0.55) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(x + dx, y + dy, C[6]);
    if (k > 0.85 && r.next() < 0.5) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) p.px(x + dx, y + dy, C[5]);
    p.glow(x, y, 5, C[5], 0.35 * k);
  });
  // fine spray hangs in the air off the foot, drifting up and out
  cycle(t, D, 34, S + 51, (g) => g.range(0.9, 1.6), (age, life, r) => {
    const k = age / life, side = r.sign(), x = side * (r.range(0, W + 6) + k * r.range(6, 22)) + Math.sin(age * 5 + r.range(0, TAU)) * 1.2, y = -r.range(3, 10) - k * r.range(10, 34);
    if (k > 0.7 && r.next() < (k - 0.7) * 3.3) return;
    p.px(x, y, k < 0.4 && r.next() < 0.5 ? WHITE : C[6]);
  });
  // light: down the sheet, a pool of it where the water lands, on the water around
  p.glowLine(0, -H + 6, 0, -8, 26, C[4], 0.12);
  p.glow(0, -5, 40, C[5], 0.32 + 0.05 * Math.sin(T * 2));
  p.glow(0, 4, 50, C[3], 0.14);
}

// 3D: the river pours over a notch and falls as a slab of water with real thickness: it leaves the lip going out
// and curves down onto the pool, so from the side it is a bowed band and from behind it is the same water. The
// outcrop is boulders round a channel the river runs down, the pool a true disc with caustics, foam a mound of
// billows round the foot with lacy foam and rings flat on the water, spray thrown in every direction.
const LIPZ = -9, BOW = 2.4;

// where the sheet's middle is d px below the lip (it leaves the lip outward and arcs down to the foot at z = 0),
// how thick it is, and how far its middle bows out across the width
const sheetZ = (d, H) => LIPZ * (1 - Math.sqrt(clamp(d / H)));
const sheetT = (d, H) => 6.4 - 3.6 * smooth(0, 0.8 * H, d);
const sheetBow = (x, v, W) => BOW * (1 - Math.min(1, (x * x) / ((W + 3) * (W + 3)))) * (1 - 0.6 * v);

// the same lanes as sheet(), as world samples: both faces (the far one mirrored, so the lit edge stays on the
// camera's left from behind) and the two edge walls so the slab has thickness from the side. Translucent lanes are
// queued in `trans` to draw after the solid things.
function sheet3(q, C, ph, H, W, S, trans) {
  const NL = 2 * W + 17, col = new Array(NL), alp = new Array(NL);
  const put = (x, y, z, c, a) => (a >= 1 ? q.px(x, y, z, c) : trans.push([x, y, z, c, a, q.depth(x, y, z)]));
  for (let y = -H + 2; y <= -1; y++) {
    const d = y + 0.5 + H, v = d / H, s = Math.sqrt(d + 3), hw0 = halfW(W, d, H), split = smooth(0.56, 0.95, v), glass = 1 - smooth(4, 24, d);
    const wl = tileNoise(2, s * 1.4 - ph * 12, 0, 12, S + 2) * (0.4 + 1.8 * v), wr = tileNoise(11, s * 1.4 - ph * 12, 0, 12, S + 2) * (0.4 + 1.8 * v);
    const fan = split > 0 ? tileNoise(3, s * 0.8 - ph * 4, 0, 4, S + 61) * 1.6 : 0, sd = s * 1.5 - ph * 20, sb = s * 0.45 - ph * 6;
    let lo = -1, hi = -1;
    for (let X = -W - 8, i = 0; X <= W + 8; X++, i++) {
      col[i] = 0;
      const x = X + 0.5, hw = hw0 + (x < 0 ? wl : wr), ax = Math.abs(x);
      if (ax > hw) continue;
      const e = ax / hw;
      let edge = false;
      if (split > 0) {
        const f = ((((x / (1 + 0.22 * split) + fan + 64) / 5.4) % 1) + 1) % 1;
        if (f > 1 - 0.46 * split) continue;
        edge = f < 0.2;
      }
      const dash = tileNoise(X * 1.618 + 0.31, sd, 0, 20, S);
      if (rand(X, S + 60) < 0.48 && e < 0.86 && !edge) {
        col[i] = dash > 0.45 ? C[4] : glass > 0.5 ? C[3] : C[2];
        alp[i] = dash > 0.45 ? 0.7 : 0.42 + 0.15 * v;
      } else {
        const broad = tileNoise(Math.floor((x + 40) / 3) * 2.7, sb, 0, 6, S + 1);
        let b = -0.34 + 0.46 * v + 0.3 * broad - glass * 0.5 + 0.35 * smooth(0.7, 1, e) * (x < 0 ? 1 : 0.3) - (x > 0 ? 0.12 * e : 0) + (edge ? 0.3 : 0);
        if (dash > 0.2 - 0.22 * v) b += 0.36 + 0.7 * (dash - 0.2);
        if (b > -0.2) (col[i] = b > 0.62 ? WHITE : b > 0.34 ? C[6] : b > 0.08 ? C[5] : C[4]), (alp[i] = 1);
        else (col[i] = C[3]), (alp[i] = 0.8);
      }
      if (lo < 0) lo = i;
      hi = i;
    }
    if (lo < 0) continue;
    const yy = y + 0.5, zc = sheetZ(d, H), T = sheetT(d, H);
    // the lane at this x: (z0, half thickness)
    const slab = (x) => [zc + sheetBow(x, v, W), (T * (0.7 + 0.3 * (1 - Math.min(1, (x * x) / ((W + 3) * (W + 3)))))) / 2];
    for (let i = 0; i < NL; i++) {
      const x = i - W - 8 + 0.5, [z0, h] = slab(x), j = NL - 2 - i;
      if (col[i]) put(x, yy, z0 + h, col[i], alp[i]);
      if (j >= 0 && col[j]) put(x, yy, z0 - h, col[j], alp[j]);
    }
    // the edge walls: dashes running down them, the left one lit
    for (const [i, lit] of [[lo, 1], [hi, 0]]) {
      const x = i - W - 8 + 0.5, [z0, h] = slab(x);
      for (let z = z0 - h; z <= z0 + h + 0.01; z += 1) {
        const dash = tileNoise(z * 0.9 + (lit ? 3 : 7), sd, 0, 20, S + 80);
        q.px(x, yy, z, lit ? (dash > 0.35 ? WHITE : dash > 0 ? C[6] : C[5]) : dash > 0.35 ? C[6] : dash > 0 ? C[5] : C[4]);
      }
    }
  }
}

// the pool: dark see-through water on a disc, caustic light swimming in it (the 2D nets with z for y), the falls
// mirrored in it below the foot as the camera sees it, broken by the chop
function pool3(q, C, ph, W, S) {
  const RX = POOL[0], T = ph * TAU, sx = q.sy, cx = q.cy, reflW = (W + 2) * Math.abs(cx) + 4 * Math.abs(sx) + 1.5;
  q.plane(0, 0, 0, null, RX + 3, (u, v, out) => {
    const d = (u * u + v * v) / (RX * RX);
    if (d > 1) return;
    out.c = d < 0.12 ? C[2] : C[1];
    out.a = 0.62 * Math.min(1, (1 - d) * 4);
    out.blend = true;
    const cx1 = Math.sin(u * 0.11 - T * 2), cx2 = Math.sin(T + u * 0.05) * 1.4 + u * 0.13, sy = Math.sin(v * 0.28 + T);
    const w = v * 0.3 + 1.8 * cx1, a = u * 0.2 + 1.8 * sy;
    const f = (Math.max(0, 1 - Math.abs(Math.sin(a) + Math.sin(w)) * 2.6) + 0.6 * Math.max(0, 1 - Math.abs(Math.sin(cx2 + v * 0.2)) * 3)) * (1 - d);
    if (f > 0.5) (out.l = C[5]), (out.k = 0.18 * f);
    // the falls mirrored: along the camera's floor axis away from the foot, across it screen-right
    const al = u * sx + v * cx - 2, ac = u * cx - v * sx;
    if (al > 0 && al < 22 && Math.abs(ac) < reflW - al * 0.05) {
      const n = tileNoise(ac * 0.9, al * 0.11 + ph * 6, 0, 6, S + 6), k = 1 - al / 22;
      if (n >= 0.25 + (1 - k) * 0.4) (out.c = n > 0.6 && k > 0.6 ? C[6] : C[5]), (out.a = 1), (out.blend = false);
    }
  });
}

// lacy foam on the water round the foot, the 2D lace's net (its drift run round a circle so the loop is seamless)
function lace3(q, C, ph, W, S) {
  const T = ph * TAU, rx = W + 15, rz = 12, k = 0.95;
  q.plane(0, 0, 1, null, rx + 2, (u, v, out) => {
    const dx = u / rx, dz = v / rz, d = dx * dx + dz * dz;
    if (d > 1) return;
    const cu = 1.1 * Math.cos(T), cv = 1.1 * Math.sin(T), a = u * 0.36, b = v * 0.36;
    const n = noise2(a + S * 7.13 + cu, b + cv, S), m = noise2(a * 2.2 + cv, b * 2.2 - cu, S + 9), net = 1 - Math.abs(n) * 4.6 + m * 0.3, need = 1.02 - k * (1.15 - d * 0.9);
    if (net < need) return;
    out.c = net > need + 0.4 ? WHITE : C[6];
  });
}

// the river sliding out of the notch behind the lip: flow lines running to the edge
function river3(q, C, ph, H, W, S) {
  q.plane(0, -H - 1, -21, null, 23, (u, v, out) => {
    const w = W + 2 - (1 - (v + 15) / 30) * 3;
    if (Math.abs(u) > w || v < -15 || v > 14.5) return;
    const f = (v + 15) / 30, n = tileNoise(u * 0.32, v * 0.7 - ph * 8, 0, 8, S + 3);
    out.c = n > 0.66 ? C[6] : n > 0.4 ? C[5] : f < 0.5 ? C[3] : C[4];
  });
}

// stone: the 2D outcrop's shading on a ball: a lit top edge, shaded faces, a dark rim; wet and glossy by the water
function stone(ST, C, ph, S, bx, wet) {
  return (nx, ny, nz) => {
    if (nz < 0.2) return ST[0];
    const l = nx * -0.55 + ny * -0.72 + nz * 0.42 + 0.22 * tileNoise(nx * 3.4 + bx * 0.37, ny * 3.4 + bx * 0.11, 0, 0, S + 70);
    if (wet) {
      if (l > 0.3 && tileNoise(nx * 2.4 + bx, ny * 9 - ph * 8, 0, 8, S + 71) > 0.36) return l > 0.6 ? C[6] : C[4];
      return l > 0.9 ? ST[4] : l > 0.64 ? ST[3] : l > 0.3 ? ST[2] : ST[1];
    }
    return l > 0.9 ? ST[5] : l > 0.64 ? ST[4] : l > 0.3 ? ST[3] : l > -0.05 ? ST[2] : ST[1];
  };
}

export const three = {
  meta: { size: [152, 150], origin: [76, 124], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), ph = t / D, H = o.height, W = o.width, S = o.seed, T = ph * TAU, ST = rock(), trans = [];
    // the water first: everything stands on it
    pool3(q, C, ph, W, S);
    lace3(q, C, ph, W, S);
    for (let i = 0; i < 3; i++) {
      const f = (ph + i / 3) % 1;
      ring3(q, 0, 1, W + 6 + f * 38, 0.95 * Math.pow(1 - f, 1.5), C, { n: 1, seed: i + 1, glint: f < 0.4 ? 1 - f * 2.5 : 0 });
    }
    // the outcrop: boulders round the channel the river runs down, a wall of them behind, feet hanging under
    if (o.ledge) {
      river3(q, C, ph, H, W, S);
      // [x, y, z, r, wet]
      [
        [-W - 11, -H - 4, -12, 11, 1], [-W - 7, -H - 1, -22, 8.5, 1], [-W - 12, -H - 3, -30, 9, 1], [-W - 18, -H + 3, -17, 7, 0], [-W - 21, -H + 7, -9, 5.5, 0], [-W - 9, -H + 6, -16, 6, 0],
        [W + 8, -H - 2, -12, 8, 1], [W + 9, -H - 2, -22, 8, 1], [W + 11, -H - 3, -31, 8.5, 1], [W + 15, -H + 3, -16, 6, 0], [W + 17, -H + 6, -9, 4.5, 0], [W + 8, -H + 6, -17, 5.5, 0],
        [-W - 4, -H - 3, -39, 9.5, 0], [-4, -H - 6, -41, 10.5, 0], [W + 4, -H - 4, -39, 9.5, 0], [-W - 16, -H + 2, -39, 7, 0], [W + 16, -H + 2, -38, 7, 0],
        [-W + 2, -H + 7, -38, 7, 0], [W - 4, -H + 8, -39, 7, 0],
      ].forEach(([x, y, z, r, wet], i) => q.ball(x, y, z, r, stone(ST, C, ph, S, i * 7.3, wet)));
    }
    sheet3(q, C, ph, H, W, S, trans);
    // the curl over the edge: glassy blue as it rolls, a hard white line along the bend
    q.beam(-W, -H - 0.8, LIPZ - 2.6, W, -H - 0.8, LIPZ - 2.6, 3.4, (u, v) => (v < 0.5 ? C[5] : C[4]));
    q.beam(-W, -H + 0.3, LIPZ + 1.4, W, -H + 0.3, LIPZ + 1.4, 2.4, (u, v) => (v < 0.45 ? WHITE : tileNoise((-W + u * 2 * W) * 0.45, ph * 4, 0, 4, S + 4) > 0.2 ? C[6] : C[5]));
    // the foot: a mound of churning billows, billows rolling out of it, spray thrown clear landing with rings
    const bills = [];
    for (let i = 0; i < 30; i++) {
      const a = i * 2.39996, rr = Math.sqrt((i + 0.5) / 30), k = 1 + (i % 3);
      const bob = 1 + Math.sin(T * k + i * 1.7), r = 2.8 + (1 - rr) * 2.4 + 0.5 * Math.sin(T * k + i);
      bills.push([Math.cos(a) * rr * (W + 7), -2 - (1 - rr) * 6 - 1.6 * bob, Math.sin(a) * rr * 8, r]);
    }
    // a low ring of them lapping the water round the foot
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, w = 1 + Math.sin(T * 2 + i * 2.1) * 0.3;
      bills.push([Math.cos(a) * (W + 9) * w, -1.4 - 0.8 * Math.sin(T + i), Math.sin(a) * 10 * w, 2.4 + 0.6 * Math.sin(T * 2 + i)]);
    }
    cycle(t, D, 34, S + 10, 0.7, (age, life, r) => {
      const k = age / life, x0 = r.range(-W, W) * 0.9, z0 = r.range(-6, 6), dd = ease.outCubic(k), a = Math.atan2(z0 * 2, x0), out = dd * r.range(2, 8) * 1.3;
      const rad = r.range(1.4, 3) * Math.pow(Math.sin(Math.PI * k), 0.7);
      if (rad > 0.6) bills.push([x0 + Math.cos(a) * out, -r.range(2, 5) - dd * r.range(2, 8), z0 + Math.sin(a) * out, rad]);
    });
    for (const [x, y, z, r] of bills) q.at(x, y, z, (pp, k) => billow(pp, 0, 0, r * k, C));
    cycle(t, D, 18, S + 11, 1, (age, life, r) => {
      const a = r.range(0, TAU), ca = Math.cos(a), sa = Math.sin(a), d0 = r.range(2, W + 4), z0 = sa * r.range(1, 7), x0 = ca * d0, v = r.range(12, 60);
      const vx = ca * v, vz = sa * v, vy = -r.range(70, 150), s = r.next() < 0.3 ? 2 : 1, tl = (-vy + Math.sqrt(vy * vy + 2 * G * 5)) / G;
      if (age < tl) {
        const [wx, wy] = q.view(vx, vy + G * age, vz);
        q.at(x0 + vx * age, -5 + vy * age + 0.5 * G * age * age, z0 + vz * age, (pp) => bead(pp, 0, 0, wx, wy, s, C));
      } else if (age < tl + 0.35) ring3(q, x0 + vx * tl, z0 + vz * tl, 1 + (age - tl) * 12, 1 - (age - tl) / 0.35, C, { n: 1 });
    });
    // glints wink on the falling water and in the spray
    cycle(t, D, 12, S + 50, (g) => g.range(0.2, 0.4), (age, life, r) => {
      const k = Math.sin((Math.PI * age) / life), low = r.next() < 0.45, d = low ? H - r.range(4, 16) : r.range(12, H - 16);
      let x, z;
      const y = -H + d - (age / life) * (low ? 6 : -10);
      if (low) (x = r.range(-W - 10, W + 10)), (z = r.range(-9, 9));
      else (x = r.range(-0.8, 0.8) * halfW(W, d, H)), (z = sheetZ(d, H) + sheetBow(x, d / H, W) + r.sign() * (sheetT(d, H) / 2 + 1.2));
      q.at(x, y, z, (pp, kk) => {
        pp.px(0, 0, WHITE);
        if (k > 0.55) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pp.px(dx, dy, C[6]);
        if (k > 0.85 && r.next() < 0.5) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) pp.px(dx, dy, C[5]);
      });
      q.glow(x, y, z, 5, C[5], 0.35 * k);
    });
    // glints run along the curl
    cycle(ph * D, D, 4, S + 5, 0.36, (age, life, r) => {
      const k = Math.sin((Math.PI * age) / life), x = r.range(-W, W);
      if (k > 0.5) q.at(x, -H, LIPZ + 3, (pp) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pp.px(dx, dy, C[6]); });
      q.glow(x, -H, LIPZ + 3, 6, C[5], 0.4 * k);
    });
    // fine spray hangs in the air off the foot, drifting up and out in every direction
    cycle(t, D, 34, S + 51, (g) => g.range(0.9, 1.6), (age, life, r) => {
      const k = age / life, a = r.range(0, TAU), ca = Math.cos(a), sa = Math.sin(a), ph0 = r.range(0, TAU);
      const x = ca * (r.range(0, W + 6) + k * r.range(6, 22)) + Math.sin(age * 5 + ph0) * 1.2, z = sa * (r.range(0, 8) + k * r.range(6, 18)) + Math.cos(age * 5 + ph0) * 1.2, y = -r.range(3, 10) - k * r.range(10, 34);
      if (k > 0.7 && r.next() < (k - 0.7) * 3.3) return;
      q.px(x, y, z, k < 0.4 && r.next() < 0.5 ? WHITE : C[6]);
    });
    // light: down the sheet, a pool of it where the water lands, on the water around, on the stone at the lip
    q.glowLine(0, -H + 6, LIPZ * 0.5, 0, -8, 0, 26, C[4], 0.12);
    q.glowLine(-W, -H, LIPZ, W, -H, LIPZ, 6, C[6], 0.18);
    q.glow(0, -H, LIPZ, 34, C[5], 0.2);
    q.glow(0, -5, 0, 40, C[5], 0.32 + 0.05 * Math.sin(T * 2));
    q.glow(0, 4, 0, 50, C[3], 0.14);
    // translucent last: the sheet's see-through lanes, then the mist, far to near
    for (const [x, y, z, c, a] of trans.sort((m, n) => n[5] - m[5])) q.blend(x, y, z, c, a);
    const puffs = [];
    for (const [n, seed] of [[10, 20], [8, 21]])
      cycle(t, D, n, S + seed, (g) => g.range(1.8, 2.8), (age, life, r) => {
        const k = age / life, a = r.range(0, TAU), drift = ease.outCubic(k), d = r.range(3, 12) + drift * r.range(22, 40);
        puffs.push([Math.cos(a) * d, -r.range(2, 7) - k * r.range(3, 12), Math.sin(a) * d * 0.9, r.range(4, 6) + k * r.range(5, 9), 1.3 * r.range(0.2, 0.3) * Math.min(1, k / 0.12) * Math.pow(1 - k, 1.7)]);
      });
    for (const [x, y, z, rad, a] of q.sort(puffs, (m) => m))
      q.at(x, y, z, (pp, k) => {
        pp.disc(0, 0, rad * k, C[6], (d) => a * (1 - d * d));
        if (a > 0.05) pp.glow(0, 0, rad * k * 1.2, C[4], 0.35 * a);
      });
  },
};
