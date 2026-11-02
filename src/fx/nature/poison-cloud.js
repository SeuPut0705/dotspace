import { cycle, fit, rng, smooth, clamp, space, TAU, WHITE, tileNoise } from "../../core/index.js";

export const meta = {
  name: "Poison cloud",
  desc: "A miasma hugging the floor: ragged sheets of gas lit yellow-green from within, fading to violet, creep out in tongues that curl over at their tips; plumes twist up as ribbons.",
  tags: ["nature", "poison", "gas", "cloud", "miasma", "toxic", "area", "ground", "loop"],
  size: [256, 100],
  origin: [128, 86],
  duration: 4,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#0e0816", "#24123a", "#3e2056", "#5a3a62", "#6a6a3a", "#96aa30", "#cce040", "#f4ffa0"],
    spread: 1,
    seed: 3,
  },
};

const D = meta.duration;
// sheets of gas, back to front: how tall, how wide, how thick, how much dimmer, how fast their edges flow
const SHEETS = [
  { h: 36, e: 0.84, a: 0.46, dim: 2, flow: 4, n: 2, back: true },
  { h: 26, e: 0.96, a: 0.5, dim: 1, flow: 8, n: 2, back: true },
  { h: 16, e: 1.04, a: 0.56, dim: 0, flow: 8, n: 3, back: false },
];

// tongues creeping out along the floor from the middle: where each one's front is, how tall, how far along
function tongues(sh, si, E, ph) {
  const out = [];
  for (const s of [-1, 1])
    for (let i = 0; i < sh.n; i++) {
      const q = (ph + i / sh.n + si * 0.17 + (s > 0 ? 0.5 / sh.n : 0)) % 1;
      out.push({ s, q, x: s * E * (0.3 + 0.82 * q), h: sh.h * (0.75 - 0.45 * q) });
    }
  return out;
}

// a sheet's height above the floor at x: flat through the middle, falling away at its ends, its top torn by
// noise that flows outward, raised behind each tongue's front
function height(sh, si, E, x, ph, T, seed) {
  const ax = Math.abs(x), env = 1 - smooth(0.5, 1, ax / (E * sh.e)), r = tileNoise(ax * 0.07 - ph * sh.flow, si * 3.7, sh.flow, 0, seed + si);
  let h = sh.h * env * (0.55 + 0.45 * r);
  for (const g of T) {
    const behind = g.s * (g.x - x);
    if (behind < -1.5 || behind > 30) continue;
    h = Math.max(h, g.h * Math.sqrt(Math.max(0, 1 - behind / 30)) * smooth(-1.5, 1.5, behind) * (1 - smooth(0.75, 1, g.q)));
  }
  return h;
}

// one sheet: brightest down at the floor where it's lit from within, darkening to violet toward its torn top,
// streaked in thin layers, a pale rim along its edge
function sheet(p, C, sh, si, E, t, seed) {
  const ph = t / D, T = tongues(sh, si, E, ph), d = sh.dim, X = Math.ceil(E * 1.25);
  for (let x = -X; x <= X; x++) {
    const H = height(sh, si, E, x + 0.5, ph, T, seed);
    if (H < 0.6) continue;
    const top = -Math.round(H);
    for (let y = top; y <= 1; y++) {
      const v = clamp(-y / H), streak = 0.7 + 0.3 * tileNoise(x * 0.05 - ph * sh.flow * Math.sign(x || 1), y * 0.55, sh.flow, 0, seed + 9 + si);
      const lv = v - (streak - 0.7) * 0.6, c = y === top ? C[Math.max(1, 4 - d)] : lv < 0.16 ? C[6 - d] : lv < 0.42 ? C[5 - d] : lv < 0.68 ? C[4 - d] : C[Math.max(1, 3 - d)];
      p.blend(x, y, c, sh.a * (y === top ? 0.65 : (0.6 + 0.4 * (1 - v)) * streak));
    }
  }
  // the tongues' leading edges roll over in curls as they creep forward
  for (const g of T) {
    const k = Math.sin(Math.PI * g.q);
    if (k < 0.15 || g.h < 4) continue;
    const r = 1.8 + g.h * 0.22, cx = g.x - g.s * r * 0.6, cy = -g.h * 0.72, spin = -g.s * g.q * TAU * 2.2;
    // a roll of gas: a thick soft band winding in on itself, lighter along its outer edge
    for (let a = 0; a < 4.6; a += 0.1) {
      const rr = r * (1 - a * 0.12), px = cx + g.s * Math.cos(spin + a) * rr, py = cy + Math.sin(spin + a) * rr, w = 1.6 * (1 - a / 6);
      for (let o = -w; o <= w; o += 0.8) {
        const qx = px + g.s * Math.cos(spin + a) * o, qy = py + Math.sin(spin + a) * o;
        p.blend(qx, qy, o > w * 0.4 ? C[5 - d] : C[4 - d], sh.a * 0.75 * k * (1 - a / 5.5));
      }
    }
  }
}

// plumes: columns that lift off the sheets and twist into ribbons, thinning as they climb
function plumes(p, C, E, t, seed) {
  cycle(t, D, 5, seed, (g) => g.range(2.4, 3.2), (age, L, R) => {
    const u = age / L, x0 = R.range(-0.55, 0.55) * E, rise = R.range(13, 19), len = R.range(34, 48), ph = R.range(0, TAU), amp = R.range(3, 5);
    const head = 14 + rise * age, tail = Math.max(10, head - len), fade = smooth(0, 0.15, u) * (1 - smooth(0.5, 1, u));
    for (let h = tail; h <= head; h += 0.7) {
      const s = (h - tail) / Math.max(1, head - tail), tw = Math.cos(h * 0.22 + age * 2.4 + ph), w = 0.6 + 2.2 * Math.abs(tw) * (1 - s * 0.5);
      const x = x0 + amp * Math.sin(h * 0.12 + age + ph) * (0.4 + s), a = fade * Math.sin(Math.PI * Math.min(1, s * 1.2)) * 0.32;
      for (let o = -w; o <= w; o += 1) p.blend(x + o, -h, tw > 0 ? (Math.abs(o) < w * 0.5 ? C[6] : C[5]) : Math.abs(o) < w * 0.5 ? C[3] : C[2], a);
    }
  });
}

// specks drifting out through the gas with its flow, twinkling
function specks(p, C, E, t, seed) {
  cycle(t, D, 30, seed, (g) => g.range(1.5, 2.6), (age, L, R) => {
    const u = age / L, s = R.sign(), x = s * (R.range(0.05, 0.7) * E + age * R.range(6, 14)), y = -R.range(2, 20) - Math.sin(age * R.range(1.5, 3) + R.next() * TAU) * 2;
    const a = Math.min(1, u * 5) * Math.min(1, (1 - u) * 3) * (0.6 + 0.4 * Math.sin(age * R.range(6, 10) + R.next() * TAU));
    if (a < 0.1) return;
    p.dot(x, y, a > 0.7 ? C[7] : C[6], a * 1.3);
    p.glow(x, y, 4, C[6], 0.3 * a);
  });
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), E = 96 * o.spread, pulse = 0.85 + 0.15 * Math.sin((TAU * t * 2) / D);
  // lit from within, low down: a soft line of light along the floor under it all
  for (let x = -E; x <= E; x += 22) p.glow(x, -3, 30, C[5], 0.14 * pulse * (1 - Math.abs(x) / (E * 1.3)));
  // pockets of light wandering inside it, low down
  for (let i = 0; i < 6; i++) {
    const R = rng(o.seed, i, 7), x = Math.sin((TAU * t) / D + R.range(0, TAU)) * E * R.range(0.2, 0.7) + R.range(-0.3, 0.3) * E, k = 0.6 + 0.4 * Math.sin((TAU * t * 3) / D + i);
    p.glow(x, -R.range(4, 10), R.range(14, 22), C[6], 0.2 * k);
  }
  SHEETS.forEach((sh, i) => sh.back && sheet(p, C, sh, i, E, t, o.seed));
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), E = 96 * o.spread;
  plumes(p, C, E, t, o.seed * 7 + 2);
  SHEETS.forEach((sh, i) => !sh.back && sheet(p, C, sh, i, E, t, o.seed));
  specks(p, C, E, t, o.seed * 11 + 5);
  p.glow(0, -6, E * 0.9, C[5], 0.1);
}

// ---- 3D: the miasma is a low bank of gas lying on the floor, thick through its middle and creeping out every way in
// tongues; puffs in three layers (violet and high, yellow-green and low) sort through each other, lit from within by
// light on the floor, with plumes twisting up out of it as helical ribbons and specks drifting out on its flow.
const LAYERS = [
  { e: 0.86, a: 0.34, dim: 2, n: 6, y: -15, rr: 11 },
  { e: 0.98, a: 0.38, dim: 1, n: 7, y: -10, rr: 9.5 },
  { e: 1.06, a: 0.44, dim: 0, n: 8, y: -5.5, rr: 8 },
];

export const three = {
  meta: { size: [240, 156], origin: [120, 116], camera: { pitch: 0.34 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), E = 84 * o.spread, ph = t / D, pulse = 0.85 + 0.15 * Math.sin(TAU * ph * 2), seed = o.seed;
    const puffs = [];
    LAYERS.forEach((L, li) => {
      const d = L.dim;
      // tongues creeping out from the middle, each with a train of puffs that swell, drift out and thin
      for (let j = 0; j < L.n; j++) {
        const a0 = (j / L.n) * TAU + li * 0.55 + tileNoise(j * 1.7, li, 0, 0, seed) * 0.3;
        for (let k = 0; k < 5; k++) {
          const f = (ph + k / 5 + j * 0.37 + li * 0.17) % 1, r = E * L.e * (0.14 + 0.86 * f), az = a0 + 0.16 * Math.sin(TAU * ph + j * 1.9 + k);
          const w = Math.sin(Math.PI * f), a = L.a * Math.pow(w, 0.5), rad = L.rr * (1.15 - 0.4 * f) * (0.8 + 0.3 * Math.sin(TAU * ph * 2 + j + k * 2));
          puffs.push([Math.cos(az) * r, L.y * (1 - 0.35 * f) - rad * 0.2, Math.sin(az) * r, rad, a, d, f]);
        }
      }
      // the thick middle of the bank, turning slowly
      for (let j = 0; j < 9; j++) {
        const az = (j / 9) * TAU + li + TAU * ph * (li % 2 ? -1 : 1), r = E * (0.08 + 0.2 * ((j * 5) % 9) / 9);
        puffs.push([Math.cos(az) * r, L.y - 2 + Math.sin(TAU * ph + j) * 1.5, Math.sin(az) * r, L.rr * 1.3, L.a * 1.2, d, 0.3]);
      }
    });
    for (const [x, y, z, rad, a, d, f] of q.sort(puffs, (v) => v)) {
      if (a < 0.02) continue;
      const body = C[Math.max(1, 4 - d + (f < 0.35 ? 1 : 0))], cap = C[Math.max(1, 6 - d)], rim = C[Math.max(2, 5 - d)];
      q.disc(x, y + rad * 0.15, z, rad, body, (dd) => a * (0.75 - 0.35 * dd * dd));
      q.disc(x - rad * 0.2, y - rad * 0.3, z, rad * 0.55, cap, (dd) => a * 0.6 * (1 - dd * 0.8));
      q.disc(x, y, z, rad, rim, (dd) => (dd > 0.86 ? a * 0.28 : 0));
    }
    // light from within, low down: a pool on the floor, and pockets of it wandering inside
    q.plane(0, 0, 0, null, E * 1.15, (u, v, out) => {
      const f = 1 - Math.hypot(u, v) / (E * 1.15);
      if (f <= 0) return;
      out.l = C[5];
      out.k = f * f * 0.24 * pulse * (0.75 + 0.25 * Math.sin(u * 0.13 + TAU * ph) * Math.cos(v * 0.11 - TAU * ph));
    });
    for (let i = 0; i < 6; i++) {
      const R = rng(seed, i, 7), a = R.range(0, TAU) + (i % 2 ? -1 : 1) * TAU * ph, r = E * R.range(0.15, 0.7), k = 0.6 + 0.4 * Math.sin(TAU * ph * 3 + i);
      q.glow(Math.cos(a) * r, -R.range(4, 12), Math.sin(a) * r, R.range(14, 22), C[6], 0.2 * k);
    }
    // plumes: columns that lift off the bank and twist into ribbons, thinning as they climb
    cycle(t, D, 6, seed * 7 + 2, (g) => g.range(2.4, 3.2), (age, Lf, R) => {
      const u = age / Lf, a0 = R.range(0, TAU), r0 = R.range(0.1, 0.62) * E, rise = R.range(13, 19), len = R.range(34, 48), pp = R.range(0, TAU), amp = R.range(3, 5);
      const head = 14 + rise * age, tail = Math.max(10, head - len), fade = smooth(0, 0.15, u) * (1 - smooth(0.5, 1, u)), x0 = Math.cos(a0) * r0, z0 = Math.sin(a0) * r0;
      for (let h = tail; h <= head; h += 0.8) {
        const s = (h - tail) / Math.max(1, head - tail), tw = Math.cos(h * 0.22 + age * 2.4 + pp), w = 0.8 + 2.4 * Math.abs(tw) * (1 - s * 0.5);
        const ang = h * 0.12 + age + pp, rr = amp * (0.4 + s), a = fade * Math.sin(Math.PI * Math.min(1, s * 1.2)) * 0.34;
        const cx = x0 + Math.cos(ang) * rr, cz = z0 + Math.sin(ang) * rr, tx = -Math.sin(ang), tz = Math.cos(ang);
        for (let w2 = -w; w2 <= w; w2 += 1) q.blend(cx + tx * w2 * 0.8, -h, cz + tz * w2 * 0.8, tw > 0 ? (Math.abs(w2) < w * 0.5 ? C[6] : C[5]) : Math.abs(w2) < w * 0.5 ? C[3] : C[2], a);
      }
    });
    // specks drifting out through the gas with its flow, twinkling
    cycle(t, D, 34, seed * 11 + 5, (g) => g.range(1.5, 2.6), (age, Lf, R) => {
      const u = age / Lf, az = R.range(0, TAU), r = R.range(0.05, 0.7) * E + age * R.range(6, 14), y = -R.range(2, 20) - Math.sin(age * R.range(1.5, 3) + R.next() * TAU) * 2;
      const a = Math.min(1, u * 5) * Math.min(1, (1 - u) * 3) * (0.6 + 0.4 * Math.sin(age * R.range(6, 10) + R.next() * TAU));
      if (a < 0.1) return;
      q.dot(Math.cos(az) * r, y, Math.sin(az) * r, a > 0.7 ? C[7] : C[6], a * 1.3);
      q.glow(Math.cos(az) * r, y, Math.sin(az) * r, 4, C[6], 0.3 * a);
    });
  },
};
