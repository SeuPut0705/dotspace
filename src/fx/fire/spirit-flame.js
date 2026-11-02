// The layered tongue, its noise-torn edges and the shed puffs are adapted from Sprite Fusion's open-source fire
// (https://www.spritefusion.com/pixel-art-vfx/fire), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, mix, clamp, space, WHITE, TAU } from "../../core/index.js";
import { noiseFor, hotFirst, looped, drift, soft, floorGlow } from "./_lib.js";

export const meta = {
  name: "Spirit flame",
  desc: "A cold blue-teal ghost fire floating in the air: a bright rim round a hollow dark heart, a wave climbing its wispy tail, curls breaking off, cold sparks rising.",
  tags: ["fire", "spirit", "ghost", "magic", "cold", "ambient", "loop"],
  size: [80, 124],
  origin: [40, 94],
  duration: 3,
  loop: true,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#040a16", "#08203a", "#0b3a52", "#0f5e6e", "#16908e", "#2cc4b4", "#7ef0dc", "#c8fff2", "#ffffff"],
    seed: 7,
  },
};

const D = meta.duration, NL = noiseFor(D);
// inverted layers: the rim burns brightest, a teal band inside it, a dark hollow heart, a pale core low down
const GHOST = [[1, 1, 1], [0.8, 0.92, 3], [0.6, 0.78, 6], [0.3, 0.42, 2], [0.14, 0.22, 0]];

// a tongue whose centre line carries a wave climbing it: drawn row by row in layers like a fire tongue
function ghostTongue(p, x, y, h, w, centre, N, n, H, layers, jit = 0.5) {
  for (const [lw, lh, ri] of layers) {
    const L = h * lh, c = H[ri];
    for (let r = 0; r <= L; r++) {
      const u = r / Math.max(1, L), v = r / h;
      // a teardrop: round at the bottom, swelling, then drawn out thin
      const half = w * lw * Math.pow(1 - u, 0.75) * Math.min(1, (r + 1.5) / 4) + N(6, n, r * 0.4) * jit * u;
      if (half < 0.3) continue;
      const cx = x + centre(v, r), Y = Math.round(y - r);
      for (let px = Math.round(cx - half), x1 = Math.round(cx + half); px <= x1; px++) p.px(px, Y, c);
    }
  }
}

export function draw(p, t, o) {
  const F = fit(o.palette, 9), H = hotFirst(F), S = o.seed, ph = t / D;
  const N = (rate, seed = 0, off = 0) => NL(t, rate, seed, off);
  const COLD = mix(H[3], WHITE, 0.15), bob = Math.sin(ph * TAU) * 1.5;
  // the wave: it climbs the flame twice a loop, growing toward the tip, and the whole flame leans with a slow drift
  const lean = N(0.67, S + 2) * 3;
  const wave = (v, r, k = 0) => (Math.sin(r * 0.24 - ph * TAU * 2 + k) * 2.2 + Math.sin(r * 0.11 - ph * TAU + k * 0.5) * 3.2) * v * v + lean * v * v;
  const H0 = 44 * (0.92 + 0.08 * N(1.3, S + 3)), y0 = bob;

  // the glow it casts, cold and slow
  const br = 0.9 + 0.1 * N(2, S + 4);
  p.glow(0, y0 - 16, 60, COLD, 0.36 * br);
  p.glow(wave(0.5, 20) * 0.5, y0 - 20, 26, H[2], 0.2 * br);
  // curls breaking off the tips and drifting up, thinning out
  looped(t, D, 40, S + 300, (r) => ({ x: r.range(-4, 4), y: -H0 * r.range(0.55, 0.95), vx: r.range(-7, 7), vy: -r.range(10, 22), life: r.range(1, 1.9), s: r.range(1.4, 2.8), a: r.range(0, TAU), w: r.range(2, 3.5) }), (q, age) => {
    const tb = t - age, [x, y] = drift(q.x + wave(0.9, 26, 0) * 0.5, q.y + y0, q.vx, q.vy, age, 0, -6, 1.2, 0.6), k = 1 - age / q.life;
    const cx = x + Math.sin(age * q.w + q.a) * 3 * (age + 0.2), a = Math.min(1, age * 5) * k;
    soft(p, cx, y, q.s * (0.8 + age * 0.8), H[4], 0.35 * a);
    soft(p, cx - 0.4, y - 0.6, q.s * 0.5 * (0.8 + age * 0.5), H[2], 0.4 * a * k);
    p.glow(cx, y, 6, H[3], 0.15 * a);
  });
  // two thin wisps trailing off the sides, then the body
  // side wisps that flicker out and curl, now long, now gone
  const wl = Math.max(0, 0.25 + 0.55 * N(1.7, S + 6)), wr = Math.max(0, 0.25 + 0.55 * N(1.7, S + 7));
  if (wl > 0.12) ghostTongue(p, -4, y0 - 4, H0 * wl, 2.4, (v, r) => wave(v, r, 2.1) - 6 * v * v + 3 * Math.sin(v * 5 - ph * TAU * 2) * v, N, S * 11 + 1, H, GHOST);
  if (wr > 0.12) ghostTongue(p, 4.2, y0 - 4, H0 * wr, 2.4, (v, r) => wave(v, r, -1.8) + 6 * v * v - 3 * Math.sin(v * 5 - ph * TAU * 2 + 1) * v, N, S * 11 + 2, H, GHOST);
  ghostTongue(p, 0, y0, H0, 8.6, (v, r) => wave(v, r), N, S * 11, H, GHOST, 0.6);
  // bright strands drifting up through the hollow heart
  for (const k of [0, 1]) {
    for (let r = 4; r < H0 * 0.72; r++) {
      const v = r / H0, x = wave(v, r) + Math.sin(r * 0.35 - ph * TAU * 3 + k * Math.PI) * 2.2 * (1 - v), on = Math.sin(r * 0.2 - ph * TAU * 4 + k * 2) > 0.2;
      if (on) p.px(x, y0 - r, k ? H[2] : H[1]);
    }
  }
  // light along the body
  for (const v of [0.2, 0.45, 0.7]) p.glow(wave(v, H0 * v), y0 - H0 * v, 12, H[2], 0.16 * br);
  // the pale heart breathing low in the flame
  p.glow(0, y0 - 4, 9, H[1], 0.22 + 0.06 * N(3, S + 5));
  // cold sparks rising off it, twinkling
  looped(t, D, 34, S + 400, (r) => ({ x: r.range(-7, 7), y: -r.range(4, 28), vx: r.range(-12, 12), vy: -r.range(14, 34), life: r.range(0.9, 1.8), a: r.range(0, TAU) }), (q, age) => {
    const [x, y] = drift(q.x, q.y + y0, q.vx, q.vy, age, 0, -10, 1.2, 1.2), k = 1 - age / q.life, tw = 0.5 + 0.5 * Math.sin(age * 14 + q.a);
    const sx = x + Math.sin(age * 3 + q.a) * 3;
    if (k * (0.4 + 0.6 * tw) < 0.2) return;
    p.px(sx, y, tw > 0.7 && k > 0.5 ? H[0] : k > 0.5 ? H[1] : H[3]);
    if (tw > 0.85 && k > 0.6) p.px(sx - 1, y, H[3]), p.px(sx + 1, y, H[3]), p.px(sx, y - 1, H[3]), p.px(sx, y + 1, H[3]);
    p.glow(sx, y, 4, H[2], 0.3 * k);
  });
}

// the same tongue in 3D: every row is its own upright slice standing at its own (x, z), so a centre line that
// winds round the axis really goes behind and comes back in front. centre(v, r) -> [dx, dz].
function ghostTongue3(q, x, y, z, h, w, centre, N, n, H, layers, jit = 0.5) {
  for (let r = 0; r <= h; r++) {
    const [dx, dz] = centre(r / h, r);
    q.at(x + dx, y - r, z + dz, (pp) => {
      for (const [lw, lh, ri] of layers) {
        const L = h * lh;
        if (r > L) continue;
        const u = r / Math.max(1, L), half = w * lw * Math.pow(1 - u, 0.75) * Math.min(1, (r + 1.5) / 4) + N(6, n, r * 0.4) * jit * u;
        if (half < 0.3) continue;
        const c = H[ri];
        for (let px = Math.round(-half), x1 = Math.round(half); px <= x1; px++) pp.px(px, 0, c);
      }
    });
  }
}

// brighter, solid layers for the 3D crown of wisps: a teal rim, a pale body, a white core
const WISP = [[1, 1, 3], [0.72, 0.9, 2], [0.38, 0.65, 1]];

// 3D: a ghost flame hovering over the floor. It is the same from every side, so its slices stay upright; what
// changes is where they stand: the wave climbing the tail spirals (the centre line goes round in x and z), the
// crown of wisps leaves the body at real azimuths and turns round the axis, curls and cold sparks rise in a full circle,
// and a cold light pool and a faint ring of light lie on the floor.
export const three = {
  meta: { size: [104, 132], origin: [52, 108], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), F = fit(o.palette, 9), H = hotFirst(F), S = o.seed, ph = t / D;
    const N = (rate, seed = 0, off = 0) => NL(t, rate, seed, off);
    const COLD = mix(H[3], WHITE, 0.15), HOV = 12, yb = Math.sin(ph * TAU) * 1.5 - HOV;
    const lean = N(0.67, S + 2) * 3;
    // the wave climbs the flame twice a loop: its two parts in x and (a quarter turn on) in z, a helix
    const wave = (v, r, k = 0) => {
      const a = r * 0.24 - ph * TAU * 2 + k, b = r * 0.11 - ph * TAU + k * 0.5, s = v * v;
      return [(Math.sin(a) * 2.2 + Math.sin(b) * 3.2 + lean) * s, (Math.cos(a) * 2.2 + Math.cos(b) * 3.2) * s];
    };
    const H0 = 44 * (0.92 + 0.08 * N(1.3, S + 3)), br = 0.9 + 0.1 * N(2, S + 4);

    // a crown of four wisps, a quarter turn apart, each peeling off the body at its own height and trailing out
    // and round the axis; the whole crown turns once a loop, so each passes in front of the body and behind it
    const tips = [];
    for (let i = 0; i < 4; i++) {
      const r0 = 5 + i * 8, v0 = r0 / H0, az = (i * TAU) / 4 + (i % 2) * 0.35 + ph * TAU, ca = Math.cos(az), sa = Math.sin(az);
      const rb = 8.6 * Math.pow(1 - v0, 0.75) * 0.75, len = H0 * (0.55 - i * 0.06) * (0.75 + 0.4 * (0.5 + 0.5 * N(1.7, S + 6 + i))), [bx, bz] = wave(v0, r0);
      const centre = (v, r) => {
        const [wx, wz] = wave(v, r, i * 1.9), out = 9 * Math.pow(v, 1.2), tw = 6 * v * v + 2.5 * Math.sin(v * 5 - ph * TAU * 2 + i) * v;
        return [wx * 0.7 + ca * out - sa * tw, wz * 0.7 + sa * out + ca * tw];
      };
      ghostTongue3(q, bx + ca * rb, yb - r0, bz + sa * rb, len, 2.3, centre, N, S * 11 + 1 + i, H, WISP);
      const [tx, tz] = centre(0.85, len * 0.85);
      tips.push([bx + ca * rb + tx, yb - r0 - len * 0.85, bz + sa * rb + tz]);
    }
    ghostTongue3(q, 0, yb, 0, H0, 8.6, (v, r) => wave(v, r), N, S * 11, H, GHOST, 0.6);
    // bright strands winding up through the hollow heart, round the axis
    for (const k of [0, 1]) {
      for (let r = 4; r < H0 * 0.72; r++) {
        const v = r / H0, [wx, wz] = wave(v, r), psi = r * 0.35 - ph * TAU * 3 + k * Math.PI, amp = 2.2 * (1 - v), on = Math.sin(r * 0.2 - ph * TAU * 4 + k * 2) > 0.2;
        if (on) q.px(wx + Math.sin(psi) * amp, yb - r, wz + Math.cos(psi) * amp, k ? H[2] : H[1]);
      }
    }
    // cold sparks rising off it, twinkling, spreading in every direction
    const sparks = [];
    looped(t, D, 34, S + 400, (r) => ({ rho: r.range(0, 7), az: r.range(0, TAU), v: r.range(0, 12), y: -r.range(4, 28), vy: -r.range(14, 34), life: r.range(0.9, 1.8), a: r.range(0, TAU), b: r.range(-1, 1) }), (e, age) => {
      const ca = Math.cos(e.az), sa = Math.sin(e.az), cb = Math.cos(e.az + e.b), sb = Math.sin(e.az + e.b);
      const [x, y] = drift(ca * e.rho, e.y + yb, cb * e.v, e.vy, age, 0, -10, 1.2, 1.2), [z] = drift(sa * e.rho, 0, sb * e.v, 0, age, 0, 0, 1.2, 1.2);
      const k = 1 - age / e.life, tw = 0.5 + 0.5 * Math.sin(age * 14 + e.a);
      if (k * (0.4 + 0.6 * tw) < 0.2) return;
      const sw = Math.sin(age * 3 + e.a) * 3, cw = Math.cos(age * 3 + e.a) * 3;
      sparks.push([x + sw, y, z + cw, k, tw]);
    });
    for (const [x, y, z, k, tw] of sparks) {
      q.at(x, y, z, (pp) => {
        pp.px(0, 0, tw > 0.7 && k > 0.5 ? H[0] : k > 0.5 ? H[1] : H[3]);
        if (tw > 0.85 && k > 0.6) pp.px(-1, 0, H[3]), pp.px(1, 0, H[3]), pp.px(0, -1, H[3]), pp.px(0, 1, H[3]);
      });
    }

    // curls breaking off the tips and drifting up, spiralling out, thinning
    const curls = [];
    looped(t, D, 40, S + 300, (r) => ({ rho: r.range(0, 4), az: r.range(0, TAU), v: r.range(0, 7), y: -H0 * r.range(0.55, 0.95), vy: -r.range(10, 22), life: r.range(1, 1.9), s: r.range(1.4, 2.8), a: r.range(0, TAU), w: r.range(2, 3.5), b: r.range(-1, 1) }), (e, age) => {
      const [wx, wz] = wave(0.9, 26, 0), ca = Math.cos(e.az), sa = Math.sin(e.az), cb = Math.cos(e.az + e.b), sb = Math.sin(e.az + e.b);
      const [x, y] = drift(ca * e.rho + wx * 0.5, e.y + yb, cb * e.v, e.vy, age, 0, -6, 1.2, 0.6), [z] = drift(sa * e.rho + wz * 0.5, 0, sb * e.v, 0, age, 0, 0, 1.2, 0.6);
      const R = 3 * (age + 0.2), th = age * e.w + e.a, k = 1 - age / e.life;
      curls.push([x + Math.sin(th) * R, y, z + Math.cos(th) * R, Math.min(1, age * 5) * k, k, e.s * (0.8 + age * 0.8), e.s * 0.5 * (0.8 + age * 0.5)]);
    });

    // light: the glow it casts, cold and slow; along the body; the pale heart; a pool and a ring on the floor
    const [mx, mz] = wave(0.5, 20);
    q.glow(0, yb - 16, 0, 60, COLD, 0.36 * br);
    q.glow(mx * 0.5, yb - 20, mz * 0.5, 26, H[2], 0.2 * br);
    for (const v of [0.2, 0.45, 0.7]) {
      const [wx, wz] = wave(v, H0 * v);
      q.glow(wx, yb - H0 * v, wz, 12, H[2], 0.16 * br);
    }
    q.glow(0, yb - 4, 0, 9, H[1], 0.22 + 0.06 * N(3, S + 5));
    for (const [x, y, z] of tips) q.glow(x, y, z, 9, H[2], 0.16 * br);
    for (const [x, y, z, a, k] of curls) q.glow(x, y, z, 6, H[3], 0.15 * a);
    for (const [x, y, z, k] of sparks) q.glow(x, y, z, 4, H[2], 0.3 * k);
    floorGlow(q, 0, 0, 38, COLD, 0.34 * br);
    const RR = 24 + 2 * Math.sin(ph * TAU);
    q.plane(0, 0, 0, null, RR + 3, (u, v, out) => {
      const f = 1 - Math.abs(Math.hypot(u, v) - RR) / 2.5;
      if (f <= 0) return;
      out.l = H[3];
      out.k = 0.2 * f * br;
    });

    // the curls last: translucent, far to near
    for (const [x, y, z, a, k, s1, s2] of q.sort(curls, (e) => e)) {
      q.at(x, y, z, (pp) => {
        soft(pp, 0, 0, s1, H[4], 0.35 * a);
        soft(pp, -0.4, -0.6, s2, H[2], 0.4 * a * k);
      });
    }
  },
};
