import { fit, sparkle, cycle, rng, space, clamp, smooth, lerp, TAU, WHITE, mix, luma } from "../../core/index.js";
import { GOLD, shapeOf, rod } from "./_lib.js";

export const meta = {
  name: "Blessing",
  desc: "A soft cone of light rests on the character from above; sparkles drift down through it, twinkling, and wink out where they land on the head and shoulders.",
  tags: ["holy", "blessing", "buff", "light", "sparkle", "character", "loop"],
  size: [80, 128],
  origin: [40, 108],
  duration: 3,
  loop: true,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: GOLD, seed: 7 },
};

const OPEN = { turn: 1.15, fx: -13, fy: -31, bx: 14, by: -31, hy: -1, ffx: -3, fbx: 4 };
export const act = {
  onBody: true,
  poses: [
    [0, OPEN],
    [0.75, { ...OPEN, fy: -33, by: -33 }],
    [1.5, { ...OPEN, crouch: -1, fy: -35, by: -35 }],
    [2.25, { ...OPEN, fy: -33, by: -33 }],
    [3, OPEN],
  ],
};

const TOP = -108, T = 3;
const halfW = (y) => lerp(5, 20, (y - TOP) / -TOP);
// the rays in the cone, each shimmering a whole number of times a loop so it closes
const RAYS = [[-0.62, 0.16, 1, 0.3], [-0.2, 0.2, 2, 1.7], [0.22, 0.14, 1, 4.1], [0.6, 0.18, 2, 2.6]];
const ray = (q, t) => {
  let I = 0.3 * Math.max(0, 1 - q * q);
  for (const [o, w, k, ph] of RAYS) I += Math.exp(-(((q - o) / w) ** 2)) * (0.55 + 0.45 * Math.sin((t / T) * TAU * k + ph)) * 0.6;
  return I * smooth(1.25, 0.75, Math.abs(q));
};

// where each falling sparkle meets the character or the floor (cached per seed and character)
const LANDS = new Map();
function landings(o, S) {
  const key = `${o.seed}:${S.x}:${S.y}`;
  if (LANDS.has(key)) return LANDS.get(key);
  const out = [];
  for (let i = 0; i < 20; i++) {
    const R = rng(o.seed, i), q = R.range(-0.9, 0.9), v = R.range(22, 34), sway = R.range(1, 3), ph = R.range(0, TAU), size = R.range(0.8, 2.4);
    let land = Infinity;
    for (let a = 0; a < 6; a += 0.02) {
      const y = TOP + 6 + v * a, x = q * halfW(y) + Math.sin(a * 2.2 + ph) * sway;
      if (y >= -1 || S.at(x, y)) {
        land = a;
        break;
      }
    }
    out.push({ q, v, sway, ph, size, land });
  }
  LANDS.set(key, out);
  return out;
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8);
  // the cone: soft light with a faint gold haze in it
  p.each(-24, TOP, 24, 0.5, (x, y, sx, sy) => {
    const I = ray(x / halfW(y), t) * (0.6 + 0.4 * smooth(TOP, 0, y));
    if (I < 0.02) return;
    p.blendPx(sx, sy, C[6], I * 0.13);
    p.add(sx, sy, C[4], I * 0.22);
  });
  // two of the rays show as fine lines, light running slowly down them
  for (const [o2, , k, ph] of [RAYS[1], RAYS[2]])
    for (let y = TOP; y < -1; y++) {
      const pulse = 0.5 + 0.5 * Math.sin(y * 0.11 - (t / T) * TAU * 3 + ph);
      p.dot(o2 * halfW(y), y, pulse > 0.85 ? WHITE : C[6], (0.1 + 0.45 * pulse) * (0.5 + 0.5 * Math.sin((t / T) * TAU * k + ph)) * smooth(TOP, TOP + 20, y));
    }
  p.glow(0, -4, 30, C[4], 0.22);
}

// light catching the top of the head and the shoulders
function headLight(p, A, C) {
  const m = A.mask;
  for (let i = 0; i < m.w; i++)
    for (let j = 0; j < m.h; j++) {
      const c = A.pixels[j * m.w + i];
      if (!c || luma(c) < 0.15) continue;
      p.px(A.x + i, A.y + j, mix(c, C[6], 0.35));
      break;
    }
  p.glow(0, -30, 20, C[5], 0.22);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), A = o.actor, S = A ? shapeOf(A) : null;
  if (A) headLight(p, A, C);
  // the floor catches it: a lit line and a pool fading out into the stone
  for (let y = 0; y <= 3; y++)
    for (let x = -24; x <= 24; x++) {
      const u = Math.hypot(x / 24, y / 4);
      if (u >= 1) continue;
      p.dot(x, y, u < 0.3 ? (y ? C[5] : WHITE) : u < 0.6 ? C[5] : u < 0.85 ? C[4] : C[3], y === 0 ? Math.sqrt(1 - u) : (1 - u) * 0.7);
    }
  // sparkles drifting down, twinkling, winking out where they land
  if (S) {
    const L = landings(o, S);
    cycle(t, T, L.length, o.seed, (g) => 3, (age, life, R, i) => {
      const s = L[i], y = TOP + 6 + s.v * age, x = s.q * halfW(y) + Math.sin(age * 2.2 + s.ph) * s.sway, fade = Math.min(1, age / 0.3);
      if (age > s.land) {
        const w = (age - s.land) / 0.14;
        if (w < 1) {
          const ly = TOP + 6 + s.v * s.land, lx = s.q * halfW(ly) + Math.sin(s.land * 2.2 + s.ph) * s.sway;
          sparkle(p, lx, ly, 3 * (1 - w) + 1, WHITE, C[6], 0.5 * (1 - w));
        }
        return;
      }
      const tw = 0.6 + 0.4 * Math.sin(age * (7 + (i % 4)) + s.ph);
      if (s.size > 1.2) sparkle(p, x, y, s.size * tw * fade, tw > 0.85 ? WHITE : C[6], C[5], 0.35 * fade);
      else {
        p.dot(x, y, tw > 0.8 ? WHITE : C[6], fade);
        p.glow(x, y, 3, C[5], 0.35 * fade);
      }
    });
  }
  // fine motes hanging in the light
  cycle(t, T, 16, o.seed + 9, (g) => g.range(1.2, 2.4), (age, life, R) => {
    const u = age / life, y = TOP + 10 + R.range(0, 90) + u * R.range(6, 14), q = R.range(-1, 1), x = q * halfW(y) + Math.sin(age * 1.7 + q * 5) * 1.5, k = Math.sin(u * Math.PI) * ray(q, t);
    if (k > 0.12) p.dot(x, y, k > 0.45 ? WHITE : C[6], Math.min(1, k * 2.2));
  });
}

// ---- 3D: the cone is a real cone of light, a dozen shafts at their own angles round its axis
// each shaft: azimuth, how far out in the cone (0 axis .. 1 the wall), its shimmer (whole turns a loop) and phase
const SHAFTS = Array.from({ length: 12 }, (_, i) => {
  const [, , k, ph] = RAYS[i % 4];
  return { a: i * 2.399 + 0.5, f: 0.15 + 0.75 * ((i * 0.618) % 1), k, ph: ph + i * 0.9, w: 0.8 + 0.4 * ((i * 0.37) % 1) };
});
const shim = (s, t) => 0.55 + 0.45 * Math.sin((t / T) * TAU * s.k + s.ph);
// a point on a shaft at height y
const onShaft = (s, y) => [Math.cos(s.a) * s.f * halfW(y), y, Math.sin(s.a) * s.f * halfW(y)];
// the light of all the shafts at a point, for what floats in them (about 1 on a bright shaft's axis)
function lightIn(t, x, y, z) {
  const hw = halfW(y);
  let I = 0.3 * Math.max(0, 1 - (x * x + z * z) / (hw * hw));
  for (const s of SHAFTS) {
    const [sx, , sz] = onShaft(s, y), d = Math.hypot(x - sx, z - sz), w = (1.5 + 0.2 * hw) * s.w;
    I += Math.exp(-((d / w) ** 2)) * shim(s, t) * 0.6;
  }
  return I * smooth(1.25 * hw, 0.75 * hw, Math.hypot(x, z));
}
// where each falling sparkle meets the character or the floor (cached per seed and character): in 3D it can also
// miss the character, passing in front of him or behind and landing on the floor
function landings3(o, S) {
  const key = `3:${o.seed}:${S.x}:${S.y}`;
  if (LANDS.has(key)) return LANDS.get(key);
  const out = [];
  for (let i = 0; i < 20; i++) {
    const R = rng(o.seed, i), f = R.range(0.05, 0.9), a = R.range(0, TAU), v = R.range(22, 34), sway = R.range(1, 3), ph = R.range(0, TAU), size = R.range(0.8, 2.4);
    const at = (age) => {
      const y = TOP + 6 + v * age, hw = f * halfW(y);
      return [Math.cos(a) * hw + Math.sin(age * 2.2 + ph) * sway, y, Math.sin(a) * hw + Math.cos(age * 2.2 + ph) * sway * 0.7];
    };
    let land = Infinity;
    for (let age = 0; age < 6; age += 0.02) {
      const [x, y, z] = at(age);
      if (y >= -1 || (Math.abs(z) < 5 && S.at(x, y))) {
        land = age;
        break;
      }
    }
    out.push({ at, v, size, ph, land });
  }
  LANDS.set(key, out);
  return out;
}

export const three = {
  meta: { size: [96, 128], origin: [48, 108], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const C = fit(o.palette, 8), A = o.actor, S = A ? shapeOf(A) : null, q = space(p, o), ph = (t / T) * TAU;
    if (A) headLight(p, A, C);
    // the cone's haze, behind the character: soft light with a faint gold wash
    q.at(0, 0, 0, (pp) => {
      pp.z += 8;
      pp.each(-24, TOP, 24, 0.5, (x, y, sx, sy) => {
        const I = 0.3 * Math.max(0, 1 - (x / halfW(y)) ** 2) * (0.6 + 0.4 * smooth(TOP, 0, y));
        if (I < 0.02) return;
        pp.blendPx(sx, sy, C[6], I * 0.13);
        pp.add(sx, sy, C[4], I * 0.22);
      });
    });
    // the shafts: translucent, widening as they come down, each shimmering on its own beat
    for (const s of SHAFTS) {
      const [x0, y0, z0] = onShaft(s, TOP), [x1, y1, z1] = onShaft(s, 0), k = shim(s, t);
      rod(q, x0, y0, z0, x1, y1, z1, 3 * s.w, 15 * s.w, (u, v, out) => {
        const e = Math.exp(-2.2 * v * v) * k * (0.5 + 0.5 * smooth(0, 0.3, u));
        out.c = C[6];
        out.a = e * 0.1 * smooth(0, 0.2, u);
        out.l = C[4];
        out.k = e * 0.04;
      });
    }
    // four of them show a fine line, light running slowly down it
    for (const s of SHAFTS.slice(0, 4)) {
      const [x0, y0, z0] = onShaft(s, TOP), [x1, y1, z1] = onShaft(s, -1), k = shim(s, t);
      q.line(x0, y0, z0, x1, y1, z1, (u) => (0.5 + 0.5 * Math.sin((TOP + u * -TOP) * 0.11 - (t / T) * TAU * 3 + s.ph) > 0.85 ? WHITE : C[6]), (u) => {
        const y = TOP + u * -TOP;
        return (0.1 + 0.45 * (0.5 + 0.5 * Math.sin(y * 0.11 - (t / T) * TAU * 3 + s.ph))) * k * smooth(TOP, TOP + 20, y);
      });
    }
    // the floor catches it: a pool of light, a true disc, fading out into the stone
    q.plane(0, 0, 0, null, 24, (u, v, out) => {
      const d = Math.hypot(u, v) / 24;
      if (d >= 1) return;
      out.c = d < 0.15 ? WHITE : d < 0.6 ? C[5] : d < 0.85 ? C[4] : C[3];
      out.a = (1 - d) * 0.8;
      out.blend = true;
      out.l = C[4];
      out.k = 0.25 * (1 - d);
    });
    q.glow(0, -4, 0, 30, C[4], 0.22);
    // sparkles drifting down, twinkling, winking out where they land
    if (S) {
      const L = landings3(o, S);
      cycle(t, T, L.length, o.seed, () => 3, (age, life, R, i) => {
        const s = L[i], [x, y, z] = s.at(age), fade = Math.min(1, age / 0.3);
        if (age > s.land) {
          const w = (age - s.land) / 0.14;
          if (w < 1) {
            const [lx, ly, lz] = s.at(s.land);
            q.at(lx, ly, lz, (pp) => sparkle(pp, 0, 0, 3 * (1 - w) + 1, WHITE, C[6], 0.5 * (1 - w)));
          }
          return;
        }
        const tw = 0.6 + 0.4 * Math.sin(age * (7 + (i % 4)) + s.ph);
        if (s.size > 1.2) q.at(x, y, z, (pp) => sparkle(pp, 0, 0, s.size * tw * fade, tw > 0.85 ? WHITE : C[6], C[5], 0.35 * fade));
        else {
          q.dot(x, y, z, tw > 0.8 ? WHITE : C[6], fade);
          q.glow(x, y, z, 3, C[5], 0.35 * fade);
        }
      });
    }
    // fine motes hanging in the light
    cycle(t, T, 16, o.seed + 9, (g) => g.range(1.2, 2.4), (age, life, R) => {
      const u = age / life, y = TOP + 10 + R.range(0, 90) + u * R.range(6, 14), f = R.range(0, 0.95), a = R.range(0, TAU), hw = f * halfW(y);
      const x = Math.cos(a) * hw + Math.sin(age * 1.7 + a * 5) * 1.5, z = Math.sin(a) * hw + Math.cos(age * 1.7 + a * 5) * 1.5, k = Math.sin(u * Math.PI) * lightIn(t, x, y, z);
      if (k > 0.12) q.dot(x, y, z, k > 0.45 ? WHITE : C[6], Math.min(1, k * 2.2));
    });
  },
};
