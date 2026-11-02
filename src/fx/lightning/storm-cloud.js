// The bolt's forked shape, its halo-body-core inking and its flicker follow Sprite Fusion's open-source
// lightning (https://www.spritefusion.com/pixel-art-vfx/lightning), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, rng, cycle, smooth, space, TAU, WHITE, hex, loopNoise, tileNoise } from "../../core/index.js";
import { VOLT, PLASMA, zigzag, stroke, crackle, flight, spark, zigzag3, stroke3, crackle3, flight3, spark3 } from "./_lib.js";

export const meta = {
  name: "Storm cloud",
  desc: "A storm cloud boils overhead, billows lit from inside by flickering discharges, ragged scud under its flat dark base; rain slants down and once a loop a bolt cracks to the floor.",
  tags: ["lightning", "storm", "weather", "cloud", "rain", "ambient", "loop"],
  size: [168, 176],
  origin: [84, 164],
  duration: 3,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: VOLT, sparks: PLASMA, cloud: ["#09070f", "#120f1e", "#1b182e", "#252640", "#323758", "#464d78", "#646b9c"], rain: ["#2b3250", "#46527a", "#6d7cab", "#a5b5e0"], seed: 8 },
};

const FPS = 30, N = 90, P = 3, BASE = -100, TOP = -156, TH = 0.35, VIS = Math.sqrt(1 - Math.sqrt(TH));
// the billows: [x, y, visible radius, squash]; a tower leaning into a flat anvil sheared off to the right, big
// billows of all sizes below it, smaller shoulders, a flat run along the base
const BILLOWS = [
  [-6, -132, 17], [18, -127, 14], [-28, -122, 12], [38, -118, 10], [0, -142, 12],
  [14, -149, 19, 0.38], [40, -148, 14, 0.34],
  [-48, -113, 10], [55, -110, 9], [-17, -115, 13], [22, -113, 12],
  [-42, -104, 11], [-10, -104, 12], [20, -104, 11], [48, -103, 9], [-63, -104, 7], [66, -103, 6],
];
// discharges inside: [frame, billow, strength]; the bolt to the floor at frame BOLT, out of billow BOLT_B
const FLASHES = [[7, 2, 0.8], [8, 9, 0.55], [29, 1, 0.75], [31, 10, 1], [33, 3, 0.5], [70, 0, 0.8], [71, 4, 0.55], [72, 5, 0.35]];
const BOLT = 52, BOLT_B = 12, BK = [1, 0.7, 0.3, 0.95, 0.5, 0.75, 0.2];
const W0 = -84, H0 = TOP - 6, GW = 168, GH = BASE + 8 - H0;
const FIELD = new Float32Array(GW * GH), GX = new Float32Array(GW * GH), GY = new Float32Array(GW * GH), LIT = new Float32Array(GW * GH);

// where each billow is this frame: drifting, breathing and boiling up on its own clock, all seamless over the loop
function billows(seed, ph) {
  return BILLOWS.map(([x, y, v, sq = 1], i) => {
    const top = y < -112 && sq === 1, boil = 0.82 + 0.3 * Math.sin(Math.PI * ((ph + i * 0.37) % 1)) ** 2;
    return { sq, x: x + 3.5 * loopNoise(ph, 0.7, seed + i) + (sq < 1 ? 4 * loopNoise(ph, 0.5, seed + i + 90) : 0), y: y + 2 * loopNoise(ph, 0.7, seed + i + 30) - (top ? 4 * (boil - 0.97) : 0), r: (v * (top ? boil : 1 + 0.08 * loopNoise(ph, 0.6, seed + i + 60))) / VIS };
  });
}

// the cloud as one field: billows summed so they fuse, clipped flat at the base, its edge ragged with drifting
// noise; shaded as one mass (a lit top, a cool middle, a dark belly), discharges lighting whole billows from inside
function cloud(p, B, ph, seed, K, C, flashes) {
  FIELD.fill(0);
  GX.fill(0);
  GY.fill(0);
  LIT.fill(0);
  for (const [i, b] of B.entries()) {
    const k = flashes.get(i) ?? 0, r2 = b.r * b.r, ry = b.r * b.sq;
    for (let y = Math.max(0, Math.floor(b.y - ry - H0)); y < Math.min(GH, Math.ceil(b.y + ry - H0)); y++)
      for (let x = Math.max(0, Math.floor(b.x - b.r - W0)); x < Math.min(GW, Math.ceil(b.x + b.r - W0)); x++) {
        const dx = x + W0 + 0.5 - b.x, dy = (y + H0 + 0.5 - b.y) / b.sq, d2 = (dx * dx + dy * dy) / r2;
        if (d2 >= 1) continue;
        const j = y * GW + x, u = 1 - d2, c = u * u;
        FIELD[j] += c;
        GX[j] += (-4 * u * dx) / r2;
        GY[j] += (-4 * u * dy) / (r2 * b.sq);
        if (k) LIT[j] += k * (0.25 + 0.75 * c) * (d2 < 1 ? 1 : 0);
      }
  }
  const ramp = [...K, C[3], C[4], C[5], C[6]], n = K.length;
  for (let y = 0; y < GH; y++) {
    const cy = y + H0 + 0.5;
    for (let x = 0; x < GW; x++) {
      const j = y * GW + x;
      if (FIELD[j] < TH - 0.06) continue;
      const cx = x + W0 + 0.5, base = BASE + 1.5 * tileNoise(cx * 0.12 + 9 * ph, 3, 9, 0, seed + 5);
      const F = FIELD[j] * (1 - smooth(base - 3, base, cy)) + 0.05 * tileNoise(cx * 0.21 + 18 * ph, cy * 0.21, 18, 0, seed);
      if (F < TH) continue;
      // the field's slope rounds each billow's top; height does the rest: lit above, cool in the middle, dark below
      const gl = Math.hypot(GX[j], GY[j]) || 1, lam = -(GX[j] * 0.42 + GY[j] * 0.9) / gl, edge = Math.min(1, gl * 5) * (F < TH + 0.08 ? 1 : 0.55);
      const h = 1 - 2 * clamp((cy - TOP) / (BASE - TOP));
      let i = 2.7 + 2.2 * h + 1.3 * lam * edge + 0.4 * tileNoise(cx * 0.16 + 12 * ph, cy * 0.16, 12, 0, seed + 9);
      if (F < TH + 0.05 && lam > 0.3 && h > -0.5) i += 1;
      if (cy > base - 6) i -= 1;
      i = clamp(Math.round(i), 0, n - 1);
      // lit from inside: brightest deep in the billow, breaking up through the cloud's own lumps toward its edges
      const L = LIT[j] * (0.7 + 0.6 * tileNoise(cx * 0.2 - 14 * ph, cy * 0.2, 14, 0, seed + 3));
      if (L > 0.12) i = Math.min(ramp.length - 1, i + Math.round(L * 5.5));
      p.px(cx, cy, ramp[i]);
    }
  }
}

// scud: ragged wisps that form under the base, drift off on the wind and fray away
function scud(p, ph, seed, K) {
  const r = rng(seed, 13);
  for (let w = 0; w < 6; w++) {
    const x0 = r.range(-60, 60), y0 = BASE + r.range(3, 9), rx = r.range(10, 20), ry = r.range(1.3, 2.2), off = r.next(), u = (ph + off) % 1, a = Math.sin(Math.PI * u) ** 0.8;
    const xc = x0 + 16 * (u - 0.5);
    for (let y = Math.floor(y0 - ry - 1); y <= y0 + ry + 1; y++)
      for (let x = Math.floor(xc - rx - 1); x <= xc + rx + 1; x++) {
        const dx = (x + 0.5 - xc) / rx, dy = (y + 0.5 - y0) / ry, nz = tileNoise((x + 0.5) * 0.35 + 10 * ph + w * 7, (y + 0.5) * 0.5, 10, 0, seed + 20 + w);
        const v = (1 - dx * dx - dy * dy) * a + 0.6 * nz - 0.25;
        if (v > 0) p.blend(x + 0.5, y + 0.5, v > 0.4 ? K[2] : K[3], Math.min(0.6, 0.2 + v * 0.7));
      }
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), K = fit(o.cloud, 7), RN = fit(o.rain, 4), S = o.sparks.map(hex), f = Math.floor(t * FPS + 1e-6) % N, ph = f / N;
  const B = billows(o.seed, ph), br = rng(o.seed, 5, BOLT), ba = f - BOLT;
  const bx0 = BILLOWS[BOLT_B][0] + br.range(-4, 4), bx1 = br.range(-24, 24);
  // what's lighting the cloud this frame: discharges inside billows, and the billow the bolt leaves from
  const flashes = new Map(FLASHES.filter(([ff]) => ff === f).map(([, b, k]) => [b, k]));
  if (ba >= 0 && ba < BK.length) flashes.set(BOLT_B, Math.max(flashes.get(BOLT_B) ?? 0, BK[ba]));
  const lights = [...flashes].map(([b, k]) => ({ x: B[b].x, y: B[b].y, k, r: B[b].r * VIS * (B[b].sq < 1 ? 1.6 : 2.2) }));
  const flash = lights.reduce((s, l) => Math.max(s, l.k), 0);

  // rain: slanting streaks from the belly, splashing on the floor, lit when the sky flashes
  cycle(t, P, 150, o.seed + 11, (g) => g.range(0.5, 0.62), (age, life, r) => {
    const x0 = r.range(-62, 62), vy = r.range(190, 240), vx = -vy * 0.18, tf = (0 - (BASE + 4)) / vy;
    if (age < tf) {
      const x = x0 + vx * age, y = BASE + 4 + vy * age, l = r.range(4, 6.5);
      p.line(x - vx * 0.018 * (l / 4), y - l, x, y, (u) => (u > 0.7 ? (flash > 0.5 ? C[5] : RN[3]) : flash > 0.5 ? C[3] : RN[u > 0.35 ? 2 : 1]));
    } else if (age < tf + 0.12) {
      const x = x0 + vx * tf, a = (age - tf) / 0.12;
      for (const s of [-1, 1]) p.px(x + s * (1 + a * 2.5), -1 - Math.sin(a * Math.PI) * 2.5, a < 0.5 ? RN[3] : RN[2]);
      if (a < 0.4) p.px(x, 0, RN[3]);
    }
  });
  // the scud hanging under the base, the cloud, then the light of whatever burns inside it
  scud(p, ph, o.seed, K);
  cloud(p, B, ph, o.seed, K, C, flashes);
  for (const l of lights) p.glow(l.x, l.y, l.r, C[4], 0.4 * l.k);
  p.glow(0, -122, 80, C[2], 0.05 + 0.22 * flash);
  // a discharge crawls along the belly now and then
  for (const [ff, b, k] of FLASHES)
    if (ff === f && k > 0.6) {
      const r = rng(o.seed, 7, ff), x = B[b].x;
      crackle(p, zigzag(r, x - r.range(12, 22), BASE - r.range(2, 6), x + r.range(12, 22), BASE - r.range(1, 5), 0.25, 0.5), 0.6, C, 0.4);
    }
  // the bolt: struck once a loop, forked, flickering, the floor lit and sparks thrown where it lands
  if (ba >= 0 && ba < BK.length) {
    const k = BK[ba];
    stroke(p, zigzag(rng(o.seed, 9, BOLT), bx0, BASE - 3, bx1, 0, 0.22, 0.7), k, C, ba === 0 ? 1.15 : 1, { hero: ba === 0 });
    p.circle(bx1, -1, 3 * k + 1.5, C[2]);
    p.circle(bx1, -1, 3 * k + 0.5, C[5]);
    p.circle(bx1, -1, 2 * k, WHITE);
    p.glow(bx1, -22, 78, C[3], 0.5 * k);
    p.glow(bx1, -3, 18, C[5], 0.45 * k);
    p.glow(bx0, BASE, 84, C[4], 0.3 * k);
  }
  const sa = (((t - BOLT / FPS) % P) + P) % P;
  for (let j = 0; j < 16; j++) {
    const q = rng(o.seed, 31, j), life = q.range(0.25, 0.6);
    if (sa >= life) continue;
    const a = -Math.PI / 2 + q.range(-1.3, 1.3), sp = q.range(60, 200), [x, y, vx, vy] = flight(bx1, -1, Math.cos(a) * sp, Math.sin(a) * sp, sa, { floor: 0 });
    spark(p, x, y, vx, vy, 1 - sa / life, S);
  }
}

// ---- 3D: the storm as a volume. The cloud is a pile of lit balls (a flat dark base, shoulders, a tower leaning into
// an anvil sheared out to +x), rain falls through the whole column onto the floor, and the bolt cracks down at a point
// of the ground round the tower.
const FOOT = 64;
// the billows: [x, y, z, r]; a base row clipped flat, tiers above it, a tower and an anvil sheared out to +x
function pile(seed) {
  const r = rng(seed, 1), out = [];
  const add = (x, y, z, rr, tier) => out.push({ x, y, z, r: rr, tier });
  for (let i = 0; i < 18; i++) {
    const a = i * 2.39996, d = 4 + 56 * Math.sqrt((i + 0.5) / 18), R0 = r.range(9, 14);
    add(Math.cos(a) * d, BASE - R0 * 0.3 - r.range(0, 3), Math.sin(a) * d, R0, 0);
  }
  for (let i = 0; i < 12; i++) {
    const a = i * 2.4 + 0.7, d = 3 + 42 * Math.sqrt((i + 0.5) / 12), R0 = r.range(9, 13);
    add(Math.cos(a) * d, BASE - R0 * 0.6 - r.range(5, 12), Math.sin(a) * d, R0, 1);
  }
  for (let i = 0; i < 8; i++) {
    const a = i * 0.85 + 0.3, d = 6 + 24 * Math.sqrt((i + 0.5) / 8), R0 = r.range(9, 12);
    add(Math.cos(a) * d, r.range(-136, -126), Math.sin(a) * d, R0, 2);
  }
  for (const [x, y, z, R0] of [[-8, -132, -1, 16], [10, -138, 4, 14], [-2, -146, -4, 13], [8, -150, 2, 11], [-10, -148, 6, 9], [2, -157, 0, 8]]) add(x, y, z, R0, 3);
  for (let i = 0; i < 12; i++) add(14 + (i % 6) * 8 + r.range(-3, 3), -138 - r.range(0, 8), r.range(-1, 1) * (22 - (i % 6) * 3), r.range(6, 9), 4);
  return out;
}
// discharges inside: [frame, ball, strength]; the bolt leaves from the base ball nearest the middle
const FLASHES3 = [[7, 40, 0.8], [8, 34, 0.55], [29, 38, 0.75], [31, 22, 1], [33, 46, 0.5], [70, 41, 0.8], [71, 48, 0.55], [72, 49, 0.35]];

export const three = {
  meta: { size: [184, 206], origin: [92, 180], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), K = fit(o.cloud, 7), RN = fit(o.rain, 4), S = o.sparks.map(hex), f = Math.floor(t * FPS + 1e-6) % N, ph = f / N;
    const B0 = pile(o.seed), root = B0.slice(0, 13).reduce((a, b) => (Math.hypot(b.x, b.z) < Math.hypot(a.x, a.z) ? b : a)), RI = B0.indexOf(root);
    const br = rng(o.seed, 5, BOLT), ba = f - BOLT, bz0 = root.z, bx0 = root.x + br.range(-4, 4);
    const bx1 = br.range(-26, 26), bz1 = br.range(-26, 26);
    // the pile this frame: drifting, breathing and boiling on its own clock, seamless over the loop
    const cp = Math.cos(q.camera.pitch), sp = Math.sin(q.camera.pitch);
    const B = B0.map((b, i) => {
      const boil = 0.88 + 0.22 * Math.sin(Math.PI * ((ph + i * 0.37) % 1)) ** 2, top = b.tier === 3;
      return { ...b, i, x: b.x + 3 * loopNoise(ph, 0.7, o.seed + i), y: b.y + 2 * loopNoise(ph, 0.7, o.seed + i + 30) - (top ? 3 * (boil - 0.97) : 0), z: b.z + 3 * loopNoise(ph, 0.7, o.seed + i + 60), r: b.r * (top ? boil : 1 + 0.06 * loopNoise(ph, 0.6, o.seed + i + 90)) };
    });
    // what lights the cloud this frame: discharges inside it, and the base ball the bolt leaves from
    const fl = FLASHES3.filter(([ff]) => ff === f).map(([, b, k]) => ({ b: B[b % B.length], k }));
    if (ba >= 0 && ba < BK.length) fl.push({ b: B[RI], k: BK[ba] });
    const flash = fl.reduce((s, l) => Math.max(s, l.k), 0), ramp = [...K, C[3], C[4], C[5], C[6]], top = BASE - 56;
    // solid things first, nearest first: the cloud, then rain and bolt
    const order = q.sort(B, (b) => [b.x, b.y, b.z]).reverse();
    for (const b of order) {
      let L = 0;
      for (const l of fl) L += l.k * Math.exp(-(((b.x - l.b.x) ** 2 + (b.y - l.b.y) ** 2 + (b.z - l.b.z) ** 2) / (30 + l.b.r) ** 2));
      const wy = (ny, nz) => b.y + b.r * (ny * cp - nz * sp), k = b.i;
      q.ball(b.x, b.y, b.z, b.r, (nx, ny, nz) => {
        const lam = nx * -0.33 + ny * -0.85 + nz * 0.4, h = 1 - 2 * clamp((wy(ny, nz) - TOP) / (BASE - TOP));
        let i = 2.7 + 2.3 * h + 1 * lam - (nz < 0.35 ? 0.9 * (0.35 - nz) * 3 : 0) + 0.55 * Math.sin(nx * b.r * 0.42 + k * 1.7) * Math.sin(ny * b.r * 0.46 + k);
        if (L > 0.1) i += Math.round(L * 3.4 * (0.3 + 0.7 * nz));
        return ramp[clamp(Math.round(i), 0, ramp.length - 1)];
      }, (nx, ny, nz) => (wy(ny, nz) > BASE + 1.2 * Math.sin(nx * b.r * 0.9 + k) ? 0 : 1));
    }
    // rain: slanting streaks from the belly through the whole column, splashing on the floor, lit when the sky flashes
    cycle(t, P, 190, o.seed + 11, (g) => g.range(0.5, 0.62), (age, life, r) => {
      const a0 = r.range(0, TAU), d0 = FOOT * Math.sqrt(r.next()), x0 = Math.cos(a0) * d0, z0 = Math.sin(a0) * d0, vy = r.range(190, 240), vx = -vy * 0.18, tf = (0 - (BASE + 4)) / vy;
      if (age < tf) {
        const x = x0 + vx * age, y = BASE + 4 + vy * age, l = r.range(4, 6.5);
        q.line(x - vx * 0.018 * (l / 4), y - l, z0, x, y, z0, (u) => (u > 0.7 ? (flash > 0.5 ? C[5] : RN[3]) : flash > 0.5 ? C[3] : RN[u > 0.35 ? 2 : 1]));
      } else if (age < tf + 0.12) {
        const x = x0 + vx * tf, a = (age - tf) / 0.12, c = a < 0.5 ? RN[3] : RN[2];
        for (let j = 0; j < 4; j++) q.px(x + Math.cos(j * 1.57 + 0.5) * (1 + a * 2.5), -1 - Math.sin(a * Math.PI) * 2.5, z0 + Math.sin(j * 1.57 + 0.5) * (1 + a * 2.5), c);
        if (a < 0.4) q.px(x, 0, z0, RN[3]);
      }
    });
    // a discharge crawls along the belly now and then
    for (const [ff, b, k] of FLASHES3)
      if (ff === f && k > 0.6) {
        const r = rng(o.seed, 7, ff), c = B[b % B.length], a0 = r.range(0, TAU), d = r.range(12, 22);
        crackle3(q, zigzag3(r, [c.x - Math.cos(a0) * d, BASE - r.range(2, 6), c.z - Math.sin(a0) * d], [c.x + Math.cos(a0) * d, BASE - r.range(1, 5), c.z + Math.sin(a0) * d], 0.25, 0.5), 0.6, C, 0.4);
      }
    // the bolt: struck once a loop, forked, flickering, the floor lit and sparks thrown where it lands
    if (ba >= 0 && ba < BK.length) {
      const k = BK[ba];
      stroke3(q, zigzag3(rng(o.seed, 9, BOLT), [bx0, BASE - 3, bz0], [bx1, 0, bz1], 0.22, 0.7), k, C, ba === 0 ? 1.15 : 1, { hero: ba === 0 });
      q.plane(bx1, -0.5, bz1, null, 3 * k + 1.5, (u, v) => (Math.hypot(u, v) > 3 * k + 0.5 ? C[2] : Math.hypot(u, v) > 2 * k ? C[5] : WHITE));
      q.glow(bx1, -22, bz1, 78, C[3], 0.5 * k);
      q.glow(bx1, -3, bz1, 18, C[5], 0.45 * k);
      q.glow(bx0, BASE, bz0, 84, C[4], 0.3 * k);
    }
    const sa = (((t - BOLT / FPS) % P) + P) % P;
    for (let j = 0; j < 16; j++) {
      const qq = rng(o.seed, 31, j), life = qq.range(0.25, 0.6);
      if (sa >= life) continue;
      const a = -Math.PI / 2 + qq.range(-1.3, 1.3), sp = qq.range(60, 200), phi = qq.range(0, TAU), hz = Math.cos(a) * sp;
      const [x, y, z, vx, vy, vz] = flight3(bx1, -1, bz1, hz * Math.cos(phi), Math.sin(a) * sp, hz * Math.sin(phi), sa, { floor: 0 });
      spark3(q, x, y, z, vx, vy, vz, 1 - sa / life, S);
    }
    // light: what burns inside the cloud, and the glow it casts down the column
    for (const l of fl) q.glow(l.b.x, l.b.y, l.b.z, l.b.r * 2.6, C[4], 0.4 * l.k);
    q.glow(0, -122, 0, 84, C[2], 0.05 + 0.22 * flash);
    if (flash > 0.2) q.glow(0, -60, 0, 80, C[2], 0.1 * flash);
    // the scud hanging under the base: ragged wisps that form, drift off on the wind and fray away
    const wisps = [], rs = rng(o.seed, 13);
    for (let w = 0; w < 7; w++) {
      const a0 = rs.range(0, TAU), d0 = rs.range(0, 48), y0 = BASE + rs.range(3, 9), off = rs.next(), u = (ph + off) % 1, a = Math.sin(Math.PI * u) ** 0.8, sz = rs.range(5, 8);
      for (let j = -1; j <= 1; j++) wisps.push([Math.cos(a0) * d0 + 16 * (u - 0.5) + j * sz * 1.3, y0 + (j & 1) * 1.2, Math.sin(a0) * d0, sz * (j ? 0.75 : 1), a, w]);
    }
    for (const [x, y, z, rr, a] of q.sort(wisps, (e) => e)) q.disc(x, y, z, rr, () => K[3], (d) => 0.34 * a * (1 - d * d));
  },
};
