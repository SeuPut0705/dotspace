import { fit, hex, mix, clamp, wrap, lerp, smooth, cycle, space, P, TAU } from "../../core/index.js";
import { Grid, Swarm, shift, shadow, floorShadow } from "./_lib.js";

export const meta = {
  name: "Snake",
  desc: "A snake slithers along the floor, head raised: humps rise and roll back down its patterned body to the tail, dust puffs where it touches down, its forked tongue flicks.",
  tags: ["critter", "snake", "reptile", "ground", "loop"],
  size: [136, 56],
  origin: [68, 48],
  duration: 2.4,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#081410", "#123a1e", "#1d5e2a", "#2f8a36", "#5cb848", "#a8e070", "#e8ffc0"],
    belly: ["#4a3a14", "#b08a34", "#f0d878"],
    seed: 1,
  },
};

const D = meta.duration, HEAD = 30, LEN = 70, GRID = new Grid(-44, -24, 88, 26), SWARM = new Swarm();
const TONGUE = hex("#e8304a"), DUST = hex("#8a7f92");
const K = TAU / 30, W = (TAU * 2) / D;

// the body's centre height u px behind the head: humps rolling back toward the tail, the neck raised to the head
function lift(u, t) {
  const wave = Math.max(0, Math.sin(K * u - W * t)) ** 0.85, env = smooth(8, 18, u) * (1 - smooth(LEN - 14, LEN - 2, u));
  const neck = u < 12 ? 6 * (1 - u / 12) ** 2 : 0;
  return 7 * wave * env + neck;
}
const radius = (u) => (u < 6 ? 3.3 : lerp(3.4, 0.6, ((u - 6) / (LEN - 6)) ** 1.3));
// the head's bob with the rhythm, and the tongue's flicks: two bursts of three a loop
const bob = (t) => 0.8 * Math.sin(W * t);
function tongue(t) {
  for (const t0 of [0.3, 1.5]) {
    const k = (t - t0) / 0.5;
    if (k >= 0 && k < 1) return Math.max(0, Math.sin(k * Math.PI * 3)) ** 0.6;
  }
  return 0;
}

function snake(g, C, B, t) {
  g.clear();
  const hb = bob(t);
  // the body, column by column from the tail to the neck: lit along its back, a gold belly, dark diamonds, glints on the humps
  for (let u = LEN; u >= 2; u -= 0.5) {
    const x = HEAD - u, r0 = radius(u), cy = -r0 - lift(u, t) + (u < 12 ? hb * (1 - u / 12) : 0), hump = lift(u, t);
    // keep the body as thick across its slope as along the floor
    const slope = (lift(u + 0.5, t) - lift(u - 0.5, t)), r = r0 * Math.sqrt(1 + slope * slope);
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      const v = (y + 0.5 - cy) / r;
      if (Math.abs(v) > 1) continue;
      let c = v < -0.5 ? C[4] : v < 0.1 ? C[3] : v < 0.45 ? C[2] : v < 0.8 ? B[1] : B[0];
      const dm = Math.abs(((u + 2) % 7) - 3.5) / 3.5 + Math.abs(v + 0.25) / 0.55;
      if (dm < 0.85 && v < 0.35 && u > 4) c = dm < 0.5 ? C[1] : C[2];
      if (v < -0.62 && hump > 4.5 && dm >= 0.85) c = hump > 6 ? C[6] : C[5];
      if (v > 0.45 && v < 0.8 && Math.floor(u) % 3 === 0) c = B[2];
      g.set(x, y, c);
    }
  }
  // the head: a blunt wedge raised off the floor, lit on top, an eye with a slit pupil, a nostril, a mouth line
  const hx = HEAD + 2, hy = -9.5 + hb;
  g.shade(hx - 5, hy - 4, hx + 6, hy + 4, (x, y) => {
    const dx = (x - hx) / (x > hx ? 5.6 : 4.6), dy = (y - hy) / (3.6 - Math.max(0, x - hx) * 0.18);
    if (dx * dx + dy * dy > 1) return 0;
    if (dy > 0.55) return B[1];
    return dy < -0.3 ? (dx < 0.3 ? C[5] : C[4]) : C[3];
  });
  g.line(hx - 1, hy + 1.5, hx + 5, hy + 1.2, C[1]);
  g.set(hx + 1, hy - 2, C[0]); g.set(hx + 2, hy - 2, B[2]); g.set(hx + 1, hy - 1, B[2]); g.set(hx + 2, hy - 1, C[0]);
  g.set(hx + 1, hy - 3, C[6]);
  g.set(hx + 5, hy - 1, C[1]);
  g.outline(C[0]);
}

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 7), B = fit(o.belly, 3), hb = bob(t);
  // the tongue darts out, forked, and flicks back
  const e = tongue(t), tx = HEAD + 7.5, ty = -8.2 + hb;
  if (e > 0.05) {
    const L = 7 * e, wig = Math.sin(t * 60) * 0.6 * e;
    p.line(tx, ty, tx + L, ty + wig, TONGUE);
    if (L > 3) p.px(tx + L + 1, ty + wig - 1, TONGUE), p.px(tx + L + 1, ty + wig + 1, TONGUE);
  }
  const g = GRID;
  snake(g, C, B, t);
  g.draw(p);
  // dust scuffed along the floor where each hump presses back down, drifting off low and thin
  const sw = SWARM.begin(t);
  cycle(t, D, 26, o.seed * 7 + 1, (r) => r.range(0.6, 1.1), (age, L, r) => {
    const born = wrap(t - age, D), m = r.int(0, 2), u = (Math.PI + W * born + m * TAU) / K;
    if (u < 18 || u > LEN - 10) return;
    const x = HEAD - u + r.range(-2, 2) - r.range(6, 16) * age;
    sw.add(P.SMOKE, x, -0.5 - age * r.range(3, 8), 0, 0, age, L, DUST, r.range(1.8, 3.4));
  });
  sw.draw(p);
  // a glint in its eye
  p.glow(HEAD + 3.5, -11 + hb, 4, B[2], 0.35);
}

export function drawBack(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 7);

  // a shadow along its length, softer under the humps
  for (let u = 2; u <= LEN; u += 2) {
    const h = lift(u, t), r = radius(u);
    shadow(p, HEAD - u, -0.2, 2.2 + r * 0.4, 1.2, C[0], 0.5 * (1 - clamp(h / 10)) + 0.1);
  }
  shadow(p, HEAD + 2, -0.2, 5, 1.2, C[0], 0.35);
}

// ---- 3D: the snake lies on the floor in a long curve, its body a chain of real balls with the 2D scale pattern shaded
// by their normals; humps still roll back under it, and an S-wave sways it side to side. The head turns with the path.
const KAPPA = -1 / 52, HEADX = 22, HEADZ = -22, SWARM3 = new Swarm();

// the centreline u px behind the head (negative: ahead of it): an arc on the floor plus a travelling side-to-side wave
function spine(u, t, out = {}) {
  const th = KAPPA * u, w = 4.5 * (0.3 + 0.7 * smooth(0, 30, u)) * (1 - 0.4 * smooth(LEN - 14, LEN, u)) * Math.sin(K * Math.max(u, 0) - W * t + 0.8);
  out.x = HEADX - Math.sin(th) / KAPPA - Math.sin(th) * w;
  out.z = HEADZ - (1 - Math.cos(th)) / KAPPA + Math.cos(th) * w;
  return out;
}

export const three = {
  meta: { size: [132, 72], origin: [66, 48], bg: "ground", camera: { pitch: 0.34 } },
  draw(p, time, o) {
    const t = shift(time, D, o.seed), C = fit(o.palette, 7), B = fit(o.belly, 3), hb = bob(t), q = space(p, o);
    const S = { x: 0, z: 0 };
    // its shadow along its length, softer under the humps: a true shape on the floor
    for (let u = 2; u <= LEN; u += 2) {
      spine(u, t, S);
      floorShadow(q, S.x, S.z, 3.4 + radius(u) * 0.8, C[0], 0.65 * (1 - clamp(lift(u, t) / 10)) + 0.15);
    }
    // the body from the tail to the neck, a chain of balls; the colour comes from each ball's normal, as in 2D
    for (let u = LEN; u >= 1.5; u -= 0.75) {
      spine(u, t, S);
      const r0 = radius(u), rb = r0 * 1.1 + 0.45, hump = lift(u, t), y = -rb - hump + (u < 12 ? hb * (1 - u / 12) : 0);
      q.ball(S.x, y, S.z, rb, (nx, ny, nz) => {
        if (nz < 0.3) return C[0];
        let c = ny < -0.5 ? C[4] : ny < 0.1 ? C[3] : ny < 0.45 ? C[2] : ny < 0.8 ? B[1] : B[0];
        const dm = Math.abs(((u + 2) % 7) - 3.5) / 3.5 + Math.abs(ny + 0.25) / 0.55;
        if (dm < 0.85 && ny < 0.35 && u > 4) c = dm < 0.5 ? C[1] : C[2];
        if (ny < -0.62 && hump > 4.5 && dm >= 0.85) c = hump > 6 ? C[6] : C[5];
        if (ny > 0.45 && ny < 0.8 && Math.floor(u) % 3 === 0) c = B[2];
        return c;
      });
    }
    // the head: a blunt wedge of balls raised off the floor, lit on top; belly gold below
    const a = spine(-9, t), b = spine(-5, t);
    let hx = a.x - b.x, hz = a.z - b.z;
    const hl = Math.hypot(hx, hz) || 1;
    hx /= hl; hz /= hl;
    const lx = -hz, lz = hx, hy = -9.5 + hb;
    const headColor = (nx, ny, nz) => (nz < 0.3 ? C[0] : ny > 0.55 ? B[1] : ny < -0.62 ? (nx < 0.2 ? C[5] : C[4]) : ny < -0.1 ? C[4] : C[3]);
    for (const [u, r, dy, wide] of [[1.5, 3.5, 0, 0.6], [-0.5, 3.6, 0, 1.4], [-2.5, 3.4, 0.2, 1.8], [-4.5, 3, 0.5, 1.5], [-6.3, 2.5, 0.8, 1], [-7.5, 2, 1, 0]]) {
      spine(u, t, S);
      if (wide) for (const s of [-1, 1]) q.ball(S.x + lx * wide * s, hy + dy + 0.5, S.z + lz * wide * s, r * 0.9, headColor);
      q.ball(S.x, hy + dy, S.z, r, headColor);
    }
    // eyes with a slit pupil and a glint on the brow, on both sides; a nostril at the snout
    const e = spine(-2.5, t), n = spine(-7.8, t);
    for (const s of [-1, 1]) {
      const ex = e.x + lx * 4.1 * s, ez = e.z + lz * 4.1 * s;
      q.ball(ex, hy - 1.1, ez, 1.15, B[2]);
      q.ball(ex + lx * 0.7 * s + hx * 0.2, hy - 1.1, ez + lz * 0.7 * s + hz * 0.2, 0.6, C[0]);
      q.glow(ex, hy - 1.4, ez, 4, B[2], 0.28);
      q.ball(n.x + hx * 1.3 + lx * 0.9 * s, hy + 0.1, n.z + hz * 1.3 + lz * 0.9 * s, 0.5, C[1]);
    }
    q.dot(e.x, hy - 3.7, e.z, C[6]);
    // the forked tongue darts out of the snout and flicks back
    const tg = tongue(t);
    if (tg > 0.05) {
      const L = 7 * tg, wig = Math.sin(t * 60) * 0.6 * tg, ty = hy + 1.2, ox = n.x + hx * 1.5, oz = n.z + hz * 1.5;
      const tx = ox + hx * L + lx * wig, tz = oz + hz * L + lz * wig;
      q.line(ox, ty, oz, tx, ty, tz, TONGUE);
      if (L > 3) for (const s of [-1, 1]) q.line(tx, ty, tz, tx + hx * 1.6 + lx * 1.4 * s, ty, tz + hz * 1.6 + lz * 1.4 * s, TONGUE);
    }
    // dust scuffed up where each hump presses back down, drifting off low and thin, in all directions about the path
    const sw = SWARM3.begin(t), T = { x: 0, z: 0 };
    cycle(t, D, 26, o.seed * 7 + 1, (r) => r.range(0.6, 1.1), (age, L, r) => {
      const born = wrap(t - age, D), m = r.int(0, 2), u = (Math.PI + W * born + m * TAU) / K;
      if (u < 18 || u > LEN - 10) return;
      spine(u, born, T);
      const T2 = spine(u + 1, born, {}), fx = (T.x - T2.x) || 1e-6, fz = T.z - T2.z, fl = Math.hypot(fx, fz);
      const bx = -fx / fl, bz = -fz / fl, back = r.range(6, 16) * age, side = r.range(-9, 9) * age, jx = r.range(-2, 2), jz = r.range(-2, 2);
      sw.add3(P.SMOKE, T.x + jx + bx * back - bz * side, -0.5 - age * r.range(3, 8), T.z + jz + bz * back + bx * side, 0, 0, 0, age, L, DUST, r.range(1.8, 3.4));
    });
    sw.draw(q);
  },
};
