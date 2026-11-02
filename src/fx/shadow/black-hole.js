// The dithered tone ramp and the brighter, bluer approaching side are adapted from Sprite Fusion's open-source
// black-hole (https://www.spritefusion.com/pixel-art-vfx/black-hole), MIT License, Copyright (c) 2026 Hugo Duprez.
import { cycle, fit, clamp, smooth, space, TAU, WHITE, hex, mix } from "../../core/index.js";
import { VOID, halo, unlight, unlit3 } from "./_lib.js";

export const meta = {
  name: "Black hole",
  desc: "A tilted disk of banded rings turns round a black hole, its far side bent up over the top and under the bottom; debris spirals in, stretches and is swallowed.",
  tags: ["shadow", "black-hole", "void", "space", "gravity", "dark", "magic", "loop"],
  size: [184, 132],
  origin: [92, 124],
  duration: 4,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: VOID, rock: ["#120d1c", "#2e2440", "#544468", "#857399"], seed: 4 },
};

// the hole's centre, its shadow, how hard it bends light; the disk's tilt (screen angle, and how open it is)
// light bent over the top left the far side's upper face, so the arch sees the disk more face-on (SI_ARCH)
const Y = -70, RS = 13.5, E = 17.5, SI = 0.25, SI_ARCH = 0.46, TILT = -0.14, D = 4;
const CT = Math.cos(TILT), ST = Math.sin(TILT);
// rings with gaps between them, inner ones hotter and turning faster (whole turns of pattern a loop)
const BANDS = [
  { r0: 18, r1: 24, n: 5, hot: 1.35, k: 0.3 },
  { r0: 26, r1: 34, n: 3, hot: 0.92, k: 1.9 },
  { r0: 35.5, r1: 46, n: 2, hot: 0.64, k: 3.7 },
  { r0: 47.5, r1: 60, n: 1, hot: 0.42, k: 5.2 },
];
const ROUT = 60;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const ICE = hex("#e4f7ff");

// brightness of the disk at a point of its plane (X across, Z away from us), banded, streaked, turning
function disk(X, Z, t) {
  const rho = Math.sqrt(X * X + Z * Z);
  for (const b of BANDS) {
    if (rho < b.r0 || rho > b.r1) continue;
    const w = (rho - b.r0) / (b.r1 - b.r0), ph = Math.atan2(Z, X) - (TAU * b.n * t) / D;
    const streak = 0.62 + 0.22 * Math.cos(7 * ph + rho * 0.8 + b.k) + 0.16 * Math.cos(13 * ph - rho * 1.6 + b.k * 2);
    const lane = 0.72 + 0.28 * Math.cos(rho * 2.3 + b.k);
    const edge = smooth(0, 0.18, w) * (1 - smooth(0.78, 1, w));
    return { I: b.hot * streak * lane * (0.35 + 0.65 * edge), dop: -X / rho };
  }
  return null;
}

// the hole and its disk, ray by ray: the near half straight in front, the far half seen through the bend
// (above the hole, and as a thin second image below it), the shadow, and the photon ring at its edge
function hole(p, C, t, pulse) {
  const RAMP = [C[1], C[2], C[3], C[4], C[5], C[6], C[7], WHITE], n = RAMP.length;
  const W = ROUT + 2, H = 42;
  p.shade(-W, Y - H, W, Y + H, (x, y, out) => {
    const dx = x, dy = y - Y, u = dx * CT + dy * ST, v = -dx * ST + dy * CT, r = Math.sqrt(u * u + v * v);
    let s = null;
    if (v > 0) s = disk(u, -v / SI, t);
    if (!s && r > RS) {
      const k = 1 - (E * E) / (r * r), bu = u * k, bv = v * k, si = k > 0 ? SI_ARCH : SI;
      if (-bv / si > 0) s = disk(bu, -bv / si, t);
    }
    if (!s || s.I < 0.06) {
      if (r < RS - 0.4) return C[0];
      if (r < RS + 0.7) {
        const a = Math.atan2(v, u), f = 0.5 + 0.5 * Math.cos(3 * a + (TAU * 2 * t) / D) + pulse * 0.4;
        out.k = 0.3;
        return f > 0.55 ? WHITE : C[7];
      }
      return;
    }
    // tone: dithered between ramp steps; the side turning toward us brighter and icier
    const I = s.I * 1.3 * (1 + 0.55 * s.dop) * (1 + 0.25 * pulse), f = clamp(I) * (n - 1);
    let i = Math.floor(f);
    if (f - i > BAYER[((Math.floor(y) & 3) << 2) | (Math.floor(x) & 3)]) i = Math.min(n - 1, i + 1);
    if (i === 0 && I < 0.12) return;
    let c = RAMP[i];
    if (s.dop > 0.35 && i >= n - 3) c = mix(c, ICE, Math.min(1, (s.dop - 0.35) * 2));
    if (s.dop < -0.4 && i >= 2 && i < n - 2) c = mix(c, C[3], 0.35);
    if (i >= n - 4 && ((Math.floor(x) + Math.floor(y)) & 1) === 0) out.k = 0.3 * Math.min(1, I - 0.35);
    return c;
  });
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8);
  p.glow(0, -1, 44, C[4], 0.12);
  p.glow(0, Y, 80, C[4], 0.32);
  p.glow(0, Y, 46, mix(C[6], C[5], 0.5), 0.45);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), K = fit(o.rock, 4), S = o.seed;
  // a gulp as debris is swallowed, twice a loop
  const pulse = Math.max(0, Math.cos((TAU * 2 * t) / D)) ** 12;
  // pebbles torn off the floor, rising to join the disk
  cycle(t, D, 10, S + 3, (r) => r.range(1.6, 2.6), (age, L, r) => {
    const x0 = r.range(-60, 60), u = Math.pow(age / L, 1.5), tx = Math.sign(x0 || 1) * r.range(40, 56), ty = Y + r.range(4, 9);
    const x = x0 + (tx - x0) * u, y = -1 + (ty + 1) * u - Math.sin(Math.PI * u) * 10;
    p.px(x, y, u > 0.6 ? K[3] : K[2]);
    if (age < 0.25) p.disc(x0, -1.5, 2 + age * 8, K[2], 0.4 * (1 - age / 0.25));
  });
  hole(p, C, t, pulse);
  // motes streaking in from all round, turning with the disk as they fall
  cycle(t, D, 40, S + 7, (r) => r.range(0.5, 0.9), (age, L, r) => {
    const a0 = r.range(0, TAU), d0 = r.range(48, 76), q = Math.pow(age / L, 1.6), d = RS + 2 + (d0 - RS - 2) * (1 - q), a = a0 + 0.9 * q;
    const x = Math.cos(a) * d * 1.15, y = Y + Math.sin(a) * d * 0.75, q2 = Math.pow(Math.max(0, age - 0.09) / L, 1.6), d2 = RS + 2 + (d0 - RS - 2) * (1 - q2), a2 = a0 + 0.9 * q2;
    if (d < RS + 3 || y > -3 || y < -120 || Y + Math.sin(a2) * d2 * 0.75 < -120 || Math.abs(x) > 90) return;
    const col = r.pick([WHITE, C[7], C[6], C[5]]);
    p.line(Math.cos(a2) * d2 * 1.15, Y + Math.sin(a2) * d2 * 0.75, x, y, (u) => (u > 0.6 ? col : C[4]), Math.min(1, age * 6));
    p.glow(x, y, 3, col, 0.3);
  });
  // debris spiralling in: lumps of rock lit on the side toward the hole, stretched into hot streaks as they
  // fall, gone in a flash at the photon ring; behind the hole they're hidden by it
  cycle(t, D, 22, S, (r) => r.range(1.4, 2.4), (age, L, r) => {
    const ph0 = r.range(0, TAU), rho0 = r.range(58, 80), hgt = r.range(-8, 8), size = r.range(1.6, 2.8);
    const at = (aa) => {
      const q = clamp(aa / L), rho = RS + 1 + (rho0 - RS - 1) * (1 - Math.pow(q, 1.5)), ph = ph0 + 2.4 * Math.pow(q, 1.6) * (1 + 1.5 * q);
      const X = Math.cos(ph) * rho, Z = Math.sin(ph) * rho, sx = X, sy = -Z * SI + hgt * (1 - q);
      return { x: sx * CT - sy * ST, y: Y + sx * ST + sy * CT, Z, rho };
    };
    const a = at(age), b = at(age - 0.04), hidden = a.Z > 0 && Math.hypot(a.x, a.y - Y) < RS + 1;
    if (hidden) return;
    if (a.rho < RS + 3) {
      p.px(a.x, a.y, WHITE);
      p.glow(a.x, a.y, 6, C[6], 0.6);
      return;
    }
    const heat = 1 - smooth(16, 34, a.rho), len = 1 + heat * 7;
    if (heat > 0.05) {
      const dx = a.x - b.x, dy = a.y - b.y, l = Math.hypot(dx, dy) || 1;
      p.line(a.x - (dx / l) * len, a.y - (dy / l) * len, a.x, a.y, (u) => (u > 0.7 ? WHITE : u > 0.35 ? C[6] : C[4]));
      p.glow(a.x, a.y, 4, C[6], 0.4 * heat);
    } else {
      const lx = -a.x / (Math.hypot(a.x, a.y - Y) || 1), ly = -(a.y - Y) / (Math.hypot(a.x, a.y - Y) || 1);
      // a lump of rock: a fading wake along its orbit, a dark body, its face toward the hole lit violet
      const c = at(age - 0.09), d = at(age - 0.15);
      p.px(b.x, b.y, C[3]);
      p.dot(c.x, c.y, C[3], 0.7);
      p.dot(d.x, d.y, C[2], 0.5);
      const s2 = size > 2.2;
      p.px(a.x, a.y, K[2]);
      p.px(a.x + 1, a.y, K[1]);
      p.px(a.x, a.y + 1, K[1]);
      if (s2) (p.px(a.x + 1, a.y + 1, K[0]), p.px(a.x - 1, a.y, K[1]), p.px(a.x, a.y - 1, K[2]));
      p.px(a.x + Math.round(lx * 1.4), a.y + Math.round(ly * 1.4), s2 ? C[6] : C[5]);
      p.glow(a.x, a.y, 4, C[5], 0.15);
    }
  });
  halo(p, 0, Y, RS - 0.4, RS + 4, C[6], 0.35 + 0.3 * pulse);
  unlight(p, -RS, Y - RS, RS, Y + RS, (x, y) => {
    const dx = x, dy = y - Y, v = -dx * ST + dy * CT, u = dx * CT + dy * ST;
    return u * u + v * v < (RS - 0.6) ** 2 && !(v > 0 && disk(u, -v / SI, t));
  });
}

// ---- 3D: an accretion disk in real space, a little off level (its near half a plane, debris orbiting through it
// and sorting round the hole), a black sphere with a crawling photon ring, and, because light bends round the
// hole whichever way you look, the disk's far side bent over the top and under the bottom as seen from the camera.
const TIL = 0.17, N3 = [-Math.sin(TIL), -Math.cos(TIL), 0], B1 = [Math.cos(TIL), -Math.sin(TIL), 0], B2 = [0, 0, 1];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// a point of the disk's plane (a along its slope, b across), h above the plane, round the hole
const onDisk = (a, b, h = 0) => [B1[0] * a + N3[0] * h, Y + B1[1] * a + N3[1] * h, b + N3[2] * h];

// brightness of the disk at a plane point (a, b); Xs is its screen x from the hole, for the Doppler shift
function disk3(a, b, Xs, t) {
  const rho = Math.sqrt(a * a + b * b);
  for (const bd of BANDS) {
    if (rho < bd.r0 || rho > bd.r1) continue;
    const w = (rho - bd.r0) / (bd.r1 - bd.r0), ph = Math.atan2(-b, a) - (TAU * bd.n * t) / D;
    const streak = 0.62 + 0.22 * Math.cos(7 * ph + rho * 0.8 + bd.k) + 0.16 * Math.cos(13 * ph - rho * 1.6 + bd.k * 2);
    const lane = 0.72 + 0.28 * Math.cos(rho * 2.3 + bd.k);
    const edge = smooth(0, 0.18, w) * (1 - smooth(0.78, 1, w));
    return { I: bd.hot * streak * lane * (0.35 + 0.65 * edge), dop: -Xs / rho };
  }
  return null;
}

// the dithered tone ramp, the approaching side brighter and icier; (x, y) the pixel, for the dither
function tone(RAMP, C, s, x, y, pulse, out) {
  const n = RAMP.length, I = s.I * 1.3 * (1 + 0.55 * s.dop) * (1 + 0.25 * pulse), f = clamp(I) * (n - 1);
  let i = Math.floor(f);
  if (f - i > BAYER[((Math.floor(y) & 3) << 2) | (Math.floor(x) & 3)]) i = Math.min(n - 1, i + 1);
  if (i === 0 && I < 0.12) return;
  let c = RAMP[i];
  if (s.dop > 0.35 && i >= n - 3) c = mix(c, ICE, Math.min(1, (s.dop - 0.35) * 2));
  if (s.dop < -0.4 && i >= 2 && i < n - 2) c = mix(c, C[3], 0.35);
  if (i >= n - 4 && ((Math.floor(x) + Math.floor(y)) & 1) === 0) out.k = 0.3 * Math.min(1, I - 0.35);
  return c;
}

export const three = {
  meta: { size: [184, 160], origin: [92, 138], camera: { pitch: 0.34 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), K = fit(o.rock, 4), S = o.seed, RAMP = [C[1], C[2], C[3], C[4], C[5], C[6], C[7], WHITE];
    // the camera's axes: right, down and towards it, in the world
    const cy = q.cy, sy = q.sy, sp = q.sp, cp = q.cp, AR = [cy, 0, -sy], AD = [sy * sp, cp, cy * sp], AT = [sy * cp, -sp, cy * cp];
    const m11 = dot3(B1, AR), m12 = dot3(B2, AR), m21 = dot3(B1, AD), m22 = dot3(B2, AD), det = m11 * m22 - m12 * m21;
    const open = Math.abs(dot3(N3, AT)), F = Math.min(1.85, 0.9 / Math.max(0.08, open));
    const pulse = Math.max(0, Math.cos((TAU * 2 * t) / D)) ** 12;
    // the hole: a black sphere whose rim is the photon ring, crawling
    q.ball(0, Y, 0, RS + 0.7, (nx, ny, nz) => {
      if (nz > 0.39) return C[0];
      const f = 0.5 + 0.5 * Math.cos(3 * Math.atan2(ny, nx) + (TAU * 2 * t) / D) + pulse * 0.4;
      return f > 0.55 ? WHITE : C[7];
    });
    // the disk's near half, a true plane: banded rings, streaks and lanes, the side turning toward us brighter
    q.plane(0, Y, 0, N3, ROUT, (a, b, out) => {
      const rho = Math.hypot(a, b);
      if (rho < 18 || rho > 60 || a * dot3(B1, AT) + b * dot3(B2, AT) < 0) return;
      const s = disk3(a, b, a * m11 + b * m12, t);
      if (!s || s.I < 0.06 || !q.project(...onDisk(a, b))) return;
      return tone(RAMP, C, s, q.x, q.y, pulse, out);
    });
    // the far half, bent over the top and under the bottom, behind the hole
    if (Math.abs(det) > 0.02)
      q.at(0, Y, 0, (pp) => {
        pp.z += 5;
        pp.shade(-ROUT - 2, -46, ROUT + 2, 46, (x, y, out) => {
          const r = Math.sqrt(x * x + y * y);
          if (r <= RS) return;
          const k = 1 - (E * E) / (r * r), bu = x * k, bv = (y * k) / (k > 0 ? F : 1);
          // the near half's own line decides which side shows the bent far half, whatever the slope
          const ds = ((m22 * x - m12 * y) * dot3(B1, AT) + (m11 * y - m21 * x) * dot3(B2, AT)) / det;
          if (ds * k >= 0) return;
          const a = (m22 * bu - m12 * bv) / det, b = (m11 * bv - m21 * bu) / det;
          const s = disk3(a, b, bu, t);
          if (!s || s.I < 0.06) return;
          return tone(RAMP, C, s, x, y, pulse, out);
        });
      });
    // pebbles torn off the floor, rising to join the disk
    cycle(t, D, 12, S + 3, (r) => r.range(1.6, 2.6), (age, L, r) => {
      const a0 = r.range(0, TAU), d0 = r.range(8, 62), u = Math.pow(age / L, 1.5), tr = r.range(40, 56);
      const x0 = Math.cos(a0) * d0, z0 = Math.sin(a0) * d0, [tx, ty, tz] = onDisk(Math.cos(a0) * tr, Math.sin(a0) * tr, r.range(-4, -9));
      const x = x0 + (tx - x0) * u, z = z0 + (tz - z0) * u, y = -1 + (ty + 1) * u - Math.sin(Math.PI * u) * 10;
      q.px(x, y, z, u > 0.6 ? K[3] : K[2]);
      if (age < 0.25) q.disc(x0, -1.5, z0, 2 + age * 8, K[2], 0.4 * (1 - age / 0.25));
    });
    // motes streaking in from every side, turning with the disk as they fall
    cycle(t, D, 44, S + 7, (r) => r.range(0.5, 0.9), (age, L, r) => {
      const a0 = r.range(0, TAU), d0 = r.range(48, 76), el = r.range(-1.1, 0.8), col = r.pick([WHITE, C[7], C[6], C[5]]);
      const pos = (aa) => {
        const qq = Math.pow(Math.max(0, aa) / L, 1.6), d = RS + 2 + (d0 - RS - 2) * (1 - qq), a = a0 + 0.9 * qq;
        return [Math.cos(a) * d * Math.cos(el), Y + Math.sin(el) * d, -Math.sin(a) * d * Math.cos(el), d];
      };
      const [x, y, z, d] = pos(age), [x2, y2, z2] = pos(age - 0.09);
      if (d < RS + 3) return;
      q.line(x2, y2, z2, x, y, z, (u) => (u > 0.6 ? col : C[4]), Math.min(1, age * 6));
      q.glow(x, y, z, 3, col, 0.3);
    });
    // debris spiralling in through the disk: lumps of rock lit on the side toward the hole, stretched into hot
    // streaks as they fall, gone in a flash at the photon ring; behind the hole the sphere hides them
    cycle(t, D, 22, S, (r) => r.range(1.4, 2.4), (age, L, r) => {
      const ph0 = r.range(0, TAU), rho0 = r.range(58, 80), hgt = r.range(-8, 8), size = r.range(1.6, 2.8);
      const at = (aa) => {
        const u = clamp(aa / L), rho = RS + 1 + (rho0 - RS - 1) * (1 - Math.pow(u, 1.5)), ph = ph0 + 2.4 * Math.pow(u, 1.6) * (1 + 1.5 * u);
        const [x, y, z] = onDisk(Math.cos(ph) * rho, -Math.sin(ph) * rho, 1.5 + hgt * (1 - u));
        return { x, y, z, rho };
      };
      const a = at(age), b = at(age - 0.04);
      if (a.rho < RS + 3) {
        q.px(a.x, a.y, a.z, WHITE);
        q.glow(a.x, a.y, a.z, 6, C[6], 0.6);
        return;
      }
      const heat = 1 - smooth(16, 34, a.rho), len = 1 + heat * 7;
      if (heat > 0.05) {
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z, l = Math.hypot(dx, dy, dz) || 1;
        q.line(a.x - (dx / l) * len, a.y - (dy / l) * len, a.z - (dz / l) * len, a.x, a.y, a.z, (u) => (u > 0.7 ? WHITE : u > 0.35 ? C[6] : C[4]));
        q.glow(a.x, a.y, a.z, 4, C[6], 0.4 * heat);
        return;
      }
      const c = at(age - 0.09), d = at(age - 0.15);
      q.dot(c.x, c.y, c.z, C[3], 0.7);
      q.dot(d.x, d.y, d.z, C[2], 0.5);
      // the lit side of the rock faces the hole, as seen from here
      q.project(a.x, a.y, a.z);
      const ax = q.x, ay = q.y;
      q.project(0, Y, 0);
      const lx = q.x - ax, ly = q.y - ay, ll = Math.hypot(lx, ly) || 1, ux = lx / ll, uy = ly / ll, big = size > 2.2;
      q.ball(a.x, a.y, a.z, size * 0.55, (nx, ny, nz) => {
        const f = nx * ux + ny * uy;
        return f > 0.55 ? (big ? C[6] : C[5]) : f > -0.1 ? K[2] : f > -0.6 ? K[1] : K[0];
      });
      q.glow(a.x, a.y, a.z, 4, C[5], 0.15);
    });
    // light: the disk's glow, the halo hugging the hole, the floor lit under it
    q.glow(0, Y, 0, 80, C[4], 0.32);
    q.glow(0, Y, 0, 46, mix(C[6], C[5], 0.5), 0.45);
    q.glow(0, -1, 0, 44, C[4], 0.12);
    q.at(0, Y, 0, (pp) => {
      pp.z -= 40;
      halo(pp, 0, 0, RS - 0.4, RS + 4, C[6], 0.35 + 0.3 * pulse);
    });
    unlit3(q, 0, Y, 0, RS + 0.7, 1.3);
  },
};
