// The puddle (a domed wet surface with glints sliding along it, bubbles that swell and pop) is adapted from
// Sprite Fusion's open-source poison puddle (https://www.spritefusion.com/pixel-art-vfx/poison),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, wrap, smooth, seg, ease, lerp, mix, rng, cycle, sparkle, space, TAU } from "../../core/index.js";
import { Grid, shift, curve, spring, toss, lnoise, floorShadow, floorPool } from "./_lib.js";

export const meta = {
  name: "Slime",
  desc: "A glossy slime hops in place: it squashes to wind up, stretches into the jump, rounds out in the air, splats down flinging droplets that creep back, then wobbles and blinks.",
  tags: ["critter", "slime", "monster", "hop", "goo", "loop"],
  size: [112, 88],
  origin: [56, 72],
  duration: 1.8,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#061412", "#0b2f2b", "#12594a", "#1f8f4f", "#47c752", "#a6f06a", "#f0ffd2"], hop: 24, seed: 1 },
};

const GRID = new Grid(-30, -64, 60, 66);
const D = meta.duration, T_SQ = 0.5, T_UP = 0.84, T_LIFT = 0.9, T_LAND = 1.44, SNAP = 0.965;
const W0 = 30, H0 = 22, VC = 0.4, G = 640, NDROP = 12;

// the body's shape and squash at loop time t: s > 0 stretched tall, s < 0 squashed flat
function pose(t, hop) {
  const age = wrap(t - T_LAND, D);
  let s, by = 0, lean = 0, round = 0.1, q = -1;
  if (t >= T_LIFT && t < T_LAND) {
    q = (t - T_LIFT) / (T_LAND - T_LIFT);
    by = -hop * 4 * q * (1 - q);
    s = curve(q, [[0, 0.36], [0.4, 0.02], [0.55, -0.05], [0.85, 0.08], [1, 0.16]]);
    round = 0.1 + 0.8 * smooth(0, 0.16, q) * (1 - smooth(0.86, 1, q));
  } else if (t >= T_UP && t < T_LIFT) s = lerp(-0.3, 0.36, ease.outCubic(seg(t, T_UP, T_LIFT)));
  else if (t >= T_SQ && t < T_UP) {
    const u = seg(t, T_SQ, T_UP);
    s = -0.3 * ease.inOutSine(u) + 0.018 * Math.sin(t * TAU * 16) * smooth(0.55, 1, u);
  } else {
    // the splat holds for a beat, then rings out into a wobble; the top sways a little as it settles
    s = age < 0.06 ? -0.46 : -0.46 * spring(age - 0.06, 2.1, 4.6);
    lean = 0.07 * Math.exp(-age * 4) * Math.sin(age * TAU * 1.9);
    if (t < T_SQ) s += 0.02 * Math.sin((t / T_SQ) * TAU);
  }
  return { s, by, lean, round, q, age, W: W0 / Math.sqrt(1 + s), H: H0 * (1 + s) };
}

// half the body's width at height v (0 base .. 1 top): a dome over a soft foot with rounded corners
function halfW(v, P) {
  if (v < 0 || v > 1) return -1;
  const { W, H, round } = P;
  if (v >= VC) {
    const q = (v - VC) / (1 - VC);
    return (W / 2) * Math.sqrt(1 - q * q);
  }
  const q = (VC - v) / VC, hb = v * H, rc = 3;
  let hw = (W / 2) * Math.sqrt(Math.max(0, 1 - round * q * q));
  if (hb < rc) hw -= rc - Math.sqrt(rc * rc - (rc - hb) ** 2);
  return hw;
}
const inside = (P, x, y) => {
  const v = (P.by - 1 - y) / P.H, hw = halfW(v, P);
  return hw >= 0 && Math.abs(x - P.lean * v * P.H) <= hw;
};

// shaded the way a pixel artist shades jelly: a dark dome over light pooling low inside the body, a shadow
// crescent (the rim the body leaves bare when nudged toward the light), a glossy streak hugging the top-left
// contour with a hot spot under it, light bounced up off the floor caught just inside the lower rim
function body(g, C, P) {
  const yb = P.by - 1, half = P.W / 2 + 3;
  const cx = P.lean * 0.45 * P.H, cy = yb - P.H * 0.5, lx = cx - P.W * 0.24, ly = cy - P.H * 0.36;
  const lit = (x, y, k) => inside(P, lx + (x - lx) / k, ly + (y - ly) / k);
  g.clear();
  g.shade(-half, yb - P.H - 1, half, yb, (x, y, o) => {
    if (!inside(P, x, y)) return 0;
    o.t = 1;
    o.a = 0.92;
    let i = lit(x, y, 0.42) ? 5 : lit(x, y, 0.7) ? 4 : 3;
    // light pooled in the jelly along the bottom, brightest just inside the rim
    const v = (yb - y) / P.H;
    if (v < 0.3 && inside(P, x, y + 1.4)) i = !inside(P, x, y + 2.4) ? 5 : v < 0.2 ? 4 : i;
    if (!inside(P, x + 2, y + 2.4)) (i = 2), (o.a = 1);
    const ang = Math.atan2(y - cy, (x - cx) * (P.H / P.W));
    if (!inside(P, x - 1.6, y - 1.6) && inside(P, x - 0.7, y - 0.7) && ang > -2.75 && ang < -1.55) (i = ang > -2.45 && ang < -1.8 ? 6 : 5), (o.a = 1);
    if (i === 2 && inside(P, x + 1, y + 1.2) && !inside(P, x + 2, y + 2.4) && ang > 0.3 && ang < 1.5) i = 4;
    return C[i];
  });
  // the hot spot: a tiny bright window reflection under the streak
  const hx = Math.round(cx - P.W * 0.27), hy = Math.round(cy - P.H * 0.14);
  if (inside(P, hx - 1, hy) && inside(P, hx + 1, hy + 1)) g.set(hx, hy, C[6]), g.set(hx, hy + 1, C[5]);
}

// the eyes ride the squash: squint while winding up, wide in the air, screwed shut on the splat, a blink at rest
function face(g, C, P, t) {
  const yb = P.by - 1, ev = 0.47, ey = Math.round(yb - P.H * ev), ex = Math.max(3, Math.round(P.W * 0.16)), xc = Math.round(P.lean * ev * P.H);
  const air = P.q >= 0, shut = P.age < 0.16 && !air, blink = t > 0.22 && t < 0.29;
  const wind = t >= T_SQ && t < T_LIFT ? seg(t, T_SQ, T_UP) : 0, look = air ? (P.q < 0.45 ? -1 : P.q > 0.7 ? 1 : 0) : 0;
  const eh = clamp(Math.round(4 * (1 + P.s * 0.8) - wind * 2 + (air && P.q < 0.6 ? 1 : 0)), 1, 5);
  for (const side of [-1, 1]) {
    const x = xc + side * ex - (side > 0 ? 1 : 0);
    if (shut) {
      const a = side < 0 ? 0 : 1, b = 1 - a;
      g.set(x + a, ey - 1, C[0]); g.set(x + b, ey, C[0]); g.set(x + a, ey + 1, C[0]);
      continue;
    }
    if (blink) {
      g.set(x, ey + 1, C[0]); g.set(x + 1, ey + 1, C[0]);
      continue;
    }
    const top = ey + 2 - eh + look;
    for (let k = 0; k < eh; k++) g.set(x, top + k, C[0]), g.set(x + 1, top + k, C[0]);
    g.set(x + (look > 0 ? 1 : 0), top + (look > 0 ? 1 : 0), C[6]);
    if (eh >= 4) g.set(x + 1, top + eh - 1, C[2]);
  }
  const my = Math.round(yb - P.H * 0.31);
  if (air && P.q < 0.75) g.set(xc, my, C[0]), g.set(xc - 1, my, C[0]), g.set(xc, my + 1, C[1]), g.set(xc - 1, my + 1, C[1]);
  else if (!shut) g.set(xc, my, C[1]), g.set(xc - 1, my, C[1]);
}

// a bubble works its way up through the jelly while it rests and pops at the top
const POP = 0.4;
function bubbleIn(g, C, P, t) {
  if (t > POP) return;
  const v = lerp(0.18, 0.86, ease.inQuad(t / POP)), hw = halfW(v, P), x = P.lean * v * P.H - hw * lerp(0.35, 0.05, t / POP), y = P.by - 1 - v * P.H;
  g.set(x, y, C[6]); g.set(x + 1, y, C[5]); g.set(x, y + 1, C[5]); g.set(x + 1, y + 1, C[4]);
}

// droplets flung off the splat: they arc, land with a little splat, and creep back to the body to rejoin it
function droplet(i, o, age) {
  const r = rng(o.seed, i, 7), a = -Math.PI / 2 + r.range(-1.2, 1.2), sp = r.range(60, 118), size = r.chance(0.35) ? 1 : r.chance(0.7) ? 2 : 3;
  const fa = a + Math.PI / 2, x0 = Math.sin(fa) * 21, y0 = -1 - Math.cos(fa) * 12.5;
  const f = toss(x0, y0, Math.cos(a) * sp * 0.75, Math.sin(a) * sp, age, G, -1);
  f.size = size;
  if (f.landed) {
    const home = Math.sign(f.lx || 1) * (W0 / 2 - 2), dur = Math.min(0.55, 0.22 + Math.abs(f.lx - home) / 60), u = seg(age - f.at - 0.14, 0, dur);
    f.x = lerp(f.lx, home, ease.inOutSine(u));
    f.k = 1 - u;
    f.gone = u >= 1;
    f.splat = clamp(1 - (age - f.at) / 0.14);
  }
  return f;
}

// the wet patch it sits in: wider while squashed, splashed out on landing, left behind while it jumps
function puddleR(t, P) {
  if (P.q >= 0) return (W0 / Math.sqrt(1.36) / 2 + 3) * (1 - 0.22 * P.q);
  return P.W / 2 + 3 + 9 * Math.exp(-P.age * 5) * (1 - Math.exp(-P.age * 40)) * (t >= T_LAND || t < T_SQ ? 1 : 0);
}

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 7), P = pose(t, o.hop), yb = P.by - 1, age = P.age;
  const g = GRID;
  body(g, C, P);
  face(g, C, P, t);
  bubbleIn(g, C, P, t);
  g.outline((x, y, nx, ny) => (ny < 0 && nx <= 0 && y < yb - P.H * 0.5 ? C[1] : C[0]));
  g.draw(p);

  // the bubble pops out of the top: a ring and two flecks
  if (t >= POP && t < POP + 0.16) {
    const k = (t - POP) / 0.16, x = P.lean * P.H - halfW(0.86, P) * 0.05, y = yb - P.H - 0.5;
    for (let a = 0; a < TAU; a += 0.6) p.dot(x + Math.cos(a) * (1 + k * 3), y + Math.sin(a) * (1 + k * 3) * 0.7, C[6], 1.2 - k);
    for (const s of [-1, 1]) p.dot(x + s * (1 + k * 4), y - 1 - k * 6 + k * k * 4, C[5], 1.3 - k);
    p.glow(x, y, 6, C[5], 0.4 * (1 - k));
  }
  // droplets in flight
  for (let i = 0; i < NDROP; i++) {
    const f = droplet(i, o, age);
    if (f.landed || inside(P, f.x, f.y)) continue;
    const sv = Math.hypot(f.vx, f.vy) || 1, ux = f.vx / sv, uy = f.vy / sv, L = Math.min(2.5, sv / 50);
    p.line(f.x - ux * L, f.y - uy * L, f.x, f.y, C[3]);
    if (f.size >= 2) p.px(f.x - 1, f.y, C[4]), p.px(f.x - 1, f.y + 1, C[3]), p.px(f.x, f.y + 1, C[2]);
    if (f.size >= 3) p.px(f.x + 1, f.y, C[3]), p.px(f.x - 1, f.y - 1, C[4]), p.px(f.x, f.y - 1, C[5]);
    p.px(f.x, f.y, f.size >= 2 ? C[6] : C[5]);
    p.glow(f.x, f.y, 5 + f.size, C[4], 0.32);
  }
  // spores drifting up out of the puddle, glowing
  cycle(t, D, 7, o.seed * 13 + 1, (r) => r.range(1.2, 1.8), (ag, L, r, i) => {
    const k = ag / L, x = r.range(-24, 24) + Math.sin(ag * 2.1 + i * 1.7) * 3, y = -2 - r.range(9, 17) * ag - 5 * ag * ag;
    const a = Math.min(1, k * 4) * Math.min(1, (1 - k) * 2.5), tw = 0.6 + 0.4 * Math.sin(ag * 7 + i * 2.3), big = r.chance(0.35);
    p.dot(x, y, tw > 0.8 ? C[6] : C[5], a);
    if (big) p.dot(x + 1, y, C[5], a), p.dot(x, y + 1, C[4], a), p.dot(x + 1, y + 1, C[4], a * 0.6);
    p.glow(x, y, big ? 9 : 6, C[5], (big ? 0.45 : 0.32) * a * tw);
  });
  // drips let go of its underside while it's in the air and plop into the puddle
  for (const [t0, dx] of DRIPS) {
    const a2 = wrap(t - t0, D);
    if (a2 > 0.6) continue;
    const P0 = pose(t0, o.hop), f = toss(dx, P0.by - 0.5, 0, 12, a2, G, -1);
    if (!f.landed) p.px(dx, f.y, C[5]), p.px(dx, f.y - 1, C[4]), p.glow(dx, f.y, 4, C[4], 0.3);
    else if (a2 - f.at < 0.14) {
      const k = (a2 - f.at) / 0.14;
      for (const s2 of [-1, 1]) p.dot(dx + s2 * (1 + k * 3), -2 - k * 3 + k * k * 3, C[5], 1.2 - k);
    }
  }
  // a glint on the dome at the top of the hop
  if (P.q > 0.4 && P.q < 0.64) {
    const k = Math.sin(Math.PI * seg(P.q, 0.4, 0.64));
    sparkle(p, P.lean * 0.8 * P.H - P.W * 0.21, yb - P.H * 0.8, 1 + 2.5 * k, C[6], C[5], 0.5 * k);
  }
  // light: the slime glows through and tints the air round it, the puddle lights the floor, a flash on the splat
  const cx = P.lean * P.H * 0.4, cy = yb - P.H * 0.45, near = clamp(1 + P.by / (o.hop * 1.1));
  const R = puddleR(t, P), br = 0.9 + 0.1 * Math.sin((t / D) * TAU * 2);
  p.glow(cx * 0.5, -14, 64, C[3], 0.3 * br);
  p.glow(cx, cy, 30 + P.W * 0.3, C[4], 0.2);
  p.glow(cx, cy + 3, 14, C[5], 0.16);
  p.glow(0, -2, R * 1.3 + 6, C[4], 0.12 + 0.08 * near);
  if (t >= T_LAND || t < T_SQ) p.glow(0, -3, 40, C[5], 0.42 * Math.exp(-age * 9));
}

const DRIPS = [[1.02, -4], [1.18, 3]];

export function drawBack(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 7), P = pose(t, o.hop), age = P.age;
  // the puddle: a low dome of goo, lit along its top with glints sliding over it, darker where it meets the floor
  const R = puddleR(t, P), hp = Math.min(2.4, 0.9 + R * 0.06);
  for (let x = Math.floor(-R); x <= Math.ceil(R); x++) {
    const d = Math.abs(x + 0.5) / R;
    if (d > 1) continue;
    const top = -1 - Math.round(Math.sqrt(1 - d * d) * hp);
    for (let y = top; y <= 0; y++) {
      let c = y === top ? C[5] : y === 0 ? C[2] : C[4];
      if (d > 0.88) c = y === top ? C[4] : C[3];
      if (y === top && d < 0.88) {
        const n = lnoise(t, D, 7, x * 0.18, 3) + lnoise(t, D, 4, x * 0.07, 4) * 0.6;
        if (n > 0.55) c = C[6];
      } else if (y === top + 1 && d < 0.8 && lnoise(t, D, 3, x * 0.12, 5) > 0.3) c = C[5];
      p.px(x, y, c);
    }
    if (d > 0.96) p.px(x, top - 1, C[1]);
  }
  // bubbles swell out of the puddle and pop, flicking flecks
  cycle(t, D, 4, o.seed * 17 + 3, (r) => r.range(0.45, 0.75), (ag, L, r) => {
    const x = r.range(-0.85, 0.85) * R, k = ag / L, rb = r.range(1.4, 2.6) * (0.3 + 0.7 * ease.outCubic(Math.min(1, k * 1.25)));
    if (Math.abs(x) < P.W / 2 + 1 && P.q < 0) return;
    const sy = -1 - Math.round(Math.sqrt(Math.max(0, 1 - (x / R) ** 2)) * hp);
    if (k < 0.85) {
      for (let y = Math.floor(sy - rb); y <= sy; y++)
        for (let xx = Math.floor(x - rb - 1); xx <= Math.ceil(x + rb + 1); xx++) {
          const dx = xx + 0.5 - x, dy = y + 0.5 - sy, dd = Math.hypot(dx, dy);
          if (dd > rb + 0.5) continue;
          if (dd > rb - 0.7) p.px(xx, y, dx < 0 && dy < -rb * 0.3 ? C[6] : C[4]);
          else p.blend(xx, y, C[5], 0.3);
        }
      p.glow(x, sy - rb * 0.5, rb * 2 + 3, C[5], 0.2);
    } else {
      const q = (k - 0.85) / 0.15;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0.6, -0.7], [-0.6, -0.7], [0, -1]]) p.dot(x + dx * (2 + 3 * q), sy + dy * (2 + 3 * q), C[6], 1.2 - q);
    }
  });
  // landed droplets: a flattened splat, then a bead of goo creeping home, a wet trail behind it
  for (let i = 0; i < NDROP; i++) {
    const f = droplet(i, o, age);
    if (!f.landed || f.gone) continue;
    const x = Math.round(f.x), w = f.size + (f.splat > 0 ? 1 : 0);
    for (let j = 0; j < w; j++) p.px(x - (w >> 1) + j, -1, j === 0 ? C[5] : C[4]);
    if (f.size >= 2 && f.splat <= 0) p.px(x, -2, C[5]), p.px(x - 1, -2, C[4]);
    p.px(x, 0, C[3]);
    const dir = Math.sign(f.lx - f.x);
    for (let j = 1; j < Math.min(8, Math.abs(f.lx - f.x)); j++) p.dot(x + dir * j, 0, C[2], 0.7 - j * 0.08);
    p.glow(x, -1, 5, C[4], 0.25 * f.k + 0.1);
  }
  // the goo string it pulls off the floor as it leaves; when it snaps, a drip falls back and the rest pulls up
  if (t >= T_LIFT && t < SNAP) {
    const bot = P.by - 1, u = (t - T_LIFT) / (SNAP - T_LIFT);
    for (let y = Math.floor(bot); y < 0; y++) {
      const m = Math.sin(((y - bot) / -bot) * Math.PI);
      p.px(-1, y, C[4]);
      if (m * u < 0.45) p.px(0, y, C[3]);
    }
  } else if (t >= SNAP && t < SNAP + 0.3) {
    const a2 = t - SNAP, ys = pose(SNAP, o.hop).by - 1, f = toss(-1, ys * 0.45, 0, 0, a2, G * 1.3, -2);
    if (!f.landed) p.px(-1, f.y, C[5]), p.px(-1, f.y - 1, C[3]);
    const nub = 3 * (1 - a2 / 0.12);
    for (let j = 0; j < nub; j++) p.px(-1, P.by + j, j === 0 ? C[3] : C[4]);
  }
}

// ---- 3D: it hops across the floor from one puddle to a splash, droplets fly out all round, then it oozes back
// along a wet trail to the first puddle so the loop closes. It is a jelly blob that faces the camera, so it never flips.
const SDIR = [Math.cos(0.6), Math.sin(0.6)], SPERP = [-SDIR[1], SDIR[0]], HALF = 14;
const SA = [-SDIR[0] * HALF, -SDIR[1] * HALF], SB = [SDIR[0] * HALF, SDIR[1] * HALF];
const CS = 1.74, CD = D + T_SQ - CS, R_AIR = W0 / Math.sqrt(1.36) / 2 + 3;

// how far through its ooze back it is (0..1), or -1 when it isn't oozing
const creepW = (t) => (t >= CS ? (t - CS) / CD : t < T_SQ ? (t + D - CS) / CD : -1);

// where it stands (u: 0 at the first puddle, 1 at the splash), and how fast it is travelling (+ towards the splash)
function place3(t) {
  const w = creepW(t);
  let u = 0, mv = 0;
  if (t >= T_LIFT && t < T_LAND) {
    u = (t - T_LIFT) / (T_LAND - T_LIFT);
    mv = Math.sin(Math.PI * u);
  } else if (t >= T_LAND && t < CS) u = 1;
  else if (w >= 0) {
    u = 1 - smooth(0, 1, w);
    mv = -Math.sin(Math.PI * w);
  }
  return { x: lerp(SA[0], SB[0], u), z: lerp(SA[1], SB[1], u), u, w, mv };
}

// the 2D pose, flattened and leaning into its travel (which way is right depends on the camera)
function pose3(t, hop, S, q) {
  const P = pose(t, hop), cm = S.w >= 0 ? Math.sin(Math.PI * S.w) : 0, s = P.s - 0.12 * cm;
  return { ...P, s, W: W0 / Math.sqrt(1 + s), H: H0 * (1 + s), lean: P.lean + (SDIR[0] * q.cy - SDIR[1] * q.sy) * 0.12 * S.mv };
}

// the first puddle: it sat in it, leaves it behind, and it fills back as the slime oozes home
function puddleA(t) {
  const w = creepW(t), rest = pose(T_SQ, 0).W / 2 + 3;
  if (t >= T_SQ && t < T_LIFT) return pose(t, 0).W / 2 + 3;
  if (t >= T_LIFT && t < T_LAND) {
    const q = (t - T_LIFT) / (T_LAND - T_LIFT);
    return lerp(pose(T_LIFT, 0).W / 2 + 3, R_AIR * (1 - 0.22 * q), smooth(0, 0.08, t - T_LIFT));
  }
  return w < 0 ? R_AIR * 0.78 : lerp(R_AIR * 0.78, rest, smooth(0, 1, w));
}
// the splash it lands in: it spreads out, then drains away as the slime oozes off
function puddleB(t, P) {
  const w = creepW(t), age = wrap(t - T_LAND, D);
  if (t < T_LAND && t >= T_SQ) return 0;
  return puddleR(t, P) * (1 - smooth(0, 0.7, Math.max(0, w))) * smooth(0, 0.05, age);
}

// a puddle seen from above: a dark rim, a lit crescent, glints sliding over it, the slime's shadow on it
function puddleFlat(q, x, z, R, t, C, shade) {
  if (R < 2) return;
  q.plane(x, 0, z, null, R * 1.12 + 2, (u, v, o) => {
    const d = Math.hypot(u, v), e = R * (1 + 0.07 * lnoise(t, D, 3, (u + 2 * v) * 0.03, 5));
    if (d > e) return;
    let c = d > e - 1.5 ? C[2] : d > e - 3.2 ? C[3] : C[4];
    if (d <= e - 3.2) {
      if ((-u * 0.55 - v * 0.83) / e > 0.3 && d > e * 0.4) c = C[5];
      if (d < e * 0.82 && lnoise(t, D, 7, (u * 0.8 + v) * 0.12, 3) + lnoise(t, D, 4, (u - v) * 0.06, 4) * 0.6 > 0.62) c = C[6];
    }
    const s = shade(x + u, z + v);
    return s > 0.03 ? mix(c, C[0], s) : c;
  });
}

// the goo it drags along the floor from the splash to where it is now, thinning behind it
function trailFlat(q, a, b, k, t, C) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (L < 2 || k <= 0.02) return;
  const dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
  q.plane((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, null, L / 2 + 6, (u, v, o) => {
    const s = u * dx + v * dz + L / 2, n = Math.abs(-u * dz + v * dx), f = s / L;
    if (s < 0 || s > L) return;
    const wd = lerp(1.6, 6, f) + lnoise(t, D, 5, s * 0.1, 8) * 0.8;
    if (n > wd) return;
    o.c = n > wd - 1.2 ? C[2] : f > 0.5 && lnoise(t, D, 6, s * 0.2, 9) > 0.45 ? C[5] : C[3];
    o.a = k * (0.3 + 0.7 * f);
    o.blend = true;
  });
}

// a droplet in space: the 2D arc turned round a random direction, and when it has landed it creeps to the slime
function drop3(i, o, age, S) {
  const f = droplet(i, o, age), a = rng(o.seed, i, 77).range(0, TAU), cx = Math.cos(a), cz = Math.sin(a);
  if (!f.landed) return { ...f, X: SB[0] + cx * f.x, Y: f.y + 1, Z: SB[1] + cz * f.x, VX: cx * f.vx, VY: f.vy, VZ: cz * f.vx };
  const u = 1 - f.k, sg = Math.sign(f.lx || 1), e = ease.inOutSine(u);
  const X = lerp(SB[0] + cx * f.lx, S.x + cx * sg * (W0 / 2 - 2), e), Z = lerp(SB[1] + cz * f.lx, S.z + cz * sg * (W0 / 2 - 2), e);
  return { ...f, X, Y: 0, Z, LX: SB[0] + cx * f.lx, LZ: SB[1] + cz * f.lx };
}

export const three = {
  meta: { size: [152, 124], origin: [76, 92], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, time, o) {
    const t = shift(time, D, o.seed), C = fit(o.palette, 7), q = space(p, o), g = GRID, S = place3(t), P0 = pose(t, o.hop), P = pose3(t, o.hop, S, q);
    const yb = P.by - 1, age = P0.age, hgt = clamp(-P.by / (o.hop * 1.1)), RA = puddleA(t), RB = puddleB(t, P0);
    // its shadow on the floor and on the goo: a true circle that shrinks as it rises
    const sr = (P.W / 2 + 1) * (1 - 0.35 * hgt), sa = 0.55 * (1 - 0.5 * hgt);
    const shade = (x, z) => {
      const d = Math.hypot(x - S.x, z - S.z) / sr;
      return d >= 1 ? 0 : sa * (1 - d) ** 0.7;
    };
    floorShadow(q, S.x, S.z, sr, C[0], sa);
    puddleFlat(q, SA[0], SA[1], RA, t, C, shade);
    puddleFlat(q, SB[0], SB[1], RB, t, C, shade);
    // the slime: a billboard facing the camera
    body(g, C, P);
    face(g, C, P, t);
    bubbleIn(g, C, P, t);
    g.outline((x, y, nx, ny) => (ny < 0 && nx <= 0 && y < yb - P.H * 0.5 ? C[1] : C[0]));
    q.at(S.x, 0, S.z, (pp) => {
      g.draw(pp);
      // the bubble pops out of the top: a ring and two flecks
      if (t >= POP && t < POP + 0.16) {
        const k = (t - POP) / 0.16, x = P.lean * P.H - halfW(0.86, P) * 0.05, y = yb - P.H - 0.5;
        for (let a = 0; a < TAU; a += 0.6) pp.dot(x + Math.cos(a) * (1 + k * 3), y + Math.sin(a) * (1 + k * 3) * 0.7, C[6], 1.2 - k);
        for (const s2 of [-1, 1]) pp.dot(x + s2 * (1 + k * 4), y - 1 - k * 6 + k * k * 4, C[5], 1.3 - k);
        pp.glow(x, y, 6, C[5], 0.4 * (1 - k));
      }
      // a glint on the dome at the top of the hop
      if (P.q > 0.4 && P.q < 0.64) {
        const k = Math.sin(Math.PI * seg(P.q, 0.4, 0.64));
        sparkle(pp, P.lean * 0.8 * P.H - P.W * 0.21, yb - P.H * 0.8, 1 + 2.5 * k, C[6], C[5], 0.5 * k);
      }
    });
    // the goo string it pulls off the floor as it leaves; when it snaps, a drip falls back and a nub hangs from it
    if (t >= T_LIFT && t < SNAP) {
      const u = (t - T_LIFT) / (SNAP - T_LIFT), N = 6;
      for (let k = 0; k < N; k++) {
        const s0 = k / N, s1 = (k + 1) / N, wd = 2.2 * (1 - 0.8 * u * Math.sin(Math.PI * (s0 + s1) / 2));
        q.beam(lerp(SA[0], S.x, s0), lerp(0, P.by, s0), lerp(SA[1], S.z, s0), lerp(SA[0], S.x, s1), lerp(0, P.by, s1), lerp(SA[1], S.z, s1), wd, (uu, v) => (v > 0.5 ? C[3] : C[4]));
      }
    } else if (t >= SNAP && t < SNAP + 0.3) {
      const a2 = t - SNAP, ys = pose(SNAP, o.hop).by - 1, f = toss(0, ys * 0.45, 0, 0, a2, G * 1.3, -2);
      const sp = place3(SNAP);
      if (!f.landed) q.ball(sp.x, f.y + 2, sp.z, 1.1, (nx, ny) => (nx < 0 && ny < 0 ? C[6] : C[5]));
      if (a2 < 0.12) q.beam(S.x, P.by - 0.5, S.z, S.x, P.by - 0.5 + 3 * (1 - a2 / 0.12), S.z, 2, C[4]);
    }
    // droplets in flight, round it in a full circle
    const drops = [];
    for (let i = 0; i < NDROP; i++) drops.push(drop3(i, o, age, S));
    for (const f of drops) {
      if (f.landed) continue;
      const sv = Math.hypot(f.VX, f.VY, f.VZ) || 1, L = Math.min(2.5, Math.hypot(f.vx, f.vy) / 50), r = f.size >= 3 ? 1.9 : f.size >= 2 ? 1.4 : 0.9;
      q.line(f.X - (f.VX / sv) * L, f.Y - (f.VY / sv) * L, f.Z - (f.VZ / sv) * L, f.X, f.Y, f.Z, C[3]);
      q.ball(f.X, f.Y, f.Z, r, (nx, ny) => (nx < 0 && ny < -0.2 ? C[6] : ny > 0.3 ? C[3] : nx < 0 ? C[5] : C[4]));
    }
    // landed droplets: a flattened splat on the floor, a bead creeping home, a wet trail behind it
    for (const f of drops) {
      if (!f.landed || f.gone) continue;
      const w = f.size + (f.splat > 0 ? 1 : 0), rr = w / 2 + 0.4;
      q.plane(f.X, 0, f.Z, null, rr + 1, (u, v, out) => {
        const d = Math.hypot(u, v);
        if (d > rr) return;
        out.c = u + v < 0 ? C[5] : C[4];
        out.a = 1;
      });
      const tx = f.LX - f.X, tz = f.LZ - f.Z, tl = Math.hypot(tx, tz);
      for (let j = 1; j < Math.min(8, tl); j++) q.dot(f.X + (tx / tl) * j, 0, f.Z + (tz / tl) * j, C[2], 0.7 - j * 0.08);
      q.glow(f.X, -1, f.Z, 5, C[4], 0.25 * f.k + 0.1);
    }
    // the wet trail it leaves oozing home, and the goo wave that rolls out of the splat
    if (S.w >= 0) trailFlat(q, SB, [S.x, S.z], 0.85 * (1 - smooth(0.55, 1, S.w)), t, C);
    if (age < 0.45) {
      const k = age / 0.45, rr = 8 + 36 * (1 - Math.exp(-age * 6));
      q.plane(SB[0], 0, SB[1], null, rr + 1, (u, v, out) => {
        const d = Math.hypot(u, v);
        if (d > rr || d < rr - 1.6) return;
        out.c = C[5];
        out.a = 0.95 * (1 - k);
        out.blend = true;
      });
    }
    // drips let go of its underside while it's in the air and plop into the puddle
    for (const [t0, dx] of DRIPS) {
      const a2 = wrap(t - t0, D);
      if (a2 > 0.6) continue;
      const P1 = pose(t0, o.hop), s0 = place3(t0), X = s0.x + SPERP[0] * dx, Z = s0.z + SPERP[1] * dx, f = toss(0, P1.by - 0.5, 0, 12, a2, G, -1);
      if (!f.landed) q.ball(X, f.y + 1, Z, 1.1, (nx, ny) => (nx < 0 && ny < 0 ? C[6] : C[4]));
      else if (a2 - f.at < 0.14) {
        const k = (a2 - f.at) / 0.14;
        for (let j = 0; j < 6; j++) {
          const a = (j / 6) * TAU + dx;
          q.dot(X + Math.cos(a) * (1 + k * 4), -1 - k * 2 + k * k * 2, Z + Math.sin(a) * (1 + k * 4), C[5], 1.2 - k);
        }
      }
    }
    // bubbles swell out of the first puddle and pop, flicking flecks round in a ring
    cycle(t, D, 4, o.seed * 17 + 3, (r) => r.range(0.45, 0.75), (ag, L, r) => {
      const bx = r.range(-0.85, 0.85) * RA, k = ag / L, rb = r.range(1.4, 2.6) * (0.3 + 0.7 * ease.outCubic(Math.min(1, k * 1.25))), bz = r.range(-0.85, 0.85) * RA;
      const X = SA[0] + bx, Z = SA[1] + bz;
      if (bx * bx + bz * bz > (0.85 * RA) ** 2 || (Math.hypot(X - S.x, Z - S.z) < P.W / 2 + 1 && P.q < 0)) return;
      if (k < 0.85) {
        q.ball(X, -rb * 0.45, Z, rb, (nx, ny, nz) => (nx < 0 && ny < -0.3 ? C[6] : nz < 0.55 ? C[4] : C[5]), (nx, ny, nz) => (nz > 0.6 ? 0.3 : 1));
        q.glow(X, -rb, Z, rb * 2 + 3, C[5], 0.2);
      } else {
        const f = (k - 0.85) / 0.15;
        for (let j = 0; j < 6; j++) {
          const a = (j / 6) * TAU;
          q.dot(X + Math.cos(a) * (2 + 3 * f), -1 - 2.5 * f + 1.5 * f * f, Z + Math.sin(a) * (2 + 3 * f), C[6], 1.2 - f);
        }
      }
    });
    // spores drifting up out of the puddles, glowing, in a volume
    cycle(t, D, 9, o.seed * 13 + 1, (r) => r.range(1.2, 1.8), (ag, L, r, i) => {
      const k = ag / L, x = r.range(-24, 24) + Math.sin(ag * 2.1 + i * 1.7) * 3, y = -2 - r.range(9, 17) * ag - 5 * ag * ag;
      const a = Math.min(1, k * 4) * Math.min(1, (1 - k) * 2.5), tw = 0.6 + 0.4 * Math.sin(ag * 7 + i * 2.3), big = r.chance(0.35), z = r.range(-24, 24);
      if (x * x + z * z > 576) return;
      q.dot(x, y, z, tw > 0.8 ? C[6] : C[5], a);
      if (big) q.dot(x + 1, y, z, C[5], a), q.dot(x, y + 1, z, C[4], a);
      q.glow(x, y, z, big ? 9 : 6, C[5], (big ? 0.45 : 0.32) * a * tw);
    });
    // light: the slime glows through and tints the air round it, the puddles light the floor, a flash on the splat
    const cy = yb - P.H * 0.45, near = clamp(1 + P.by / (o.hop * 1.1)), br = 0.9 + 0.1 * Math.sin((t / D) * TAU * 2);
    q.glow(S.x, -14, S.z, 64, C[3], 0.3 * br);
    q.glow(S.x, cy, S.z, 30 + P.W * 0.3, C[4], 0.2);
    q.glow(S.x, cy + 3, S.z, 14, C[5], 0.16);
    floorPool(q, SA[0], SA[1], RA * 1.3 + 6, C[4], 0.3 + 0.2 * near);
    if (RB > 2) floorPool(q, SB[0], SB[1], RB * 1.3 + 6, C[4], 0.3 + 0.2 * near);
    if (t >= T_LAND || t < T_SQ) q.glow(SB[0], -3, SB[1], 40, C[5], 0.42 * Math.exp(-age * 9));
  },
};
