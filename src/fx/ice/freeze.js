// The crack-and-burst recipe (cracks walking out from a point, a white frame, the ice flung apart as shards
// with ice dust and glints) is adapted from Sprite Fusion's open-source ice
// (https://www.spritefusion.com/pixel-art-vfx/ice), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, B, Rng, fit, space, flare, sparkle, clamp, smooth, seg, ease, rand, mix, TAU, WHITE, READY } from "../../core/index.js";
import { Panes, Panes3, endBy, inPoly, centroid, splitPoly, iceOf, fractures, drawFractures, drawFractures3, face3 } from "./_lib.js";

export const meta = {
  name: "Freeze",
  desc: "Frost races in and climbs the character, turning it to ice; a faceted block crystallizes round it pane by pane, glints, cracks and bursts, and the character thaws free.",
  tags: ["ice", "freeze", "frozen", "status", "crowd-control", "one-shot"],
  size: [176, 128],
  origin: [88, 108],
  duration: 4,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#dcfbff", "#ffffff"], seed: 5 },
};

const FEAR = { turn: 0.9, lean: -2, crouch: 2, fx: -8, fy: -31, bx: 9, by: -31, ffx: -3, fbx: 4 };
const FREE = { turn: 1, crouch: 5, fx: -12, fy: -18, bx: 12, by: -18, ffx: -5, fbx: 6 };
export const act = {
  onBody: true,
  poses: [
    [-0.2, READY],
    [0.05, READY],
    [0.16, FEAR, "snap"],
    [0.3, { ...FEAR, lean: -1, fx: -10, fy: -34 }],
    [0.45, { ...FEAR, lean: -3, bx: 11, by: -34, fx: -7, fy: -29 }],
    [0.62, FEAR],
    [2.52, FEAR],
    [2.54, FREE, "snap"],
    [2.9, { ...FREE, crouch: 4 }],
    [3.1, { ...FREE, crouch: 3, lean: 1 }],
    [3.3, { ...FREE, crouch: 3, lean: -1 }],
    [4, READY],
  ],
  hits: [{ t: 0.62, stop: 0.03, shake: 0.08, amp: 1 }, { t: 2.52, stop: 0.05, shake: 0.2, amp: 2 }],
};

const SNAP = 0.16; // frost lines race in along the floor to the feet
const CLIMB = [0.14, 0.62]; // and climb the character
const SEAL = 0.6; // the block crystallizes, pane by pane
const SWEEPS = [1.12, 1.82]; // light slides across the faces while it holds
const CRACK = 2.2, CRACK2 = 2.34, FLASH = 2.46, BURST = 2.52, THAW = 0.36;
const MELT = [2.95, 3.7]; // the floor frost goes
const REACH = 38, CORE = [0, -21];

// the block: a crown of three crystal points over straight sides, eleven corners round the character and
// eight inside, cut into thirteen panes. Each pane: its corners, how much light it catches (0 shadow .. 1 lit)
// and when it crystallizes after SEAL (from the floor up).
const V = {
  l0: [-15, 0], l1: [-17, -10], l2: [-17, -31], p1: [-12, -45], n1: [-6, -42], p2: [0, -52], n2: [6, -43], p3: [12, -47], r2: [17, -30], r1: [16, -9], r0: [14, 0],
  i0: [-6, -36], i1: [6, -35], i2: [-9, -21], i3: [3, -25], i4: [9, -13], i5: [-5, -8], i6: [2, 0], i7: [0, -40],
};
const FACETS = [
  ["l0 l1 i5 i6", 0.62, 0], ["i5 i4 i6", 0.42, 0.03], ["i4 r2 r1 r0 i6", 0.2, 0.05], ["l1 l2 i2 i5", 0.74, 0.08], ["i2 i3 i4 i5", 0.5, 0.1],
  ["i1 r2 i4 i3", 0.28, 0.13], ["l2 i0 i2", 0.7, 0.15], ["i0 i1 i3 i2", 0.58, 0.18], ["n1 i7 n2 i1 i0", 0.52, 0.2], ["i1 n2 p3 r2", 0.4, 0.23],
  ["l2 p1 n1 i0", 0.88, 0.25], ["p2 n2 i7", 0.66, 0.28], ["n1 p2 i7", 1, 0.31],
].map(([k, lit, at], i) => ({ pts: k.split(" ").map((v) => V[v]), lit, at: SEAL + at, i }));
const OUTLINE = "l0 l1 l2 p1 n1 p2 n2 p3 r2 r1 r0".split(" ").map((v) => V[v]);
const X0 = -18, X1 = 18, Y0 = -53, Y1 = 0, BW = X1 - X0;

// frost on the floor: a crust on the floor line, rime ferns standing up from it, a cold bloom under the surface
function floorFrost(p, C, t, out) {
  for (let x = -REACH; x <= REACH; x++) {
    const d = Math.abs(x + 0.5) / REACH, arrive = SNAP * (1 - d), age = t - arrive;
    if (age < 0) continue;
    const a = out * clamp((1.12 - d) / 0.2), g = smooth(0, 0.4, age), h = rand(x, 31), s = x < 0 ? -1 : 1;
    if (a <= 0) continue;
    p.dot(x, 0, age < 0.05 || h < 0.3 ? WHITE : C[6], a);
    if (h < 0.55) {
      const L = Math.round(g * (1 + rand(x, 7) * 3.4) * (1 - d * 0.55));
      for (let j = 1; j <= L; j++) p.dot(x, -j, j === L ? WHITE : C[5], a);
      if (L >= 2) p.dot(x + s, -L + 1, C[6], a);
      if (L >= 4) p.dot(x - s, -L + 2, C[5], a);
    }
    const D = g * (2 + rand(x, 11) * 4) * (1 - d * 0.5);
    for (let j = 1; j <= D; j++) p.dot(x, j, rand(x * 13 + j, 5) < 0.07 ? WHITE : j < 2 ? C[5] : j < 4 ? C[4] : C[3], a * (1.05 - j / (D + 1)));
  }
}

// ---- the character: each pixel's frozen color and when the frost reaches it. A randomized flood up from the
// feet, quicker round the outline, so the front creeps up the edges first in ragged fingers. Shared by the 2D and the 3D effect.
function frozenBody(A, o, C, R) {
  const W = A.w, H = A.h, N = W * H, on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && A.mask.data[y * W + x] > 0;
  const dist = new Float32Array(N).fill(Infinity), ice = new Uint32Array(N), rim = new Uint8Array(N);
  const open = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!on(x, y)) continue;
      const i = y * W + x;
      rim[i] = !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) ? 1 : 0;
      const up = !on(x - 1, y) || !on(x, y - 1);
      ice[i] = mix(up ? C[Math.min(7, C.indexOf(iceOf(A.pixels[i], C)) + 1)] : iceOf(A.pixels[i], C), C[6], 0.2);
      if (y === H - 1 || !on(x, y + 1)) if (y >= H - 4) (dist[i] = R.range(0, 1.5)), open.push(i);
    }
  const done = new Uint8Array(N);
  while (open.length) {
    let bi = 0;
    for (let j = 1; j < open.length; j++) if (dist[open[j]] < dist[open[bi]]) bi = j;
    const i = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (done[i]) continue;
    done[i] = 1;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (!on(nx, ny)) continue;
      const j = ny * W + nx, w = (rim[j] ? 0.55 : 1) * (dy < 0 ? 1 : 1.3) + R.range(0, 1.5);
      if (dist[i] + w < dist[j]) (dist[j] = dist[i] + w), open.push(j);
    }
  }
  let maxD = 0;
  for (let i = 0; i < N; i++) if (dist[i] < Infinity) maxD = Math.max(maxD, dist[i]);
  const reach = new Float32Array(N), order = [];
  for (let i = 0; i < N; i++)
    if (dist[i] < Infinity) {
      reach[i] = CLIMB[0] + (CLIMB[1] - CLIMB[0]) * Math.pow(dist[i] / maxD, 0.85);
      order.push(i);
    }
  order.sort((a, b) => reach[a] - reach[b]);
  // rime feathers: little ticks of frost standing out from the outline once the frost has passed
  const feathers = [];
  for (const i of order) {
    const x = i % W, y = (i / W) | 0;
    if (!rim[i] || rand(i, o.seed, 3) > 0.42 || y > H - 3) continue;
    const dx = !on(x - 1, y) ? -1 : !on(x + 1, y) ? 1 : rand(i, 9) < 0.5 ? -1 : 1, dy = !on(x, y - 1) ? -1 : rand(i, 4) < 0.5 ? -1 : 0;
    feathers.push({ x: A.x + x + dx, y: A.y + y + dy, dx, dy, L: 1 + Math.floor(rand(i, 7) * 2.6), at: reach[i] + 0.04 });
  }
  return { A, W, H, order, reach, ice, feathers };
}

// the frozen character: each pixel turns as the frost reaches it, white at the front; after the burst the
// ice runs off it from the top down
function paintBody(p, t, { A, W, H, order, reach, ice, feathers }, C) {
  const thaw = t >= BURST ? ease.inQuad(seg(t, BURST, BURST + THAW)) * (H + 2) - 2 : -1;
  for (const i of order) {
    const age = t - reach[i];
    if (age < 0) break;
    const x = i % W, y = (i / W) | 0;
    if (y < thaw) continue;
    p.px(A.x + x, A.y + y, y < thaw + 1.2 && t >= BURST ? C[7] : age < 0.016 ? WHITE : age < 0.045 ? C[6] : ice[i]);
    if (age < 0.03) p.light(A.x + x, A.y + y, C[6], 0.3);
  }
  if (t >= BURST) return;
  for (const f of feathers) {
    const g = clamp((t - f.at) / 0.08);
    if (g <= 0) continue;
    const L = Math.round(f.L * g);
    for (let j = 0; j < L; j++) p.px(f.x + f.dx * j, f.y + f.dy * j, j === L - 1 ? WHITE : C[6]);
  }
}

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), A = o.actor, floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]], haze: C[5] });
  const bits = new Bits({ ground: floor }), lights = new Lights();
  const panes = new Panes({
    ground: floor,
    onLand: (q, x, y, v) => {
      // a pane that lands breaks into splinters that skip along the floor, with a puff of ice dust and a glint
      for (let i = 0; i < 3; i++) bits.add({ kind: B.SHARD, x: x + R.range(-2, 2), y: y - 1, vx: q.vx * 0.6 + R.range(-50, 50), vy: -R.range(30, 100), g: 0.8, drag: 0.6, bounce: 0.35, life: R.range(0.4, 0.8), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1.2, 2.4), c: C[R.int(5, 7)] });
      ps.spawn(P.VAPOUR, x, y - 1, R.range(-25, 25), -R.range(2, 10), R.range(0.4, 0.7), C[6], R.range(1.4, 2.4));
      if (R.chance(0.4)) ps.spawn(P.STAR, x, y - 2, 0, -6, R.range(0.2, 0.4), WHITE, R.range(0.8, 1.6));
    },
  });

  const body = frozenBody(A, o, C, R), { W, H, order, reach, feathers } = body;

  // ---- the block: which pane every pixel belongs to, the panes' looks, the edges they share
  const fid = new Int8Array(BW * (Y1 - Y0)).fill(-1), inBlock = (x, y) => inPoly(OUTLINE, x, y);
  for (let y = Y0; y < Y1; y++)
    for (let x = X0; x < X1; x++) {
      if (!inBlock(x + 0.5, y + 0.5)) continue;
      let f = FACETS.findIndex((F) => inPoly(F.pts, x + 0.5, y + 0.5));
      if (f < 0) f = FACETS.reduce((b, F, k) => (Math.hypot(centroid(F.pts).x - x, centroid(F.pts).y - y) < Math.hypot(centroid(FACETS[b].pts).x - x, centroid(FACETS[b].pts).y - y) ? k : b), 0);
      fid[(y - Y0) * BW + (x - X0)] = f;
    }
  const at = (x, y) => (x < X0 || x >= X1 || y < Y0 || y >= Y1 ? -1 : fid[(y - Y0) * BW + (x - X0)]);
  for (const F of FACETS) {
    F.c = centroid(F.pts);
    F.tint = C[3 + Math.round(F.lit * 3)];
    F.alpha = 0.2 + 0.24 * F.lit;
    F.d = clamp((F.c.x + 0.55 * F.c.y + 36) / 46);
    F.len = F.pts.reduce((s, q, k) => s + Math.hypot(F.pts[(k + 1) % F.pts.length][0] - q[0], F.pts[(k + 1) % F.pts.length][1] - q[1]), 0);
  }
  // every edge once: its ends, the panes it borders, whether it's on the outline and how it faces the light
  const EDGES = [];
  for (const F of FACETS)
    F.pts.forEach((a, k) => {
      const b = F.pts[(k + 1) % F.pts.length];
      let e = EDGES.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
      if (!e) EDGES.push((e = { a, b, fs: [] }));
      e.fs.push(F);
    });
  for (const e of EDGES) {
    const [x0, y0] = e.a, [x1, y1] = e.b, c = e.fs[0].c;
    let nx = y1 - y0, ny = x0 - x1;
    if (nx * ((x0 + x1) / 2 - c.x) + ny * ((y0 + y1) / 2 - c.y) < 0) (nx = -nx), (ny = -ny);
    e.outer = e.fs.length === 1;
    e.lit = (-nx * 0.55 - ny * 0.84) / Math.hypot(nx, ny);
    e.floor = y0 === 0 && y1 === 0;
    e.at = Math.min(...e.fs.map((F) => F.at));
  }
  const VERTS = Object.values(V);
  const cracks = fractures(R, (x, y) => inBlock(x, y), CORE[0], CORE[1], 3, { len: 9, a0: -2.2, spread: 3.6 });
  const cracks2 = fractures(R, (x, y) => inBlock(x, y), CORE[0] + 1, CORE[1] - 2, 6, { len: 16, fork: 0.22 });

  let t = 0, formed = 0, sealed = false, struck = 0, burst = false, white = false;
  const jolt = () => (t >= CRACK && t < CRACK + 0.06 ? 1 : t >= CRACK2 && t < FLASH ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0);

  const drawCharacter = (p) => paintBody(p, t, body, C);

  // the block: panes fill in as they crystallize (edges traced in white, a white flash, then glassy), a light
  // sweep that breaks at every facet, cracks, the white frame before it bursts
  const drawBlock = (p) => {
    if (t >= BURST || t < SEAL - 0.08) return;
    const jx = jolt(), wh = t >= FLASH;
    // light slides across the block: each facet flashes whole as the light passes it, the lit ones brightest
    for (const F of FACETS) F.g = SWEEPS.reduce((g, s0) => Math.max(g, Math.sin(Math.PI * clamp((t - s0 - F.d * 0.32) / 0.13))), 0) * (0.35 + 0.65 * F.lit);
    for (let y = Y0; y < Y1; y++)
      for (let x = X0; x < X1; x++) {
        const f = at(x, y);
        if (f < 0) continue;
        const F = FACETS[f], age = t - F.at;
        if (age < 0) continue;
        if (wh) {
          p.px(x + jx, y, WHITE);
          continue;
        }
        if (age < 0.03) {
          p.blend(x + jx, y, C[7], 0.55);
          continue;
        }
        const fresh = 1 - clamp((age - 0.03) / 0.1), g = F.g;
        p.blend(x + jx, y, fresh > 0.5 || g > 0.5 ? C[6] : F.tint, F.alpha + 0.25 * fresh + 0.15 * g);
        if (g > 0.05) p.light(x + jx, y, C[5], 0.42 * g);
      }
    // edges: the outline lit where it faces up and left, cool on the shadow side with a deep rim outside it;
    // inner edges pale; any pane that has just set rings white
    for (const e of EDGES) {
      if (e.floor || t < e.at) continue;
      const [x0, y0] = e.a, [x1, y1] = e.b, fresh = e.fs.some((F) => t - F.at < 0.1 || F.g > 0.6);
      if (e.outer && e.lit < 0 && !wh) p.line(x0 + jx + 1, y0, x1 + jx + 1, y1, C[1]);
      if (e.outer) p.glowLine(x0 + jx, y0, x1 + jx, y1, 5, C[4], 0.1);
      p.line(x0 + jx, y0, x1 + jx, y1, wh ? C[6] : fresh ? WHITE : e.outer ? (e.lit > 0.3 ? WHITE : e.lit > -0.2 ? C[6] : C[4]) : (y0 + y1) / 2 < -30 ? C[6] : C[5]);
    }
    // a pane about to set: its edges traced in white from its first corner round, a bead of light at the head
    for (const F of FACETS) {
      const age = t - F.at;
      if (age < -0.07 || age >= 0) continue;
      let left = ((age + 0.07) / 0.07) * F.len;
      for (let k = 0; k < F.pts.length && left > 0; k++) {
        const [x0, y0] = F.pts[k], [x1, y1] = F.pts[(k + 1) % F.pts.length], L = Math.hypot(x1 - x0, y1 - y0), v = Math.min(1, left / L);
        left -= L;
        p.line(x0 + jx, y0, x0 + jx + (x1 - x0) * v, y0 + (y1 - y0) * v, WHITE);
        if (v < 1) p.glow(x0 + jx + (x1 - x0) * v, y0 + (y1 - y0) * v, 6, C[6], 0.6);
      }
    }
    if (t >= CRACK && !wh) drawFractures(p, cracks, (t - CRACK) * 150, C, { ox: jx });
    if (t >= CRACK2 && !wh) drawFractures(p, cracks2, (t - CRACK2) * 190, C, { ox: jx });
  };

  return {
    update(dt) {
      t += dt;
      // frost lines race in along the floor from both sides, vapour riding them
      if (t < SNAP)
        for (const s of [-1, 1]) {
          const x = s * REACH * (1 - t / SNAP);
          if (R.chance(0.12)) ps.spawn(P.VAPOUR, x, -R.range(0, 2), -s * R.range(40, 90), -R.range(0, 5), R.range(0.3, 0.5), C[6], R.range(1.4, 2.4));
          if (R.chance(0.45)) ps.spawn(P.STREAK, x + s * R.range(0, 6), -R.range(1, 4), -s * R.range(50, 90), 0, R.range(0.1, 0.16), R.chance(0.5) ? C[6] : C[5]);
        }
      // stars and motes kicked off the climbing front
      if (t > CLIMB[0] && t < CLIMB[1] + 0.03) {
        let lo = 0;
        while (lo < order.length && reach[order[lo]] < t - 0.06) lo++;
        let hi = lo;
        while (hi < order.length && reach[order[hi]] <= t) hi++;
        if (hi > lo && R.chance(0.45)) {
          const i = order[R.int(lo, hi - 1)];
          ps.spawn(P.STAR, A.x + (i % W) + 0.5, A.y + ((i / W) | 0), R.range(-8, 8), -R.range(0, 18), R.range(0.2, 0.42), R.chance(0.5) ? C[6] : WHITE, R.range(0.6, 1.9));
        }
        if (hi > lo && R.chance(0.12)) {
          const i = order[R.int(lo, hi - 1)];
          ps.spawn(P.FLAKE, A.x + (i % W), A.y + ((i / W) | 0), R.range(-20, 20), -R.range(10, 30), R.range(0.5, 0.9), C[6], R.range(0.5, 1.2));
        }
      }
      // each pane snaps into place with a chip of shards, a puff and a glint
      while (formed < FACETS.length && t >= FACETS[formed].at) {
        const F = FACETS[formed++], c = centroid(F.pts);
        for (let i = 0; i < 3; i++) {
          const a = Math.atan2(c.y - CORE[1], c.x - CORE[0]) + R.range(-0.7, 0.7), sp = R.range(50, 120);
          bits.add({ kind: B.SHARD, x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 0.8, drag: 0.8, bounce: 0.3, life: R.range(0.35, 0.7), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1, 2.2), c: C[R.int(5, 7)] });
        }
        if (c.y > -14) ps.spawn(P.VAPOUR, c.x, -1, Math.sign(c.x || 1) * R.range(10, 30), -R.range(2, 8), R.range(0.5, 0.8), C[6], R.range(2.2, 3.4));
        ps.spawn(P.STAR, c.x + R.range(-2, 2), c.y + R.range(-2, 2), 0, -4, R.range(0.25, 0.45), WHITE, R.range(1.2, 2.2));
        lights.add(c.x, c.y, 16, C[6], 0.4, 0.12);
      }
      if (!sealed && formed === FACETS.length) {
        sealed = true;
        lights.add(0, -26, 70, C[5], 0.6, 0.4);
        for (let i = 0; i < 5; i++) ps.spawn(P.STAR, R.range(-15, 15), -R.range(6, 44), R.range(-6, 6), -R.range(0, 8), R.range(0.3, 0.6), R.chance(0.5) ? WHITE : C[6], R.range(1, 2.2));
      }
      // while it holds: glints wink on the corners, cold vapour rolls off the foot, a little snow
      if (sealed && t < CRACK2) {
        if (R.chance(0.035)) {
          const [x, y] = R.pick(VERTS);
          ps.spawn(P.STAR, x + R.range(-1, 1), y + R.range(-1, 1), 0, -2, R.range(0.3, 0.6), R.chance(0.6) ? C[6] : WHITE, R.range(0.8, 2.2));
        }
        if (R.chance(0.025)) {
          const s = R.sign();
          ps.spawn(P.VAPOUR, s * R.range(12, 18), -R.range(1, 3), s * R.range(8, 24), -R.range(1, 5), R.range(0.7, 1.1), C[6], R.range(1.8, 3));
        }
        if (R.chance(0.012)) ps.spawn(P.FLAKE, R.range(-30, 30), -R.range(56, 76), R.range(-4, 4), R.range(4, 10), R.range(1.2, 1.8), R.chance(0.5) ? WHITE : C[6], R.range(0.5, 1.4));
      }
      // it cracks: a jolt, chips spall off, light leaks from the cracks
      if (struck === 0 && t >= CRACK) {
        struck = 1;
        lights.add(CORE[0], CORE[1], 26, WHITE, 0.4, 0.1);
        for (let i = 0; i < 4; i++) bits.add({ kind: B.SHARD, x: R.range(-14, 14), y: -R.range(10, 40), vx: R.range(-40, 40), vy: -R.range(10, 60), g: 0.9, drag: 0.6, bounce: 0.3, life: R.range(0.5, 0.9), a: R.range(0, TAU), va: R.range(-20, 20), s: R.range(1, 2), c: C[R.int(5, 7)] });
      }
      if (struck === 1 && t >= CRACK2) {
        struck = 2;
        lights.add(CORE[0], CORE[1], 40, C[6], 0.35, 0.16);
        for (let i = 0; i < 3; i++) ps.spawn(P.STAR, R.range(-12, 12), -R.range(8, 40), 0, -3, R.range(0.15, 0.3), WHITE, R.range(1, 2));
      }
      if (!white && t >= FLASH) {
        white = true;
        lights.add(CORE[0], CORE[1], 60, WHITE, 0.9, 0.1);
      }
      // it bursts: the panes fly off tumbling, shards and ice dust, glints, a flurry, a flash of light
      if (!burst && t >= BURST) {
        burst = true;
        lights.add(CORE[0], CORE[1], 64, WHITE, 0.85, 0.14);
        lights.add(CORE[0], CORE[1] - 4, 72, C[4], 0.55, 0.6);
        const chop = (pts, depth) => {
          const c = centroid(pts);
          return c.area < 20 || depth > 2 ? [pts] : splitPoly(pts, c.x, c.y, R.range(0, Math.PI)).flatMap((q) => chop(q, depth + 1));
        };
        for (const F of FACETS) {
          for (const part of chop(F.pts, 0)) {
            const m = centroid(part), dx = m.x - CORE[0], dy = m.y - CORE[1], d = Math.hypot(dx, dy) || 1, sp = R.range(40, 85) * (1.2 - Math.min(0.5, m.area / 120));
            panes.add({
              pts: part.map(([x, y]) => [x - m.x, y - m.y]), x: m.x, y: m.y, vx: (dx / d) * sp + R.range(-15, 15), vy: (dy / d) * sp * 0.6 - R.range(90, 190),
              a: 0, va: R.range(-9, 9), f: R.range(-0.8, 0.8), vf: R.sign() * R.range(5, 13), lit: F.lit, g: 0.85, drag: 0.7, brittle: true, life: R.range(1, 1.45),
            });
          }
        }
        for (let i = 0; i < 50; i++) {
          let x = 0, y = 0;
          for (let k = 0; k < 12 && at(x, y) < 0; k++) (x = R.int(X0, X1 - 1)), (y = R.int(Y0, Y1 - 1));
          const dx = x - CORE[0], dy = y - CORE[1], d = Math.hypot(dx, dy) || 1, sp = R.range(50, 130);
          bits.add({ kind: B.SHARD, x, y, vx: (dx / d) * sp, vy: (dy / d) * sp * 0.7 - R.range(60, 170), g: 0.85, drag: 0.9, bounce: 0.3, life: R.range(0.8, 1.4), a: R.range(0, TAU), va: R.range(-22, 22), s: R.range(1.5, 3.2), c: C[R.int(4, 7)] });
        }
        for (const f of feathers)
          if (R.chance(0.5)) bits.add({ kind: B.SHARD, x: f.x, y: f.y, vx: f.dx * R.range(20, 70), vy: -R.range(20, 90), g: 0.8, drag: 0.8, bounce: 0.3, life: R.range(0.4, 0.8), a: R.range(0, TAU), va: R.range(-20, 20), s: R.range(1, 1.8), c: WHITE });
        for (let i = 0; i < 12; i++) {
          const s = R.sign();
          ps.spawn(P.VAPOUR, s * R.range(2, 16), -R.range(1, 6), s * R.range(30, 90), -R.range(4, 16), R.range(0.6, 1.1), C[6], R.range(2.2, 4));
        }
        for (let i = 0; i < 8; i++) ps.spawn(P.VAPOUR, R.range(-14, 14), -R.range(8, 40), R.range(-30, 30), -R.range(10, 30), R.range(0.6, 1), C[6], R.range(3, 5));
        for (let i = 0; i < 18; i++) {
          const a = R.range(-Math.PI, 0), sp = R.range(40, 130);
          ps.spawn(P.FLAKE, R.range(-10, 10), CORE[1] + R.range(-12, 12), Math.cos(a) * sp, Math.sin(a) * sp, R.range(1, 1.5), R.chance(0.6) ? WHITE : C[6], R.range(0.5, 1.6));
        }
        for (let i = 0; i < 7; i++) ps.spawn(P.STAR, R.range(-26, 26), -R.range(6, 52), R.range(-12, 12), -R.range(4, 16), R.range(0.4, 0.8), R.chance(0.5) ? WHITE : C[6], R.range(1, 2.4));
      }
      // glints wink on the debris as it settles
      if (burst && t < BURST + 0.9 && R.chance(0.07)) {
        const b = R.pick(bits.list.length ? bits.list : [{ x: 0, y: -10 }]);
        ps.spawn(P.STAR, b.x, b.y - 1, 0, -3, R.range(0.2, 0.4), R.chance(0.5) ? WHITE : C[6], R.range(0.6, 1.6));
      }
      // the last of the ice runs off the character
      if (burst && t < BURST + THAW && R.chance(0.12)) {
        const y = -H + ease.inQuad(seg(t, BURST, BURST + THAW)) * H;
        bits.add({ kind: B.DRIP, x: R.range(-9, 9), y, vy: 10, g: 0.5, life: 0.8, c: C[5] });
      }
      ps.update(dt);
      bits.update(dt);
      panes.update(dt);
      lights.update(dt);
      endBy(t, meta.duration, ps, bits, panes);
    },
    drawBack(p) {
      const out = 1 - smooth(MELT[0], MELT[1], t);
      if (out > 0) floorFrost(p, C, t, out);
      ps.draw(p, "back");
    },
    draw(p) {
      drawCharacter(p);
      drawBlock(p);
      // the cold light: a pool under the ice, a glow in it that brightens as it cracks, the climbing front's light
      const hold = smooth(CLIMB[0], SEAL, t) * (1 - smooth(BURST, BURST + 0.6, t)), crk = smooth(CRACK, FLASH, t);
      if (hold > 0) {
        p.glow(0, -2, 34, C[4], 0.22 * hold * (0.85 + 0.15 * Math.sin(t * 3)));
        p.glow(CORE[0], CORE[1] - 4, 40, C[3], (0.22 + 0.1 * crk) * hold);
      }
      if (t > CLIMB[0] && t < CLIMB[1]) p.glow(0, -38 * ease.outQuad(seg(t, CLIMB[0], CLIMB[1])), 18, C[5], 0.28);
      // the seal: a star at the crown as the last pane sets
      const top = FACETS[FACETS.length - 1].at, g = t - top;
      if (g > 0 && g < 0.3) sparkle(p, V.p2[0], V.p2[1], 8 * ease.outBack(Math.min(1, g / 0.06)) * (1 - g / 0.3), C[6], C[4], 0.6);
      if (t >= FLASH && t < BURST + 0.16) {
        const a = clamp((t - FLASH) / 0.22);
        flare(p, CORE[0], CORE[1], 34 * Math.pow(1 - a, 1.4), 1 - a, C);
      }
      panes.draw(p, C);
      bits.draw(p);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

// 3D: the frost climbs the character as it does in 2D (the body is the 2D stock body at depth 0, recoloured), then a
// block of ice crystallizes round him pane by pane: a hexagonal monolith with a jagged crown, twelve translucent
// facets that you see him through from every side, the far ones behind him and the near ones in front. It cracks,
// flashes white and bursts into glass panes that tumble outward through the air.
const HR = 19; // circumradius of the monolith
const TOPS = [-46, -40, -49, -41, -47, -42]; // the heights of its six top corners
const APEX = [0, -58, 0];
const CORE3 = [0, CORE[1], 0];
const dotv = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const subv = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crossv = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// the monolith's facets: six sides and six crown triangles, each with its own plane (normal, axes tu and tv, corners in them)
function monolith() {
  const ang = (j) => Math.PI / 6 + (j * Math.PI) / 3, B = [], T = [];
  for (let j = 0; j < 6; j++) {
    B.push([Math.cos(ang(j)) * HR, 0, Math.sin(ang(j)) * HR]);
    T.push([Math.cos(ang(j)) * HR, TOPS[j], Math.sin(ang(j)) * HR]);
  }
  const out = [];
  const add = (kind, verts, i) => {
    const c = [0, 1, 2].map((k) => verts.reduce((s, v) => s + v[k], 0) / verts.length);
    let n = crossv(subv(verts[1], verts[0]), subv(verts[verts.length - 1], verts[0]));
    const l = Math.hypot(...n);
    n = n.map((v) => v / l);
    if (dotv(n, subv(c, [0, -20, 0])) < 0) n = n.map((v) => -v);
    const az = Math.atan2(n[0], n[2]), f = Math.asin(clamp(-n[1], -1, 1)), tu = [Math.cos(az), 0, -Math.sin(az)], tv = [Math.sin(az) * Math.sin(f), Math.cos(f), Math.cos(az) * Math.sin(f)];
    const pts = verts.map((v) => [dotv(subv(v, c), tu), dotv(subv(v, c), tv)]);
    const len = pts.reduce((s, q, k) => s + Math.hypot(pts[(k + 1) % pts.length][0] - q[0], pts[(k + 1) % pts.length][1] - q[1]), 0);
    out.push({ kind, verts, c, n, az, f, tu, tv, pts, len, at: kind === "side" ? SEAL + i * 0.035 : SEAL + 0.2 + i * 0.022, i });
  };
  for (let i = 0; i < 6; i++) add("side", [B[(i + 5) % 6], B[i], T[i], T[(i + 5) % 6]], i);
  for (let i = 0; i < 6; i++) add("crown", [T[(i + 5) % 6], T[i], APEX], i);
  return out;
}

export const three = {
  meta: { size: [184, 136], origin: [92, 104], bg: "ground", camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 8), R = new Rng(o.seed), A = o.actor, floor = () => 0;
    const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]], haze: C[5] });
    const bits = new Bits({ ground: floor }), lights = new Lights();
    const panes = new Panes3({
      ground: floor,
      onLand: (q, x, y, z, v) => {
        for (let i = 0; i < 3; i++) bits.add({ kind: B.SHARD, x: x + R.range(-2, 2), y: y - 1, z: z + R.range(-2, 2), vx: q.vx * 0.6 + R.range(-50, 50), vy: -R.range(30, 100), vz: q.vz * 0.6 + R.range(-50, 50), g: 0.8, drag: 0.6, bounce: 0.35, life: R.range(0.4, 0.8), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1.2, 2.4), c: C[R.int(5, 7)] });
        ps.spawn3(P.VAPOUR, x, y - 1, z, R.range(-25, 25), -R.range(2, 10), R.range(-25, 25), R.range(0.4, 0.7), C[6], R.range(1.4, 2.4));
        if (R.chance(0.4)) ps.spawn3(P.STAR, x, y - 2, z, 0, -6, 0, R.range(0.2, 0.4), WHITE, R.range(0.8, 1.6));
      },
    });
    const body = frozenBody(A, o, C, R), { W, H, order, reach, feathers } = body;
    const FAC = monolith(), N = FAC.length;
    // every edge once, and which facets it joins
    const EDGES = [];
    for (const F of FAC)
      F.verts.forEach((a, k) => {
        const b = F.verts[(k + 1) % F.verts.length];
        let e = EDGES.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a) || (e.a.every((v, m) => Math.abs(v - b[m]) < 1e-6) && e.b.every((v, m) => Math.abs(v - a[m]) < 1e-6)) || (e.a.every((v, m) => Math.abs(v - a[m]) < 1e-6) && e.b.every((v, m) => Math.abs(v - b[m]) < 1e-6)));
        if (!e) EDGES.push((e = { a, b, fs: [] }));
        e.fs.push(F);
      });
    for (const e of EDGES) (e.floor = e.a[1] === 0 && e.b[1] === 0), (e.at = Math.min(...e.fs.map((F) => F.at)));
    // cracks, drawn on the facets: a short wave from the blow's side, then a big one over every facet
    const inF = (F) => (a, b) => inPoly(F.pts, a, b);
    const CR1 = [], CR2 = [];
    for (const F of FAC) {
      if (F.kind === "side" && F.i % 2 === 0) CR1.push([F, fractures(R, inF(F), 0, 0, 1 + (F.i === 0 ? 1 : 0), { len: 9 })]);
      CR2.push([F, fractures(R, inF(F), 0, F.kind === "side" ? -2 : 0, F.kind === "side" ? 2 : 1, { len: F.kind === "side" ? 14 : 6, fork: 0.22 })]);
    }
    // rime ferns standing on the floor
    const tufts = [];
    for (let i = 0; i < 34; i++) {
      const a = R.range(0, TAU), d = Math.sqrt(R.next()) * REACH * 0.92;
      tufts.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, d: d / REACH, L: 1 + R.range(0, 3.4), at: SNAP * (1 - d / REACH) + 0.05 });
    }

    let t = 0, formed = 0, sealed = false, struck = 0, burst = false, white = false;
    const jolt = () => (t >= CRACK && t < CRACK + 0.06 ? 1 : t >= CRACK2 && t < FLASH ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0);
    const pointOn = (F, jx, a, b, out = 0.45) => [F.c[0] + F.tu[0] * a + F.tv[0] * b + F.n[0] * out + jx, F.c[1] + F.tu[1] * a + F.tv[1] * b + F.n[1] * out, F.c[2] + F.tu[2] * a + F.tv[2] * b + F.n[2] * out];

    // frost on the floor: lines race in from the edge to his feet, then crust, cold bloom and rime ferns grow
    const floorFrost3 = (q, out) => {
      q.plane(0, 0, 0, null, REACH + 2, (u, v, o2) => {
        const d = Math.hypot(u, v) / REACH;
        if (d > 1.15) return;
        const age = t - SNAP * (1 - d), a = out * clamp((1.12 - d) / 0.2), g = smooth(0, 0.4, age);
        if (age < 0 || a <= 0) return;
        const h = rand(Math.floor(u / 1.5), Math.floor(v / 1.5), 31);
        o2.l = C[4];
        o2.k = 0.1 * a * g;
        if (h > 0.1 + 0.32 * g) return;
        o2.c = age < 0.05 || h < 0.1 ? WHITE : h < 0.25 ? C[6] : C[5];
        o2.a = a;
      });
      for (const f of tufts) {
        const g = smooth(0, 0.4, t - f.at), L = Math.round(g * f.L * (1 - f.d * 0.55));
        if (L > 0) q.line(f.x, 0, f.z, f.x, -L, f.z, (u) => (u > 0.7 ? WHITE : C[5]), out);
      }
    };

    const drawBlock = (q) => {
      if (t >= BURST || t < SEAL - 0.08) return;
      const jx = jolt(), wh = t >= FLASH;
      for (const F of FAC) {
        const v = q.view(...F.n), vc = q.view(...F.c);
        F.facing = v[2];
        F.lit = clamp((v[0] * -0.45 + v[1] * -0.6 + v[2] * 0.66 + 0.2) / 1.2);
        F.d = clamp((vc[0] + 0.55 * vc[1] + 36) / 46);
        F.g = SWEEPS.reduce((g, s0) => Math.max(g, Math.sin(Math.PI * clamp((t - s0 - F.d * 0.32) / 0.13))), 0) * (0.35 + 0.65 * F.lit);
      }
      // the faces, far to near so the glass stacks right; each flashes white as it sets, then settles to a pale tint
      for (const F of q.sort(FAC, (f) => f.c)) {
        const age = t - F.at;
        if (age < 0) continue;
        const tint = C[3 + Math.round(F.lit * 3)], alpha = 0.26 + 0.26 * F.lit, fresh = 1 - clamp((age - 0.03) / 0.1), g = F.g;
        face3(q, [F.c[0] + jx, F.c[1], F.c[2]], F.tu, F.tv, F.pts, (a, b, out) => {
          if (wh) return (out.c = WHITE);
          out.blend = true;
          if (age < 0.03) {
            out.c = C[7];
            out.a = 0.55;
            return;
          }
          out.c = fresh > 0.5 || g > 0.5 ? C[6] : tint;
          out.a = alpha + 0.25 * fresh + 0.15 * g;
          if (g > 0.05) {
            out.l = C[5];
            out.k = 0.42 * g;
          }
        });
      }
      // edges: pale where the facets are lit, cool in the shade; a pane about to set rings white
      for (const e of EDGES) {
        if (e.floor || t < e.at) continue;
        const lit = Math.max(...e.fs.map((F) => F.lit)), fresh = e.fs.some((F) => t - F.at < 0.1 || F.g > 0.6), near = e.fs.some((F) => F.facing > -0.05);
        const col = wh ? C[6] : fresh ? WHITE : lit > 0.7 ? WHITE : lit > 0.45 ? C[6] : lit > 0.25 ? C[5] : C[4], off = [0, 1, 2].map((k) => e.fs.reduce((s, F) => s + F.n[k], 0) * 0.25);
        q.line(e.a[0] + jx + off[0], e.a[1] + off[1], e.a[2] + off[2], e.b[0] + jx + off[0], e.b[1] + off[1], e.b[2] + off[2], col, near ? 1 : 0.4);
      }
      for (const F of FAC) {
        const age = t - F.at;
        if (age < -0.07 || age >= 0) continue;
        let left = ((age + 0.07) / 0.07) * F.len;
        for (let k = 0; k < F.verts.length && left > 0; k++) {
          const a = F.verts[k], b = F.verts[(k + 1) % F.verts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), v = Math.min(1, left / L);
          left -= Math.hypot(...F.pts[(k + 1) % F.pts.length].map((x, m) => x - F.pts[k][m]));
          const hx = a[0] + (b[0] - a[0]) * v + jx, hy = a[1] + (b[1] - a[1]) * v, hz = a[2] + (b[2] - a[2]) * v;
          q.line(a[0] + jx, a[1], a[2], hx, hy, hz, WHITE);
          if (v < 1) q.glow(hx, hy, hz, 6, C[6], 0.6);
        }
      }
      if (!wh) {
        if (t >= CRACK) for (const [F, set] of CR1) drawFractures3(q, set, (t - CRACK) * 150, C, (a, b) => pointOn(F, jx, a, b));
        if (t >= CRACK2) for (const [F, set] of CR2) drawFractures3(q, set, (t - CRACK2) * 190, C, (a, b) => pointOn(F, jx, a, b));
      }
    };

    return {
      update(dt) {
        t += dt;
        // frost lines race in along the floor from every side, vapour riding them
        if (t < SNAP)
          for (let k = 0; k < 2; k++) {
            const a = R.range(0, TAU), ca = Math.cos(a), sa = Math.sin(a), r = REACH * (1 - t / SNAP);
            if (R.chance(0.12)) ps.spawn3(P.VAPOUR, ca * r, -R.range(0, 2), sa * r, -ca * R.range(40, 90), -R.range(0, 5), -sa * R.range(40, 90), R.range(0.3, 0.5), C[6], R.range(1.4, 2.4));
            if (R.chance(0.45)) ps.spawn3(P.STREAK, ca * (r + R.range(0, 6)), -R.range(1, 4), sa * (r + R.range(0, 6)), -ca * R.range(50, 90), 0, -sa * R.range(50, 90), R.range(0.1, 0.16), R.chance(0.5) ? C[6] : C[5]);
          }
        // stars and motes kicked off the climbing front
        if (t > CLIMB[0] && t < CLIMB[1] + 0.03) {
          let lo = 0;
          while (lo < order.length && reach[order[lo]] < t - 0.06) lo++;
          let hi = lo;
          while (hi < order.length && reach[order[hi]] <= t) hi++;
          if (hi > lo && R.chance(0.45)) {
            const i = order[R.int(lo, hi - 1)];
            ps.spawn3(P.STAR, A.x + (i % W) + 0.5, A.y + ((i / W) | 0), R.range(-4, 4), R.range(-8, 8), -R.range(0, 18), R.range(-8, 8), R.range(0.2, 0.42), R.chance(0.5) ? C[6] : WHITE, R.range(0.6, 1.9));
          }
          if (hi > lo && R.chance(0.12)) {
            const i = order[R.int(lo, hi - 1)];
            ps.spawn3(P.FLAKE, A.x + (i % W), A.y + ((i / W) | 0), R.range(-4, 4), R.range(-20, 20), -R.range(10, 30), R.range(-20, 20), R.range(0.5, 0.9), C[6], R.range(0.5, 1.2));
          }
        }
        // each pane snaps into place with a chip of shards, a puff and a glint
        const ord = FAC.slice().sort((a, b) => a.at - b.at);
        while (formed < N && t >= ord[formed].at) {
          const F = ord[formed++], c = F.c, dx = c[0] - CORE3[0], dy = c[1] - CORE3[1], dz = c[2] - CORE3[2], d = Math.hypot(dx, dy, dz) || 1;
          for (let i = 0; i < 3; i++) {
            const sp = R.range(50, 120);
            bits.add({ kind: B.SHARD, x: c[0], y: c[1], z: c[2], vx: (dx / d) * sp + R.range(-30, 30), vy: (dy / d) * sp - 40 + R.range(-20, 20), vz: (dz / d) * sp + R.range(-30, 30), g: 0.8, drag: 0.8, bounce: 0.3, life: R.range(0.35, 0.7), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1, 2.2), c: C[R.int(5, 7)] });
          }
          if (c[1] > -14) ps.spawn3(P.VAPOUR, c[0], -1, c[2], (dx / d) * R.range(10, 30), -R.range(2, 8), (dz / d) * R.range(10, 30), R.range(0.5, 0.8), C[6], R.range(2.2, 3.4));
          ps.spawn3(P.STAR, c[0] + R.range(-2, 2), c[1] + R.range(-2, 2), c[2] + R.range(-2, 2), 0, -4, 0, R.range(0.25, 0.45), WHITE, R.range(1.2, 2.2));
          lights.add(c[0], c[1], c[2], 16, C[6], 0.4, 0.12);
        }
        if (!sealed && formed === N) {
          sealed = true;
          lights.add(0, -26, 0, 70, C[5], 0.6, 0.4);
          for (let i = 0; i < 5; i++) ps.spawn3(P.STAR, R.range(-15, 15), -R.range(6, 44), R.range(-15, 15), R.range(-6, 6), -R.range(0, 8), R.range(-6, 6), R.range(0.3, 0.6), R.chance(0.5) ? WHITE : C[6], R.range(1, 2.2));
        }
        // while it holds: glints wink on the corners, cold vapour rolls off the foot, a little snow
        if (sealed && t < CRACK2) {
          if (R.chance(0.035)) {
            const v = R.pick(FAC).verts[R.int(0, 2)];
            ps.spawn3(P.STAR, v[0] + R.range(-1, 1), v[1] + R.range(-1, 1), v[2] + R.range(-1, 1), 0, -2, 0, R.range(0.3, 0.6), R.chance(0.6) ? C[6] : WHITE, R.range(0.8, 2.2));
          }
          if (R.chance(0.025)) {
            const a = R.range(0, TAU), ca = Math.cos(a), sa = Math.sin(a);
            ps.spawn3(P.VAPOUR, ca * R.range(12, 18), -R.range(1, 3), sa * R.range(12, 18), ca * R.range(8, 24), -R.range(1, 5), sa * R.range(8, 24), R.range(0.7, 1.1), C[6], R.range(1.8, 3));
          }
          if (R.chance(0.012)) ps.spawn3(P.FLAKE, R.range(-30, 30), -R.range(56, 76), R.range(-30, 30), R.range(-4, 4), R.range(4, 10), R.range(-4, 4), R.range(1.2, 1.8), R.chance(0.5) ? WHITE : C[6], R.range(0.5, 1.4));
        }
        // it cracks: a jolt, chips spall off, light leaks from the cracks
        if (struck === 0 && t >= CRACK) {
          struck = 1;
          lights.add(CORE[0], CORE[1], 0, 26, WHITE, 0.4, 0.1);
          for (let i = 0; i < 4; i++) bits.add({ kind: B.SHARD, x: R.range(-14, 14), y: -R.range(10, 40), z: R.range(-14, 14), vx: R.range(-40, 40), vy: -R.range(10, 60), vz: R.range(-40, 40), g: 0.9, drag: 0.6, bounce: 0.3, life: R.range(0.5, 0.9), a: R.range(0, TAU), va: R.range(-20, 20), s: R.range(1, 2), c: C[R.int(5, 7)] });
        }
        if (struck === 1 && t >= CRACK2) {
          struck = 2;
          lights.add(CORE[0], CORE[1], 0, 40, C[6], 0.35, 0.16);
          for (let i = 0; i < 3; i++) ps.spawn3(P.STAR, R.range(-12, 12), -R.range(8, 40), R.range(-12, 12), 0, -3, 0, R.range(0.15, 0.3), WHITE, R.range(1, 2));
        }
        if (!white && t >= FLASH) {
          white = true;
          lights.add(CORE[0], CORE[1], 0, 60, WHITE, 0.9, 0.1);
        }
        // it bursts: the panes fly off tumbling, shards and ice dust, glints, a flurry, a flash of light
        if (!burst && t >= BURST) {
          burst = true;
          lights.add(CORE[0], CORE[1], 0, 64, WHITE, 0.85, 0.14);
          lights.add(CORE[0], CORE[1] - 4, 0, 72, C[4], 0.55, 0.6);
          const chop = (pts, depth) => {
            const c = centroid(pts);
            return c.area < 20 || depth > 1 ? [pts] : splitPoly(pts, c.x, c.y, R.range(0, Math.PI)).flatMap((qq) => chop(qq, depth + 1));
          };
          for (const F of FAC)
            for (const part of chop(F.pts, 0)) {
              const m = centroid(part), P0 = pointOn(F, 0, m.x, m.y, 0), dx = P0[0] - CORE3[0], dy = P0[1] - CORE3[1], dz = P0[2] - CORE3[2], d = Math.hypot(dx, dy, dz) || 1, sp = R.range(40, 85) * (1.2 - Math.min(0.5, m.area / 120));
              panes.add({
                pts: part.map(([x, y]) => [x - m.x, y - m.y]), x: P0[0], y: P0[1], z: P0[2], vx: (dx / d) * sp + R.range(-15, 15), vy: (dy / d) * sp * 0.6 - R.range(90, 190), vz: (dz / d) * sp + R.range(-15, 15),
                az: F.az, f: F.f, a: 0, va: R.range(-9, 9), vf: R.sign() * R.range(5, 13), lit: F.lit, g: 0.85, drag: 0.7, brittle: true, life: R.range(1, 1.45),
              });
            }
          for (let i = 0; i < 50; i++) {
            const a = R.range(0, TAU), r = Math.sqrt(R.next()) * 15, x = Math.cos(a) * r, z = Math.sin(a) * r, y = -R.range(1, 50), dx = x - CORE3[0], dy = y - CORE3[1], dz = z - CORE3[2], d = Math.hypot(dx, dy, dz) || 1, sp = R.range(50, 130);
            bits.add({ kind: B.SHARD, x, y, z, vx: (dx / d) * sp, vy: (dy / d) * sp * 0.7 - R.range(60, 170), vz: (dz / d) * sp, g: 0.85, drag: 0.9, bounce: 0.3, life: R.range(0.8, 1.4), a: R.range(0, TAU), va: R.range(-22, 22), s: R.range(1.5, 3.2), c: C[R.int(4, 7)] });
          }
          for (const f of feathers)
            if (R.chance(0.5)) bits.add({ kind: B.SHARD, x: f.x, y: f.y, z: R.range(-4, 4), vx: f.dx * R.range(20, 70), vy: -R.range(20, 90), vz: R.range(-40, 40), g: 0.8, drag: 0.8, bounce: 0.3, life: R.range(0.4, 0.8), a: R.range(0, TAU), va: R.range(-20, 20), s: R.range(1, 1.8), c: WHITE });
          for (let i = 0; i < 12; i++) {
            const a = R.range(0, TAU), v = R.range(30, 90);
            ps.spawn3(P.VAPOUR, Math.cos(a) * R.range(2, 16), -R.range(1, 6), Math.sin(a) * R.range(2, 16), Math.cos(a) * v, -R.range(4, 16), Math.sin(a) * v, R.range(0.6, 1.1), C[6], R.range(2.2, 4));
          }
          for (let i = 0; i < 8; i++) ps.spawn3(P.VAPOUR, R.range(-14, 14), -R.range(8, 40), R.range(-14, 14), R.range(-30, 30), -R.range(10, 30), R.range(-30, 30), R.range(0.6, 1), C[6], R.range(3, 5));
          for (let i = 0; i < 18; i++) {
            const a = R.range(0, TAU), el = R.range(0, 1.2), sp = R.range(40, 130);
            ps.spawn3(P.FLAKE, R.range(-10, 10), CORE[1] + R.range(-12, 12), R.range(-10, 10), Math.cos(a) * Math.cos(el) * sp, -Math.sin(el) * sp, Math.sin(a) * Math.cos(el) * sp, R.range(1, 1.5), R.chance(0.6) ? WHITE : C[6], R.range(0.5, 1.6));
          }
          for (let i = 0; i < 7; i++) ps.spawn3(P.STAR, R.range(-26, 26), -R.range(6, 52), R.range(-26, 26), R.range(-12, 12), -R.range(4, 16), R.range(-12, 12), R.range(0.4, 0.8), R.chance(0.5) ? WHITE : C[6], R.range(1, 2.4));
        }
        if (burst && t < BURST + 0.9 && R.chance(0.07)) {
          const b = bits.list.length ? R.pick(bits.list) : { x: 0, y: -10, z: 0 };
          ps.spawn3(P.STAR, b.x, b.y - 1, b.z, 0, -3, 0, R.range(0.2, 0.4), R.chance(0.5) ? WHITE : C[6], R.range(0.6, 1.6));
        }
        // the last of the ice runs off the character
        if (burst && t < BURST + THAW && R.chance(0.12)) {
          const y = -H + ease.inQuad(seg(t, BURST, BURST + THAW)) * H;
          bits.add({ kind: B.DRIP, x: R.range(-9, 9), y, z: R.range(-5, 5), vy: 10, g: 0.5, life: 0.8, c: C[5] });
        }
        ps.update(dt);
        bits.update(dt);
        panes.update(dt);
        lights.update(dt);
        endBy(t, meta.duration, ps, bits, panes);
      },
      draw(p) {
        const q = space(p, o), out = 1 - smooth(MELT[0], MELT[1], t);
        if (out > 0) floorFrost3(q, out);
        paintBody(p, t, body, C);
        drawBlock(q);
        // the cold light: a pool under the ice, a glow in it that brightens as it cracks, the climbing front's light
        const hold = smooth(CLIMB[0], SEAL, t) * (1 - smooth(BURST, BURST + 0.6, t)), crk = smooth(CRACK, FLASH, t);
        if (hold > 0) {
          q.glow(0, -2, 0, 36, C[4], 0.22 * hold * (0.85 + 0.15 * Math.sin(t * 3)));
          q.glow(CORE[0], CORE[1] - 4, 0, 42, C[3], (0.22 + 0.1 * crk) * hold);
        }
        if (t > CLIMB[0] && t < CLIMB[1]) q.glow(0, -38 * ease.outQuad(seg(t, CLIMB[0], CLIMB[1])), 0, 18, C[5], 0.28);
        // the seal: a star at the crown as the last pane sets
        const g = t - FAC.reduce((m, F) => Math.max(m, F.at), 0);
        if (g > 0 && g < 0.3) q.at(APEX[0], APEX[1], APEX[2], (pp) => sparkle(pp, 0, 0, 8 * ease.outBack(Math.min(1, g / 0.06)) * (1 - g / 0.3), C[6], C[4], 0.6));
        if (t >= FLASH && t < BURST + 0.16) {
          const a = clamp((t - FLASH) / 0.22);
          q.at(CORE[0], CORE[1], 0, (pp) => flare(pp, 0, 0, 34 * Math.pow(1 - a, 1.4), 1 - a, C));
        }
        panes.draw(q, C);
        bits.draw(q);
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
