// The banded light (posterized steps from a hot core to the edges, fine strands through it, light laid over the top)
// is adapted from Sprite Fusion's open-source holy light (https://www.spritefusion.com/pixel-art-vfx/holy-light),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, rand, mix, smooth, space, TAU, WHITE } from "../../core/index.js";
import { clip, rows } from "./_lib.js";

export const meta = {
  name: "God rays",
  desc: "Shafts of light slant down from high on the left, breathing and swaying, pooling on the floor, as drifting dust motes light up whenever they cross a beam.",
  tags: ["weather", "god rays", "light", "sunbeam", "dust", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 10,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#1a1208", "#3a2810", "#7a5a24", "#c89a44", "#f2d27a", "#fff2c4", "#ffffff"],
    seed: 3,
  },
};

const D = 10, W = 320, SX = -230, SY = -300;
// the fan's axis (down and to the right) and its normal; a pixel's place across the fan is its angle from it
const AX = Math.cos(0.94), AY = Math.sin(0.94), NX = -AY, NY = AX;
// the shafts: angle off the axis, half width (radians), strength, breathing (cycles a loop), sway
const SHAFTS = [
  { c: -0.27, h: 0.03, k: 0.65, b: 1, sw: 0.006 },
  { c: -0.17, h: 0.022, k: 0.55, b: 2, sw: 0.005 },
  { c: -0.07, h: 0.05, k: 1, b: 1, sw: 0.008 },
  { c: 0.03, h: 0.018, k: 0.6, b: 3, sw: 0.004 },
  { c: 0.12, h: 0.042, k: 0.85, b: 2, sw: 0.007 },
  { c: 0.23, h: 0.026, k: 0.6, b: 1, sw: 0.005 },
];
const STR = new Float32Array(512);

// light at a point: the shafts it's in, softened at their edges, fading with distance, threaded with strands
function lightAt(x, y, sh) {
  const dx = x - SX, dy = y - SY, r = dx * AX + dy * AY, ang = (dx * NX + dy * NY) / r;
  let e = 0;
  for (const s of sh) {
    const q = Math.abs(ang - s.c) / s.h;
    if (q < 1) e += s.k * (1 - q * q) ** 1.5;
  }
  if (e <= 0) return 0;
  const strand = STR[clamp(Math.floor((ang + 0.36) * 700), 0, 511)], fall = clamp(1.25 - (r - 230) / 420);
  return e * fall * (0.7 + 0.45 * strand);
}

export function drawBack(p, t, o) {
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 7);
  const sh = shafts(t, S);
  // dark air the light falls through, a dark floor it lands on; each beam posterized into a white-hot core, a
  // gold body and a soft translucent edge, brightest near the sun and fading as it falls
  const L = C.map((c) => mix(C[0], c, 0.75));
  const n = sh.length, SC = new Float32Array(n), SI = new Float32Array(n), SK = new Float32Array(n);
  sh.forEach((s, j) => ((SC[j] = s.c), (SI[j] = 1 / s.h), (SK[j] = s.k)));
  rows(p, meta, -170, 9, (y, R) => {
    const floor = y > 0, dy = y - SY, air = floor ? 0.8 : 0.66, boost = floor ? 1.6 : 1;
    let r = (-160 + 0.5 - SX) * AX + dy * AY, nn = (-160 + 0.5 - SX) * NX + dy * NY;
    R.a.fill(air);
    R.b.fill(1);
    R.c.fill(C[0]);
    for (let i = 0; i < W; i++, r += AX, nn += NX) {
      const ang = nn / r;
      let e = 0;
      for (let j = 0; j < n; j++) {
        const q2 = (ang - SC[j]) * SI[j];
        if (q2 > -1 && q2 < 1) {
          const w = 1 - q2 * q2;
          e += SK[j] * w * Math.sqrt(w);
        }
      }
      if (e <= 0) continue;
      const fall = 1.35 - (r - 200) / 330, si = ((ang + 0.36) * 700) | 0;
      e *= (fall > 1 ? 1 : fall < 0 ? 0 : fall) * (0.7 + 0.45 * STR[si < 0 ? 0 : si > 511 ? 511 : si]) * boost;
      if (e < 0.06) continue;
      const lv = e > 1.05 ? 6 : e > 0.78 ? 5 : e > 0.52 ? 4 : e > 0.3 ? 3 : 2;
      R.c[i] = floor ? C[lv] : L[lv];
      R.a[i] = floor ? 0.85 : Math.min(0.78, 0.12 + e * 0.5);
      R.l[i] = C[4];
      R.k[i] = e * (floor ? 0.32 : 0.26);
    }
  });
  // the sun's glare where the beams come in
  q.glow(-168, -178, 130, C[3], 0.3);
  q.glow(-168, -178, 50, C[5], 0.35);
  motes(q, t, S, C, sh, false);
}

export function draw(p, t, o) {
  const q = clip(p, meta), S = o.seed, C = fit(o.palette, 7);
  motes(q, t, S, C, shafts(t, S), true);
}

// each shaft breathes and sways on whole cycles; the strands drift slowly across the beams
function shafts(t, S) {
  for (let i = 0; i < 512; i++) {
    const a = i / 512;
    STR[i] = 0.5 + 0.5 * Math.sin(a * 190 + Math.sin((TAU * t) / D) * 2 + S) * Math.sin(a * 77 - (TAU * t) / D + S * 2);
  }
  return SHAFTS.map((s, i) => ({ c: s.c + s.sw * Math.sin((TAU * t) / D + i * 1.3), h: s.h * (1 + 0.15 * Math.sin((TAU * s.b * t) / D + i)), k: s.k * (0.72 + 0.28 * Math.sin((TAU * s.b * t) / D + i * 2.1)) }));
}

// dust motes drifting slowly, invisible in the dark, catching the light as they cross a beam
function motes(q, t, S, C, sh, front) {
  for (let i = front ? 0 : 50; i < (front ? 50 : 160); i++) {
    const R = (k) => rand(S, i, k), n1 = 1 + Math.floor(R(1) * 2), n2 = 1 + Math.floor(R(2) * 2);
    const x = -170 + R(3) * 340 + (8 + R(4) * 14) * Math.sin((TAU * n1 * t) / D + R(5) * TAU), y = -170 + R(6) * 172 + (6 + R(7) * 10) * Math.sin((TAU * n2 * t) / D + R(8) * TAU) + 4 * Math.sin((TAU * 3 * t) / D + i);
    const e = lightAt(x, y, sh);
    if (e < 0.12) continue;
    const big = front && R(9) < 0.5, k = Math.min(1, e);
    q.px(x, y, k > 0.6 ? WHITE : k > 0.3 ? C[5] : C[4]);
    if (big && k > 0.5) (q.px(x + 1, y, C[4]), q.px(x, y + 1, C[4]));
    q.glow(x, y, big ? 6 : 4, C[4], 0.4 * k);
  }
}

// 3D: real shafts of light. Broad parallel beams slant down through a cylinder of dusty air (radius 94, 108 high)
// from above and to the left, each a banded gold column seen round from every side (the 2D beam's hot core, gold
// body and soft edge, with strands drifting through it), dissolving upwards and landing in a pool on the floor.
// They overlap into a luminous haze; dust motes drift through it and only show where they catch a beam.
const H3 = 108, RC = 94, SL = [0.4, 0.12], HD = Math.hypot(SL[0], SL[1]), SLANT = Math.hypot(1, HD);
// where each beam lands (s across the slant, m along it), half width, strength, breathing (cycles a loop)
const BEAMS = [
  { s: -70, m: 8, hw: 9, k: 0.5, b: 1 },
  { s: -52, m: -34, hw: 7, k: 0.4, b: 2 },
  { s: -34, m: 20, hw: 15, k: 1, b: 1 },
  { s: -14, m: -14, hw: 6.5, k: 0.5, b: 3 },
  { s: 6, m: 34, hw: 12, k: 0.8, b: 2 },
  { s: 22, m: -26, hw: 8, k: 0.45, b: 1 },
  { s: 40, m: 6, hw: 21, k: 0.85, b: 2 },
  { s: 58, m: 30, hw: 7, k: 0.4, b: 3 },
  { s: -4, m: -48, hw: 10, k: 0.55, b: 1 },
];
const HX = SL[0] / HD, HZ = SL[1] / HD;

// the beams at time t: each breathes and sways on whole cycles; htop is where it leaves the cylinder or the ceiling
function beams3(t) {
  return BEAMS.map((B, i) => {
    const sw = 3 * Math.sin((TAU * t) / D + i * 1.3), s = B.s + sw, fx = HX * B.m - HZ * s, fz = HZ * B.m + HX * s;
    const a = SL[0] * SL[0] + SL[1] * SL[1], b = fx * SL[0] + fz * SL[1], c = fx * fx + fz * fz - RC * RC;
    const exit = (b + Math.sqrt(Math.max(0, b * b - a * c))) / a, wall = exit < H3;
    return {
      fx, fz, htop: Math.min(H3, exit), wall, i,
      hw: B.hw * (1 + 0.15 * Math.sin((TAU * B.b * t) / D + i)),
      k: B.k * (0.72 + 0.28 * Math.sin((TAU * B.b * t) / D + i * 2.1)),
    };
  });
}
// a point on the beam's axis at height h
const axis = (B, h) => [B.fx - SL[0] * h, -h, B.fz - SL[1] * h];
// how bright the beam is a fraction u of the way up: dissolving into the floor pool below, and into the air above
const fall3 = (B, u) => (0.5 + 0.5 * smooth(0, 0.3, u)) * (1 - smooth(0.68, 1, u));

// light at a point in the volume: the beams it's inside, softened at their edges
function lightAt3(x, y, z, bs) {
  const h = -y;
  let e = 0;
  for (const B of bs) {
    if (h < 0 || h > B.htop) continue;
    const dist = Math.hypot(x - (B.fx - SL[0] * h), z - (B.fz - SL[1] * h)) / SLANT, q = dist / B.hw;
    if (q < 1) e += B.k * (1 - q * q) ** 1.5 * fall3(B, h / B.htop);
  }
  return e;
}

// a translucent shaft with a round cross-section from every side: a ribbon on the screen from the foot to the top,
// fn(u, v, out) shades it by how far up it is (0 to 1) and how far across (-1 to 1) and sets out.c, out.a, out.l, out.k
const SH = { c: 0, a: 0, l: 0, k: 0 };
function shaft(q, A, B, hw, fn) {
  if (!q.project(...A)) return;
  const p = q.p, ax = q.x, ay = q.y, ad = q.d, r = hw * q.k;
  if (!q.project(...B)) return;
  const bx = q.x, by = q.y, bd = q.d, dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9, o = SH, z0 = p.z;
  p.each(Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r, (lx, ly, sx, sy) => {
    const along = (lx - ax) * dx + (ly - ay) * dy;
    if (along < 0 || along > L2) return;
    const f = along / L2, ex = ax + dx * f - lx, ey = ay + dy * f - ly, dist = Math.sqrt(ex * ex + ey * ey);
    if (dist > r) return;
    o.c = 0;
    o.k = 0;
    fn(f, ((lx - ax) * dy - (ly - ay) * dx > 0 ? dist : -dist) / r, o);
    if (!o.c) return;
    p.z = ad + (bd - ad) * f;
    p.blendPx(sx, sy, o.c, o.a);
    if (o.k > 0) p.add(sx, sy, o.l, o.k);
  });
  p.z = z0;
}

export const three = {
  meta: { size: [232, 168], origin: [116, 136], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), S = o.seed, C = fit(o.palette, 7), bs = beams3(t), L = C.map((c) => mix(C[0], c, 0.75));
    const lvl = (e) => (e > 1.05 ? 6 : e > 0.78 ? 5 : e > 0.52 ? 4 : e > 0.3 ? 3 : 2);
    // the pools the beams make on the floor: the same banded gold, brighter than the beam, a hot core
    q.plane(0, 0, 0, null, RC, (u, v, out) => {
      let e = 0;
      for (const B of bs) {
        const da = (u - B.fx) * HX + (v - B.fz) * HZ, dp = -(u - B.fx) * HZ + (v - B.fz) * HX, a = B.hw * 1.2 * SLANT, b = B.hw * 1.2;
        const s = (da * da) / (a * a) + (dp * dp) / (b * b), h = s / 4;
        if (s < 1) e += B.k * (1 - s) ** 1.5 * 0.8;
        // the spill of light round it, a ring of dimmer bands
        if (h < 1) e += B.k * (1 - h) ** 2 * 0.2;
      }
      if (e < 0.08) return;
      out.c = C[lvl(e)];
      out.blend = true;
      out.a = Math.min(0.85, 0.3 + e * 0.5);
      out.l = C[4];
      out.k = Math.min(1, e) * 0.2;
    });
    // the shafts far to near, each breathing; strands run through them and drift across
    for (const B of q.sort(bs, (b) => axis(b, b.htop * 0.5))) {
      const top = axis(B, B.htop), ph = B.i * 2.3, wob = Math.sin((TAU * t) / D) * 2;
      shaft(q, [B.fx, 0, B.fz], top, B.hw, (u, v, out) => {
        const w = 1 - v * v, strand = 0.5 + 0.5 * Math.sin(v * B.hw * 0.9 + ph + wob) * Math.sin(v * B.hw * 0.4 + ph - (TAU * t) / D + u * 3);
        const e = B.k * w * w * fall3(B, u) * (0.7 + 0.45 * strand) * 1.8;
        if (e < 0.06) return;
        const lv = lvl(e);
        out.c = L[lv];
        out.a = [0.1, 0.17, 0.27, 0.38, 0.52][lv - 2];
        out.l = C[4];
        out.k = e * 0.16;
      });
    }
    // where each beam comes in and where it lands, the light spills
    for (const B of bs) {
      q.glow(B.fx, -2, B.fz, B.hw * 3.4, C[4], 0.22 * B.k);
      q.glow(B.fx, -1, B.fz, B.hw * 1.6, C[5], 0.3 * B.k);
    }
    // dust motes: some drift in the beams, the rest through the open air, all unseen until they catch the light
    for (let i = 0; i < 220; i++) {
      const R = (k) => rand(S, i, k), n1 = 1 + Math.floor(R(1) * 2), n2 = 1 + Math.floor(R(2) * 2), n3 = 1 + Math.floor(R(3) * 2);
      let x, y, z;
      const near = R(4) < 0.75, amp = near ? 0.4 : 1;
      if (near) {
        const B = bs[i % bs.length], h = 6 + R(5) * (B.htop - 6), [ax, ay, az] = axis(B, h), a = R(6) * TAU, d = R(7) * B.hw * 1.5;
        [x, y, z] = [ax + Math.cos(a) * d, ay, az + Math.sin(a) * d];
      } else {
        const a = R(6) * TAU, d = Math.sqrt(R(7)) * (RC - 14);
        [x, y, z] = [Math.cos(a) * d, -6 - R(5) * (H3 - 12), Math.sin(a) * d];
      }
      x += amp * (6 + R(8) * 10) * Math.sin((TAU * n1 * t) / D + R(9) * TAU);
      y += (5 + R(10) * 8) * Math.sin((TAU * n2 * t) / D + R(11) * TAU) + 3 * Math.sin((TAU * 3 * t) / D + i);
      z += amp * (6 + R(12) * 10) * Math.sin((TAU * n3 * t) / D + R(13) * TAU);
      if (y > -2 || y < -H3 || Math.hypot(x, z) > RC) continue;
      const e = lightAt3(x, y, z, bs);
      if (e < 0.12) continue;
      const big = R(14) < 0.4, k = Math.min(1, e);
      q.px(x, y, z, k > 0.6 ? WHITE : k > 0.3 ? C[5] : C[4]);
      if (big && k > 0.5) (q.px(x + 1, y, z, C[4]), q.px(x, y + 1, z, C[4]));
      q.glow(x, y, z, big ? 6 : 4, C[4], 0.4 * k);
    }
  },
};
