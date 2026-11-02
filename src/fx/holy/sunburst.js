import { fit, sparkle, cycle, space, clamp, TAU, WHITE } from "../../core/index.js";
import { GOLD, rod } from "./_lib.js";

export const meta = {
  name: "Sunburst",
  desc: "A white-hot core in a gold corona; long and short rays turn slowly round it, breathing, with glints running out along them that wink at the tips.",
  tags: ["holy", "sun", "radiant", "rays", "light", "glow", "loop"],
  size: [128, 128],
  origin: [64, 64],
  duration: 4,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: GOLD, rays: 8, seed: 3 },
};

const CORE = 4.5, RING = 7.5, R0 = 9;
const frac = (x) => x - Math.floor(x);

// one tapered ray from radius R0 out to R0 + L at angle a: white at the root, cooling to gold, thinning into light
function ray(p, C, a, L, w0, k) {
  const ca = Math.cos(a), sa = Math.sin(a), x1 = ca * (R0 + L), y1 = sa * (R0 + L), pad = w0 + 1;
  p.shade(Math.min(0, x1) - pad, Math.min(0, y1) - pad, Math.max(0, x1) + pad, Math.max(0, y1) + pad, (x, y, out) => {
    const along = x * ca + y * sa - R0, u = along / L;
    if (u < 0 || u > 1) return;
    const across = Math.abs(-x * sa + y * ca), w = (w0 / 2) * (1 - u * 0.85) + 0.25;
    if (across > w) return;
    const spine = across < 0.5, rim = across > w - 0.6 && w > 0.9;
    out.c = spine ? (u < 0.4 ? WHITE : u < 0.75 ? C[6] : C[5]) : rim && u > 0.15 ? C[3] : u < 0.3 ? C[6] : u < 0.62 ? C[5] : C[4];
    out.a = u < 0.72 ? k : k * (1 - (u - 0.72) / 0.28) * 1.2;
  });
  p.glowLine(ca * R0, sa * R0, ca * (R0 + L * 0.8), sa * (R0 + L * 0.8), 5, C[5], 0.16 * k);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), N = o.rays * 2, T = meta.duration, rot = (t / T) * ((2 * TAU) / N);
  p.glow(0, 0, 62, C[4], 0.3 + 0.06 * Math.sin((t / T) * TAU * 2));
  // fine threads of light between the rays
  for (let i = 0; i < N; i++) {
    const a = rot + ((i + 0.5) * TAU) / N, L = 14 + 6 * Math.sin(a * 3 + (t / T) * TAU);
    p.line(Math.cos(a) * (R0 + 1), Math.sin(a) * (R0 + 1), Math.cos(a) * (R0 + L), Math.sin(a) * (R0 + L), (u) => (u < 0.3 ? C[6] : C[5]), (u) => 0.7 - u * 0.8);
  }
  // the rays, long and short by turns, breathing as a wave runs round them
  for (let i = 0; i < N; i++) {
    const a = rot + (i * TAU) / N, long = i % 2 === 0, breathe = 0.86 + 0.14 * Math.sin(a * 3 - (t / T) * TAU * 2);
    const L = (long ? 36 : 21) * breathe;
    ray(p, C, a, L, long ? 4 : 2.6, 1);
    // a glint runs out along each long ray and winks at the tip
    if (long) {
      const g = frac((t / T) * 2 + (a * 3) / TAU), r = R0 + g * L;
      if (g < 0.9) {
        p.px(Math.cos(a) * r, Math.sin(a) * r, WHITE);
        p.glow(Math.cos(a) * r, Math.sin(a) * r, 5, C[6], 0.45 * (1 - g));
      } else sparkle(p, Math.cos(a) * (R0 + L), Math.sin(a) * (R0 + L), 1 + 3 * Math.sin(((g - 0.9) / 0.1) * Math.PI), WHITE, C[6], 0.5);
    }
  }
  // the corona and the core
  p.shade(-RING - 2, -RING - 2, RING + 2, RING + 2, (x, y, out) => {
    const d = Math.hypot(x, y);
    if (d > RING) return;
    const flick = 0.5 + 0.5 * Math.sin(Math.atan2(y, x) * 5 + (t / T) * TAU * 3);
    out.c = d < CORE ? WHITE : d < CORE + 1.5 ? (flick > 0.6 ? WHITE : C[6]) : flick > 0.5 ? C[5] : C[4];
  });
  p.glow(0, 0, 16, WHITE, 0.28);
  // twinkles round it
  cycle(t, T, 10, o.seed, (g) => g.range(0.35, 0.7), (age, life, R) => {
    const a = R.range(0, TAU), d = R.range(16, 44), k = Math.sin((age / life) * Math.PI);
    sparkle(p, Math.cos(a) * d, Math.sin(a) * d, 1 + 2.4 * k * R.range(0.5, 1), WHITE, C[5], 0.4 * k);
  });
}

// 3D: a sun hanging in the air. The rays leave it in every direction: a belt of long and short ones round its
// equator, two shorter belts above and below, one at each pole, the whole thing turning on a leaning axis
const TILT = 0.7;
const aim = (lat, lon) => {
  const c = Math.cos(lat), x = c * Math.cos(lon), y = -Math.sin(lat), z = c * Math.sin(lon);
  return [x, y * Math.cos(TILT) - z * Math.sin(TILT), y * Math.sin(TILT) + z * Math.cos(TILT)];
};

export const three = {
  meta: { size: [128, 128], origin: [64, 64], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const C = fit(o.palette, 8), N = o.rays * 2, T = meta.duration, ph = (t / T) * TAU, rot = (t / T) * ((2 * TAU) / N), q = space(p, o);
    // one tapered ray from radius R0 out to R0 + L: white at the root, cooling to gold, thinning into light
    const ray = (d, L, w0, dim = 0) => {
      // a ray pointing at (or away from) the camera is a blob over the core: leave it out
      q.project(0, 0, 0);
      const x0 = q.x, y0 = q.y, d0 = q.d;
      q.project(d[0] * (R0 + L), d[1] * (R0 + L), d[2] * (R0 + L));
      if (Math.hypot(q.x - x0, q.y - y0) < 0.5 * (R0 + L)) return;
      // rays on the far side of the sun are a step darker
      const sh = dim + (q.d - d0 > 4 ? 1 : 0), B = (i) => C[Math.max(2, i - sh)];
      rod(q, d[0] * R0, d[1] * R0, d[2] * R0, d[0] * (R0 + L), d[1] * (R0 + L), d[2] * (R0 + L), w0, 0.6, (u, v, out) => {
        const body = u < 0.3 ? B(6) : u < 0.62 ? B(5) : B(4);
        out.c = v < 0.34 ? (u < 0.5 && !sh ? WHITE : B(6)) : v > 0.8 && w0 > 3 ? B(4) : body;
        out.a = u < 0.72 ? 1 : (1 - (u - 0.72) / 0.28) * 1.2;
        out.blend = false;
      });
    };
    const belt = [];
    for (let i = 0; i < N; i++) {
      const lon = rot + (i * TAU) / N, long = i % 2 === 0, L = (long ? 36 : 21) * (0.86 + 0.14 * Math.sin(lon * 3 - ph * 2));
      belt.push({ d: aim(0, lon), L, long, lon });
    }
    // the rays, long and short by turns, breathing as a wave runs round them; above and below, shorter
    for (const b of belt) ray(b.d, b.L, b.long ? 5.5 : 3.4);
    for (const lat of [0.8, -0.8])
      for (let i = 0; i < N / 2; i++) ray(aim(lat, rot + ((i + (lat > 0 ? 0.25 : 0.75)) * TAU) / (N / 2)), 15 + 3 * Math.sin(ph + i), 2.6, 1);
    for (const lat of [Math.PI / 2, -Math.PI / 2]) ray(aim(lat, 0), 24 + 3 * Math.sin(ph * 2), 4, 1);
    // fine threads of light between the rays of the belt
    for (let i = 0; i < N; i++) {
      const lon = rot + ((i + 0.5) * TAU) / N, d = aim(0, lon), L = 14 + 6 * Math.sin(lon * 3 + ph);
      q.line(d[0] * (R0 + 1), d[1] * (R0 + 1), d[2] * (R0 + 1), d[0] * (R0 + L), d[1] * (R0 + L), d[2] * (R0 + L), (u) => (u < 0.3 ? C[6] : C[5]), (u) => 0.7 - u * 0.8);
    }
    // the corona and the core: a white heart in a flickering gold rim
    q.ball(0, 0, 0, RING, (nx, ny, nz) => {
      const flick = 0.5 + 0.5 * Math.sin(Math.atan2(ny, nx) * 5 + ph * 3);
      return nz > 0.8 ? WHITE : nz > 0.6 ? (flick > 0.6 ? WHITE : C[6]) : flick > 0.5 ? C[5] : C[4];
    });
    // a glint runs out along each long ray and winks at the tip
    for (const b of belt) {
      if (!b.long) continue;
      const g = frac((t / T) * 2 + (b.lon * 3) / TAU), r = R0 + g * b.L;
      if (g < 0.9) {
        q.at(b.d[0] * r, b.d[1] * r, b.d[2] * r, (pp) => ((pp.z -= 2), pp.px(0, 0, WHITE)));
        q.glow(b.d[0] * r, b.d[1] * r, b.d[2] * r, 5, C[6], 0.45 * (1 - g));
      } else {
        const s = 1 + 3 * Math.sin(((g - 0.9) / 0.1) * Math.PI);
        q.at(b.d[0] * (R0 + b.L), b.d[1] * (R0 + b.L), b.d[2] * (R0 + b.L), (pp) => sparkle(pp, 0, 0, s, WHITE, C[6], 0.5));
      }
      q.glowLine(b.d[0] * R0, b.d[1] * R0, b.d[2] * R0, b.d[0] * (R0 + b.L * 0.8), b.d[1] * (R0 + b.L * 0.8), b.d[2] * (R0 + b.L * 0.8), 5, C[5], 0.16);
    }
    q.glow(0, 0, 0, 62, C[4], 0.3 + 0.06 * Math.sin(ph * 2));
    q.glow(0, 0, 0, 16, WHITE, 0.28);
    // twinkles round it, anywhere on a sphere
    cycle(t, T, 10, o.seed, (g) => g.range(0.35, 0.7), (age, life, R) => {
      const a = R.range(0, TAU), d = R.range(16, 44), k = Math.sin((age / life) * Math.PI), s = R.range(-1, 1), c = Math.sqrt(1 - s * s);
      const arm = 1 + 2.4 * k * R.range(0.5, 1);
      q.at(Math.cos(a) * c * d, s * d, Math.sin(a) * c * d, (pp) => sparkle(pp, 0, 0, arm, WHITE, C[5], 0.4 * k));
    });
  },
};
