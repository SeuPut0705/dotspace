// The glints and the twinkling pixel dust follow Sprite Fusion's open-source sparkle
// (https://www.spritefusion.com/pixel-art-vfx/sparkle), MIT License, Copyright (c) 2026 Hugo Duprez.
import { PAL, fit, hex, mix, clamp, ease, fbm, rand, space, WHITE } from "../../core/index.js";
import { W, H, screenMeta, clipTo, glint, glint3, poly, edge, rect } from "./_lib.js";

export const meta = screenMeta({
  name: "Pixel dissolve",
  desc: "Clumps of blocks wink in, each drawn in a white outline that fills black and cools, with glints; then they wink out, outlines collapsing, the last small ones sparkling away.",
  tags: ["dissolve", "pixel", "blocks", "glint"],
  duration: 2.2,
  options: { palette: PAL.neon, seed: 1 },
});

const P = 0.17, IN0 = 0.04, IN1 = 0.8, OUT0 = 1.12, OUT1 = 1.85, CELL = 20;

// the blocks: 20 px cells, some whole, some in quarters, some in sixteenths. Each winks in and out at its own
// time read off a clumpy field, so they gather in growing patches: small ones scatter first, big ones fill in
const cache = new Map();
function layout(seed) {
  if (cache.has(seed)) return cache.get(seed);
  const blocks = [];
  for (let cy = 0; cy < H / CELL; cy++)
    for (let cx = 0; cx < W / CELL; cx++) {
      const h = rand(cx, cy, seed), n = h < 0.32 ? 1 : h < 0.74 ? 2 : 4, s = CELL / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) blocks.push({ x: cx * CELL + i * s, y: cy * CELL + j * s, s });
    }
  const rank = (key) => {
    const v = blocks.map(key), out = new Float32Array(v.length);
    v.map((_, i) => i).sort((a, b) => v[a] - v[b]).forEach((i, k) => (out[i] = k / (v.length - 1)));
    return out;
  };
  const at = (b, sd) => fbm((b.x + b.s / 2) / 64, (b.y + b.s / 2) / 64, sd, 3);
  const uin = rank((b) => at(b, seed) + 0.22 * rand(b.x, b.y, seed + 1) + (b.s === 20 ? 0.12 : b.s === 5 ? -0.08 : 0));
  const uout = rank((b) => at(b, seed + 7) + 0.22 * rand(b.x, b.y, seed + 2) + (b.s === 20 ? -0.14 : b.s === 5 ? 0.1 : 0));
  blocks.forEach((b, i) => {
    b.tin = IN0 + uin[i] * (IN1 - IN0);
    b.tout = OUT0 + uout[i] * (OUT1 - OUT0);
    b.glint = rand(b.x, b.y, seed + 3) < (b.s >= 10 ? 0.32 : 0.1);
    b.gx = b.x + (rand(b.x, b.y, seed + 4) < 0.5 ? 0 : b.s);
    b.gy = b.y + (rand(b.x, b.y, seed + 5) < 0.5 ? 0 : b.s);
    b.spin = (rand(b.x, b.y, seed + 6) - 0.5) * 3;
    // now and then a big block throws a hero glint
    b.L = b.s === 20 && rand(b.x, b.y, seed + 8) < 0.45 ? 9 + 6 * rand(b.x, b.y, seed + 9) : 2.5 + b.s * 0.32;
  });
  cache.set(seed, blocks);
  return blocks;
}

// a square block, filled, with a 1 px rim
// a mote of pixel dust: a lone pixel, or now and then a little cross
function mote(p, x, y, c, cross) {
  p.px(x, y, c);
  if (cross) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(x + dx, y + dy, c);
}

function square(p, x, y, s, fill, rim) {
  const X = Math.round(x), Y = Math.round(y), S = Math.max(1, Math.round(s));
  if (fill) rect(p, X, Y, S, S, fill);
  if (rim && S > 2) rect(p, X, Y, S, 1, rim), rect(p, X, Y + S - 1, S, 1, rim), rect(p, X, Y, 1, S, rim), rect(p, X + S - 1, Y, 1, S, rim);
}

export function draw(p0, t, o) {
  const C = fit(o.palette, 8), ink = hex(o.color), p = clipTo(p0), blocks = layout(o.seed), glints = [], frame = Math.floor(t * 15);
  for (let n = 0; n < blocks.length; n++) {
    const b = blocks[n], ki = (t - b.tin) / P, ko = (t - b.tout) / P, { x, y, s } = b, cx = x + s / 2, cy = y + s / 2;
    if (ki < 0 || ko >= 1.6) continue;
    if (ko < 0) {
      if (ki >= 1) square(p0, x, y, s, ink);
      else {
        // winking in: a white outline swells to the block, it fills with black, its rim cools down the ramp
        const g = ki < 0.35 ? 0.35 + 0.65 * ease.outBack(ki / 0.35) : 1, h = s * g;
        const rim = ki < 0.45 ? WHITE : ki < 0.6 ? C[6] : ki < 0.75 ? C[5] : ki < 0.9 ? C[4] : C[3];
        square(p, cx - h / 2, cy - h / 2, h, ki > 0.2 ? ink : 0, rim);
        if (ki < 0.3 && s >= 10) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(cx - 0.5 + dx, cy - 0.5 + dy, dx || dy ? C[6] : WHITE);
        p.glow(cx, cy, s * 0.8 + 4, C[5], 0.45 * (1 - ki));
      }
      if (b.glint && ki > 0.15 && ki < 1.6) glints.push([b, (ki - 0.15) / 1.45, 1]);
      // pixel dust flickers round the fresh block
      if (ki < 1.4 && rand(frame, n, 9) < 0.35) mote(p, x + rand(frame, n, 10) * (s + 6) - 3, y + rand(frame, n, 11) * (s + 6) - 3, rand(frame, n, 12) < 0.5 ? WHITE : C[6], rand(frame, n, 17) < 0.25);
    } else {
      if (ko < 0.35) {
        // winking out: its rim lights up...
        const q = ko / 0.35;
        square(p0, x, y, s, ink, q < 0.4 ? C[4] : q < 0.75 ? C[5] : C[6]);
        p.glow(cx, cy, s * 0.8 + 3, C[4], 0.35 * q);
      } else if (ko < 0.75) {
        // ...the black drops away and the white outline collapses into its heart
        const q = (ko - 0.35) / 0.4, h = s * (1 - ease.inQuad(q) * 0.85);
        square(p, cx - h / 2, cy - h / 2, h, 0, q < 0.5 ? WHITE : C[6]);
        p.glow(cx, cy, s * 0.8 + 4, C[5], 0.45 * (1 - q * 0.5));
      } else if (ko < 1) {
        const q = (ko - 0.75) / 0.25;
        for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (!(dx || dy) || q < 0.5) p.px(cx - 0.5 + dx, cy - 0.5 + dy, dx || dy ? C[6] : WHITE);
        p.glow(cx, cy, s * 0.5 + 3, C[5], 0.35 * (1 - q));
      }
      if (b.glint && ko > 0.3) glints.push([b, (ko - 0.3) / 1.3, -1]);
      if (ko > 0.3 && ko < 1.5 && rand(frame, n, 13) < 0.3) mote(p, x + rand(frame, n, 14) * (s + 6) - 3, y + rand(frame, n, 15) * (s + 6) - 3, rand(frame, n, 16) < 0.5 ? WHITE : C[6], rand(frame, n, 18) < 0.25);
    }
  }
  // glints on top: a spinning star on a corner of the block, swelling and fading
  for (const [b, u, dir] of glints) {
    if (u <= 0 || u >= 1) continue;
    const L = b.L * Math.pow(Math.sin(Math.PI * u), 0.7);
    glint(p, b.gx, b.gy, L, b.spin * u * dir + 0.4, C[5], C[4]);
    if (b.L > 8) p.glow(b.gx, b.gy, 18 + L, C[5], 0.25 * Math.sin(Math.PI * u));
  }
}

// 3D: the blocks are cubes standing on the floor, whole, in eighths or in sixty-fourths of the same cell, so the
// cover is a skyline: big cubes tall, small ones low. They wink in as a white wire cube that fills with black and
// cools; they wink out with their wires lighting up, collapsing into their hearts, the small ones sparkling away.
const CELL3 = 20, PR3 = 64;
const cache3 = new Map();
function layout3(seed) {
  if (cache3.has(seed)) return cache3.get(seed);
  const blocks = [], N = 8;
  for (let cj = 0; cj < N; cj++)
    for (let ci = 0; ci < N; ci++) {
      const x0 = (ci - N / 2) * CELL3, z0 = (cj - N / 2) * CELL3;
      if (Math.hypot(x0 + CELL3 / 2, z0 + CELL3 / 2) > PR3) continue;
      const h = rand(ci, cj, seed), n = h < 0.32 ? 1 : h < 0.74 ? 2 : 4, s = CELL3 / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) blocks.push({ x: x0 + i * s, z: z0 + j * s, s });
    }
  const rank = (key) => {
    const v = blocks.map(key), out = new Float32Array(v.length);
    v.map((_, i) => i).sort((a, b) => v[a] - v[b]).forEach((i, k) => (out[i] = k / (v.length - 1)));
    return out;
  };
  const at = (b, sd) => fbm((b.x + b.s / 2 + 200) / 64, (b.z + b.s / 2 + 200) / 64, sd, 3);
  const uin = rank((b) => at(b, seed) + 0.22 * rand(b.x, b.z, seed + 1) + (b.s === 20 ? 0.12 : b.s === 5 ? -0.08 : 0));
  const uout = rank((b) => at(b, seed + 7) + 0.22 * rand(b.x, b.z, seed + 2) + (b.s === 20 ? -0.14 : b.s === 5 ? 0.1 : 0));
  blocks.forEach((b, i) => {
    b.tin = IN0 + uin[i] * (IN1 - IN0);
    b.tout = OUT0 + uout[i] * (OUT1 - OUT0);
    b.glint = rand(b.x, b.z, seed + 3) < (b.s >= 10 ? 0.32 : 0.1);
    b.gx = b.x + (rand(b.x, b.z, seed + 4) < 0.5 ? 0 : b.s);
    b.gz = b.z + (rand(b.x, b.z, seed + 5) < 0.5 ? 0 : b.s);
    b.spin = (rand(b.x, b.z, seed + 6) - 0.5) * 3;
    b.L = b.s === 20 && rand(b.x, b.z, seed + 8) < 0.45 ? 6 + 4 * rand(b.x, b.z, seed + 9) : 2 + b.s * 0.22;
  });
  cache3.set(seed, blocks);
  return blocks;
}
// a cube's corners (bit 0: east, bit 1: down, bit 2: towards z) and its faces: [corners, normal]
const CUBE_FACES = [[[0, 1, 5, 4], 0, -1, 0], [[1, 3, 7, 5], 1, 0, 0], [[0, 2, 6, 4], -1, 0, 0], [[4, 5, 7, 6], 0, 0, 1], [[0, 1, 3, 2], 0, 0, -1]];
const CUBE_EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

export const three = {
  meta: { size: [184, 108], origin: [92, 78], bg: "ground", camera: { pitch: 0.34 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), ink = hex(o.color), blocks = layout3(o.seed), glints = [], frame = Math.floor(t * 15), lights = [], motes = [];
    const TOP = mix(ink, C[0], 0.5), FRONT = mix(ink, C[0], 0.25), EDGE = mix(ink, C[1], 0.55);
    const vx = q.sy * q.cp, vy = -q.sp, vz = q.cy * q.cp, cs = [];
    // a cube of side h centred at (x, y, z): ink faces if fill, a 1 px wire in the rim color (not for rim 0)
    const cube = (x, y, z, h, fill, rim, wire = true) => {
      const a = h / 2;
      cs.length = 0;
      for (let k = 0; k < 8; k++) cs.push([x + (k & 1 ? a : -a), y + (k & 2 ? a : -a), z + (k & 4 ? a : -a)]);
      if (fill)
        for (const [ids, nx, ny, nz] of CUBE_FACES)
          if (nx * vx + ny * vy + nz * vz > -0.02) poly(q, ids.map((i) => cs[i]), ny ? TOP : nz > 0 ? FRONT : ink);
      if (rim && wire) for (const [i, j] of CUBE_EDGES) edge(q, cs[i], cs[j], rim, 1, 0.7);
    };
    for (let n = 0; n < blocks.length; n++) {
      const b = blocks[n], ki = (t - b.tin) / P, ko = (t - b.tout) / P, { x, z, s } = b, cx = x + s / 2, cz = z + s / 2, cy = -s / 2;
      if (ki < 0 || ko >= 1.6) continue;
      if (ko < 0) {
        if (ki >= 1) cube(cx, cy, cz, s, true, s >= 10 ? EDGE : 0);
        else {
          // winking in: a white wire swells to the block, it fills with black, its rim cools down the ramp
          const g = ki < 0.35 ? 0.35 + 0.65 * ease.outBack(ki / 0.35) : 1;
          cube(cx, cy, cz, s * g, ki > 0.2, ki < 0.45 ? WHITE : ki < 0.6 ? C[6] : ki < 0.75 ? C[5] : ki < 0.9 ? C[4] : C[3]);
          lights.push([cx, cy, cz, s * 0.8 + 4, C[5], 0.45 * (1 - ki)]);
        }
        if (b.glint && ki > 0.15 && ki < 1.6) glints.push([b, (ki - 0.15) / 1.45, 1]);
        // pixel dust flickers round the fresh block
        if (ki < 1.4 && rand(frame, n, 9) < 0.35) motes.push([x + rand(frame, n, 10) * (s + 6) - 3, -rand(frame, n, 11) * (s + 4), z + rand(frame, n, 12) * (s + 6) - 3, rand(frame, n, 13) < 0.5 ? WHITE : C[6]]);
      } else {
        if (ko < 0.35) {
          // winking out: its rim lights up...
          const k = ko / 0.35;
          cube(cx, cy, cz, s, true, k < 0.4 ? C[4] : k < 0.75 ? C[5] : C[6]);
          lights.push([cx, cy, cz, s * 0.8 + 3, C[4], 0.35 * k]);
        } else if (ko < 0.75) {
          // ...the black drops away and the white outline collapses into its heart
          const k = (ko - 0.35) / 0.4;
          cube(cx, cy, cz, s * (1 - ease.inQuad(k) * 0.85), false, k < 0.5 ? WHITE : C[6]);
          lights.push([cx, cy, cz, s * 0.8 + 4, C[5], 0.45 * (1 - k * 0.5)]);
        } else if (ko < 1) {
          const k = (ko - 0.75) / 0.25;
          for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (!(dx || dy || dz) || k < 0.5) q.px(cx + dx, cy + dy, cz + dz, dx || dy || dz ? C[6] : WHITE);
          lights.push([cx, cy, cz, s * 0.5 + 3, C[5], 0.35 * (1 - k)]);
        }
        if (b.glint && ko > 0.3) glints.push([b, (ko - 0.3) / 1.3, -1]);
        if (ko > 0.3 && ko < 1.5 && rand(frame, n, 13) < 0.3) motes.push([x + rand(frame, n, 14) * (s + 6) - 3, -rand(frame, n, 15) * (s + 4), z + rand(frame, n, 16) * (s + 6) - 3, rand(frame, n, 16) < 0.5 ? WHITE : C[6]]);
      }
    }
    for (const [x, y, z, c] of motes) q.px(x, y, z, c);
    for (const [x, y, z, r, c, k] of lights) q.glow(x, y, z, r, c, k);
    // glints on top: a spinning star on a top corner of the cube, swelling and fading
    for (const [b, u, dir] of glints) {
      if (u <= 0 || u >= 1) continue;
      const L = b.L * Math.pow(Math.sin(Math.PI * u), 0.7);
      glint3(q, b.gx, -b.s, b.gz, L, b.spin * u * dir + 0.4, C[5], C[4]);
    }
  },
};
