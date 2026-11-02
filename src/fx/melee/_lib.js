// Shared by the melee effects: swings on a tilted circle (the smear, its dotted trace), floor cracks, rocks.
// The crescent and trace recipe is adapted from Sprite Fusion's open-source slash
// (https://www.spritefusion.com/pixel-art-vfx/slash), MIT License, Copyright (c) 2026 Hugo Duprez.
// Files starting with _ are helpers, not effects.

import { P, clamp, smooth, ease, hex, mix, scale, rgb, WHITE, TAU } from "../../core/index.js";

/**
 * A swing: a circle of radius R around (cx, cy), squashed to sy across its plane (1 stands up facing us, 0.16
 * lies on the floor) and turned by rot, swept from angle a0 in direction dir (+1 turns clockwise on screen).
 * k lifts the band into a shallow cone: a point dr inside the rim sits k * dr higher, so a level ring shows its
 * near half broad and its far half thin, like a blade angled down from the hilt (keep k below sy).
 * Positions along it are u, radians from a0 in the swing's direction.
 */
export const swing = (o) => ({ cx: 0, cy: 0, R: 30, sy: 1, rot: 0, a0: 0, dir: 1, k: 0, ...o });

/** A swing on radius R whose arc passes through (x, y) heading along angle th, that point `at` of the way along span. */
export function through(x, y, th, dir, R, span, at = 0.55, extra = {}) {
  const a = th - (dir * Math.PI) / 2;
  return swing({ cx: x - Math.cos(a) * R, cy: y - Math.sin(a) * R, R, sy: 1, rot: 0, a0: a - dir * span * at, dir, span, ...extra });
}

/** The screen point at plane radius r, u radians along the swing. */
export function onSwing(s, r, u) {
  const a = s.a0 + s.dir * u, lx = Math.cos(a) * r, ly = Math.sin(a) * r * s.sy - s.k * (s.R - r), c = Math.cos(s.rot), n = Math.sin(s.rot);
  return [s.cx + lx * c - ly * n, s.cy + lx * n + ly * c];
}

/** The on-screen unit direction the swing travels at u, and the in-plane angle there (sin < 0 is the far half). */
export function travel(s, u) {
  const [x0, y0] = onSwing(s, s.R, u), [x1, y1] = onSwing(s, s.R, u + 0.01), l = Math.hypot(x1 - x0, y1 - y0) || 1;
  return { x: x0, y: y0, dx: (x1 - x0) / l, dy: (y1 - y0) / l, a: s.a0 + s.dir * u };
}

/** The plane radius and angle under a screen point (inverts onSwing, cone included). */
export function plane(s, x, y) {
  const c = Math.cos(s.rot), n = Math.sin(s.rot), dx = x - s.cx, dy = y - s.cy, lx = dx * c + dy * n, ly = -dx * n + dy * c;
  if (!s.k) return [Math.hypot(lx, ly / s.sy), Math.atan2(ly / s.sy, lx)];
  // r sin(a) sy = m - k r, r cos(a) = lx  =>  r^2 (sy^2 - k^2) + 2 m k r - (lx^2 sy^2 + m^2) = 0
  const m = ly + s.k * s.R, A = s.sy * s.sy - s.k * s.k, B = 2 * m * s.k, Cc = lx * lx * s.sy * s.sy + m * m;
  const r = (-B + Math.sqrt(B * B + 4 * A * Cc)) / (2 * A);
  return [r, Math.atan2((m - s.k * r) / s.sy, lx)];
}

/**
 * Shade a swing's band from u0 to u1 (u1 - u0 at most a full turn), plane radius R + pad down to R - wMax - 1.
 * fn(u, r, out, a) shades each pixel: u along the swing, r its plane radius, a the in-plane angle. half: 0 the
 * whole band, -1 only the far half (behind a character), 1 only the near half.
 */
export function smear(p, s, u0, u1, wMax, fn, half = 0, pad = 1) {
  if (u1 - u0 < 0.005) return;
  const c = Math.cos(s.rot), n = Math.sin(s.rot), A = s.R + pad + 1, Bn = A * s.sy + s.k * (wMax + 2);
  const hx = Math.hypot(A * c, Bn * n) + 1, hy = Math.hypot(A * n, Bn * c) + 1, rIn = s.R - wMax - 1;
  // each half only needs its side of the centre (plus what the tilt and the cone lift can reach across)
  const over = Math.abs(n) * A + s.k * (wMax + 2) + 2, y0 = half > 0 ? s.cy - over : s.cy - hy, y1 = half < 0 ? s.cy + over : s.cy + hy;
  p.shade(s.cx - hx, y0, s.cx + hx, y1, (x, y, out) => {
    const [r, a] = plane(s, x, y);
    if (r > s.R + pad || r < rIn) return;
    if (half && (Math.sin(a) < 0 ? -1 : 1) !== half) return;
    let u = (s.dir * (a - s.a0)) % TAU;
    if (u < 0) u += TAU;
    while (u < u0) u += TAU;
    if (u > u1) return;
    return fn(u, r, out, a);
  });
}

/** Dots along a swing at plane radius r from u0 to u1, every `step` px, alpha a(u) (dithered into a dotted trace). */
export function trace(p, s, r, u0, u1, c, a, half = 0, step = 0.6) {
  const du = step / Math.max(4, r);
  for (let u = u0; u <= u1; u += du) {
    const g = s.a0 + s.dir * u;
    if (half && (Math.sin(g) < 0 ? -1 : 1) !== half) continue;
    const [x, y] = onSwing(s, r, u), k = typeof a === "function" ? a(u) : a;
    if (k > 0) p.dot(x, y, typeof c === "function" ? c(u) : c, k);
  }
}

/** Glow riding a swing from u0 to u1 (light along the arc). */
export function glowAlong(p, s, r, u0, u1, rad, c, k, half = 0, step = 0.35) {
  for (let u = u0; u <= u1; u += step) {
    const g = s.a0 + s.dir * u;
    if (half && (Math.sin(g) < 0 ? -1 : 1) !== half) continue;
    const [x, y] = onSwing(s, r, u), kk = typeof k === "function" ? k(u) : k;
    if (kk > 0.004) p.glow(x, y, rad, c, kk);
  }
}

/**
 * A slash crescent along swing s (Sprite Fusion's recipe): the edge whips out over s.span radians in s.sweep s,
 * holds, then the tail follows over s.trail, thinning and cooling down s.ramp (dark to bright); a dotted trace
 * lingers where it passed. s: a swing plus { span, W, t0, sweep, hold, trail, ramp, hot (0..1 flashes it white),
 * lens (thickest in the middle, not just behind the edge) }.
 */
export function slash(p, s, t, half = 0) {
  const u = t - s.t0;
  if (u < 0) return;
  const R = s.ramp, n = R.length, life = s.sweep + s.hold + s.trail, hot = s.hot ?? 0;
  const head = ease.outExpo(clamp(u / s.sweep)), tail = smooth(s.sweep + s.hold, life, u), age = clamp(u / life);
  const U = s.span * head, T = s.span * tail, W = s.W * (1 - tail * 0.55);
  if (tail < 1 && U - T > 0.01) {
    smear(p, s, T, U, W, (uu, r, out) => {
      const v = (uu - T) / (U - T), w = W * Math.pow(Math.sin(Math.PI * Math.pow(v, s.lens ? 1 : 2.2)), s.lens ? 0.75 : 0.6);
      if (w < 0.35) return;
      const q = (s.R - r) / w;
      if (q < 0 || q > 1) return;
      const ci = (q < 0.22 && age < 0.5) || q < hot * 0.7 ? 0 : Math.round(q * (n - 1) * 0.75 + age * 2.4 - v * 0.8 + 0.4 - hot * 3);
      out.c = R[n - 1 - clamp(ci, 0, n - 1)];
      out.a = Math.min(1, v / (s.lens ? 0.1 : 0.4));
    }, half);
    glowAlong(p, s, s.R - W * 0.4, T, U, 5 + W, R[n - 3], (uu) => (0.22 + hot * 0.3) * (1 - age) * ((uu - T) / (U - T)), half, 0.3);
  }
  const th = 0.7 * (1 - clamp((u - s.sweep - s.hold) / (s.trail + 0.2)));
  if (tail > 0.02 && th > 0) trace(p, s, s.R - 0.5, 0, T, R[2], (uu) => th * (0.4 + 0.6 * uu / s.span), half);
}

/** Where a slash's edge ends up, and which way it's travelling there. */
export const slashEnd = (s) => travel({ ...s, R: s.R - s.W * 0.3 }, s.span);

/** Shavings flung off a slash's edge, outward from its circle (Sprite Fusion's slash). */
export function shavings(ps, R, s, n, colors, from = 0.3) {
  for (let i = 0; i < n; i++) {
    const [x, y] = onSwing(s, s.R, s.span * R.range(from, 1)), ox = x - s.cx, oy = y - s.cy, l = Math.hypot(ox, oy) || 1, sp = R.range(30, 100);
    ps.spawn(P.MOTE, x, y, (ox / l) * sp, Math.min(25, (oy / l) * sp) - 10, R.range(0.25, 0.55), R.pick(colors), 0.6);
  }
}

/** Stone shades for rocks, grit and dust from one body color (as Sprite Fusion's explosion does). */
export function stone(c) {
  c = hex(c);
  return { light: mix(scale(c, 1.35), WHITE, 0.08), body: c, shade: scale(c, 0.64), dust: mix(scale(c, 1.2), rgb(150, 140, 150), 0.3), dark: scale(c, 0.42) };
}

const OUTLINE = hex("#1a1422");
/** A tumbling rock (a Bits CHUNK): a lit side, a shaded side, an outline, fading at the end of its life. */
export function rock(p, b, st) {
  const r = 0.6 + b.s * 0.75, fade = Math.min(1, b.life / 0.5), lx = Math.cos(b.a) * r * 0.4, ly = Math.sin(b.a) * r * 0.4;
  p.shade(b.x - r - 1, b.y - r - 1, b.x + r + 1, b.y + r + 1, (x, y, out) => {
    const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx * 1.15, dy);
    if (d > r + 0.9) return;
    const lit = dx * lx + dy * ly;
    out.c = d > r ? OUTLINE : lit < -0.4 ? st.light : lit > 0.6 ? st.shade : st.body;
    out.a = fade;
  });
}

/**
 * Jagged cracks splitting the floor from x0: each runs out along the floor's edge and zig-zags down into its
 * face (y from 0 to about depth), with short forks. n cracks alternate sides (bias > 0 sends more forward).
 * Returns [{ pts, at (0..1 how far out it starts), fork }]. Built once from an Rng.
 */
export function cracks(R, x0, n, reach, depth = 7, bias = 0.3) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const side = R.chance(0.5 + bias * 0.5) ? 1 : -1, L = reach * R.range(0.45, 1) * (i < 2 ? 1 : 0.7), pts = [[x0 + side * R.range(0, 1.5), 0]];
    let x = pts[0][0], y = 0;
    while (Math.abs(x - x0) < L && y < depth) {
      x += side * R.range(1.5, 3.5);
      y = Math.min(depth, Math.max(0, y + R.range(-0.6, 1.6) * (Math.abs(x - x0) > 3 ? 1 : 0.3)));
      pts.push([Math.round(x), Math.round(y)]);
      if (R.chance(0.18) && pts.length > 3 && y < depth - 2) {
        const f = [[Math.round(x), Math.round(y)]];
        let fx = x, fy = y;
        for (let j = R.int(1, 3); j > 0; j--) (fx += side * R.range(1, 3)), (fy += R.range(0.8, 2)), f.push([Math.round(fx), Math.round(Math.min(depth + 1, fy))]);
        out.push({ pts: f, at: Math.abs(x - x0) / reach, fork: true });
      }
    }
    out.push({ pts, at: 0, fork: false });
  }
  return out;
}

/**
 * An impact star (after Sprite Fusion's impact): tapered spikes [{ a, len, w }] around (x, y), drawn in three
 * passes (rim, body, core) with a hot disc in the middle. sc stretches, th thins.
 */
export function star(p, x, y, spikes, sc, th, core, body, inner, rim) {
  for (const pass of [0, 1, 2])
    for (const s of spikes) {
      const c = Math.cos(s.a), sn = Math.sin(s.a), L = s.len * sc;
      for (let d = 0; d <= L; d += 0.5) {
        const hw0 = s.w * th * (1 - d / L) * Math.min(1, 0.5 + d / 3), hw = pass === 0 ? hw0 + 0.8 : pass === 1 ? hw0 : hw0 * 0.45;
        if (pass === 2 && d > L * 0.55) break;
        for (let o = -hw; o <= hw; o += 0.5) p.px(x + c * d - sn * o, y + sn * d + c * o, pass === 0 ? rim : pass === 1 ? (d < L * 0.35 ? inner : body) : core);
      }
    }
  const r = 2.4 * sc * Math.sqrt(th);
  p.circle(x, y, r + 0.8, inner);
  p.circle(x, y, r, core);
}

/** A thin arc flying out from (x, y): a sliver at radius r around angle a, arc radians long, dithered by k. */
export function sliver(p, x, y, a, r, arc, c, k) {
  const n = Math.ceil(r * arc * 2.2);
  for (let j = 0; j <= n; j++) {
    const u = j / n - 0.5, th = a + u * arc, w = 1.4 * (1 - Math.abs(u) * 2);
    for (let o = -w * 0.5; o <= w * 0.5 + 0.01; o += 0.5) p.dot(x + Math.cos(th) * (r + o), y + Math.sin(th) * (r + o), c, k);
  }
}

/** Part of a polyline: the first `len` px of it. Calls fn(x0, y0, x1, y1, d) for each piece (d: distance along). */
export function along(pts, len, fn) {
  let d = 0;
  for (let i = 1; i < pts.length && d < len; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], l = Math.hypot(x1 - x0, y1 - y0), f = Math.min(1, (len - d) / l);
    fn(x0, y0, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, d);
    d += l;
  }
}


// ---- 3D: the same swings, laid on real planes ------------------------------------------------------------------
// A 2D swing (centre, squash sy, turn rot) is a circle on a tilted plane seen from the front: lay() finds that
// plane, so at yaw 0 the 3D smear lands where the 2D one did and from every other side it stays a true ring in
// space, going behind the body and back in front. The functions below mirror the 2D ones (smear, trace,
// glowAlong, slash, travel, shavings) one for one, taking a Space q and a laid swing.

const vlen = (v) => Math.hypot(v[0], v[1], v[2]) || 1;
const vnorm = (v) => { const l = vlen(v); return [v[0] / l, v[1] / l, v[2] / l]; };
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Lay swing s on a plane: through (s.cx, s.cy, z), its u axis along the swing's turn on screen, its v axis leaning
 * sy across the screen and the rest towards the viewer (the far side of the ring is the top). yaw turns the plane
 * about the vertical through its centre (so a slash can lean in depth, not only on screen); lean tips it flatter
 * (added to the angle it already leans from the screen). Returns the swing plus { c, U, V, n, m } for the functions below.
 */
export function lay(s, o = {}) {
  const sy = clamp(s.sy ?? 1, 0.04, 1), lean = Math.acos(sy) + (o.lean ?? 0), cs = Math.cos(s.rot), sn = Math.sin(s.rot), cl = Math.cos(lean), sl = Math.sin(lean);
  let U = [cs, sn, 0], V = [-sn * cl, cs * cl, sl];
  if (o.yaw) {
    const c = Math.cos(o.yaw), si = Math.sin(o.yaw), turn = (v) => [v[0] * c + v[2] * si, v[1], -v[0] * si + v[2] * c];
    U = turn(U); V = turn(V);
  }
  const n = vcross(U, V), c = [s.cx, s.cy, o.z ?? 0];
  // Space.plane's own axes for this normal, and how mine sit on them
  const e1 = Math.abs(n[1]) > 0.9 ? vnorm(vcross(vcross(n, [1, 0, 0]), n)) : vnorm(vcross(n, [0, -1, 0])), e2 = vcross(n, e1);
  return { ...s, c, U, V, n, m: [vdot(e1, U), vdot(e2, U), vdot(e1, V), vdot(e2, V)] };
}

/** The world point at plane radius r, u radians along a laid swing. */
export function onSwing3(S, r, u) {
  const a = S.a0 + S.dir * u, x = Math.cos(a) * r, y = Math.sin(a) * r;
  return [S.c[0] + S.U[0] * x + S.V[0] * y, S.c[1] + S.U[1] * x + S.V[1] * y, S.c[2] + S.U[2] * x + S.V[2] * y];
}

/** Where a laid swing is at u (on radius S.R) and the unit direction it travels there. */
export function travel3(S, u, r = S.R) {
  const [x, y, z] = onSwing3(S, r, u), [x1, y1, z1] = onSwing3(S, r, u + 0.01), d = vnorm([x1 - x, y1 - y, z1 - z]);
  return { x, y, z, dx: d[0], dy: d[1], dz: d[2], a: S.a0 + S.dir * u };
}

/** Where a laid slash's edge ends up, and which way it is travelling. */
export const slashEnd3 = (S) => travel3(S, S.span, S.R - S.W * 0.3);

/** Shade a laid swing's band from u0 to u1, radius R + pad down to R - wMax - 1; fn(u, r, out, a) as smear's. */
export function smear3(q, S, u0, u1, wMax, fn, pad = 1) {
  if (u1 - u0 < 0.005) return;
  const rIn = S.R - wMax - 1, [m0, m1, m2, m3] = S.m;
  q.plane(S.c[0], S.c[1], S.c[2], S.n, S.R + pad + 0.5, (pu, pv, out) => {
    const x = m0 * pu + m1 * pv, y = m2 * pu + m3 * pv, r = Math.hypot(x, y);
    if (r > S.R + pad || r < rIn) return;
    const a = Math.atan2(y, x);
    let u = (S.dir * (a - S.a0)) % TAU;
    if (u < 0) u += TAU;
    while (u < u0) u += TAU;
    if (u > u1) return;
    return fn(u, r, out, a);
  });
}

/** Dots along a laid swing at radius r from u0 to u1 (a dotted trace in space, with depth). */
export function trace3(q, S, r, u0, u1, c, a, step = 0.6) {
  const du = step / Math.max(4, r);
  for (let u = u0; u <= u1; u += du) {
    const k = typeof a === "function" ? a(u) : a;
    if (k <= 0) continue;
    const [x, y, z] = onSwing3(S, r, u);
    q.dot(x, y, z, typeof c === "function" ? c(u) : c, k);
  }
}

/** Light riding a laid swing from u0 to u1. */
export function glowAlong3(q, S, r, u0, u1, rad, c, k, step = 0.35) {
  for (let u = u0; u <= u1; u += step) {
    const kk = typeof k === "function" ? k(u) : k;
    if (kk <= 0.004) continue;
    const [x, y, z] = onSwing3(S, r, u);
    q.glow(x, y, z, rad, c, kk);
  }
}

/** slash() on a laid swing: the same crescent, its glow and its dotted trace, as a ring segment in space. */
export function slash3(q, S, t) {
  const u = t - S.t0;
  if (u < 0) return;
  const R = S.ramp, n = R.length, life = S.sweep + S.hold + S.trail, hot = S.hot ?? 0;
  const head = ease.outExpo(clamp(u / S.sweep)), tail = smooth(S.sweep + S.hold, life, u), age = clamp(u / life);
  const U = S.span * head, T = S.span * tail, W = S.W * (1 - tail * 0.55);
  if (tail < 1 && U - T > 0.01) {
    smear3(q, S, T, U, W, (uu, r, out) => {
      const v = (uu - T) / (U - T), w = W * Math.pow(Math.sin(Math.PI * Math.pow(v, S.lens ? 1 : 2.2)), S.lens ? 0.75 : 0.6);
      if (w < 0.35) return;
      const f = (S.R - r) / w;
      if (f < 0 || f > 1) return;
      const ci = (f < 0.22 && age < 0.5) || f < hot * 0.7 ? 0 : Math.round(f * (n - 1) * 0.75 + age * 2.4 - v * 0.8 + 0.4 - hot * 3);
      out.c = R[n - 1 - clamp(ci, 0, n - 1)];
      out.a = Math.min(1, v / (S.lens ? 0.1 : 0.4));
    });
    glowAlong3(q, S, S.R - W * 0.4, T, U, 5 + W, R[n - 3], (uu) => (0.22 + hot * 0.3) * (1 - age) * ((uu - T) / (U - T)), 0.3);
  }
  const th = 0.7 * (1 - clamp((u - S.sweep - S.hold) / (S.trail + 0.2)));
  if (tail > 0.02 && th > 0) trace3(q, S, S.R - 0.5, 0, T, R[2], (uu) => th * (0.4 + 0.6 * uu / S.span));
}

/** A random velocity within `spread` radians of the unit direction d, with length sp. */
export function spray(R, d, spread, sp) {
  const a = vnorm(vcross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), b = vcross(d, a), th = R.range(0, spread), ph = R.range(0, TAU);
  const s = Math.sin(th), c = Math.cos(th), pc = Math.cos(ph) * s, ps = Math.sin(ph) * s;
  return [(d[0] * c + a[0] * pc + b[0] * ps) * sp, (d[1] * c + a[1] * pc + b[1] * ps) * sp, (d[2] * c + a[2] * pc + b[2] * ps) * sp];
}

/** shavings() for a laid swing: flung outward from its circle, with a little out of the plane. */
export function shavings3(ps, R, S, n, colors, from = 0.3) {
  for (let i = 0; i < n; i++) {
    const u = S.span * R.range(from, 1), [x, y, z] = onSwing3(S, S.R, u), a = S.a0 + S.dir * u, sp = R.range(30, 100);
    const d = [Math.cos(a) * S.U[0] + Math.sin(a) * S.V[0], Math.cos(a) * S.U[1] + Math.sin(a) * S.V[1], Math.cos(a) * S.U[2] + Math.sin(a) * S.V[2]], o = R.range(-0.7, 0.7) * sp;
    ps.spawn3(P.MOTE, x, y, z, d[0] * sp + S.n[0] * o, Math.min(25, d[1] * sp + S.n[1] * o) - 10, d[2] * sp + S.n[2] * o, R.range(0.25, 0.55), R.pick(colors), 0.6);
  }
}
