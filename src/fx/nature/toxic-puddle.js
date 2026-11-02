import { cycle, fit, fly, rand, smooth, ease, clamp, mix, hex, tileNoise, space, TAU, WHITE } from "../../core/index.js";
import { ellipsoid, facing3 } from "./_lib.js";

export const meta = {
  name: "Toxic puddle",
  desc: "Black tar lit from inside by chartreuse veins and a glowing rim, an oily sheen drifting on it; glossy bubbles dome, stretch and pop, vapour curls up in fraying ribbons.",
  tags: ["nature", "poison", "toxic", "sludge", "tar", "puddle", "hazard", "ground", "loop"],
  size: [176, 100],
  origin: [88, 86],
  duration: 4,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#06070a", "#0c100c", "#141a10", "#1e2814", "#2e3c18", "#5a7a1c", "#a6d42a", "#ecff86"],
    sheen: ["#2a1648", "#5a2e8e", "#1e7a86", "#6adccc"],
    width: 42,
    seed: 2,
  },
};

const D = meta.duration;

// the surface height above the floor at x: a heavy lens of tar, slow swells rolling through it
function surf(x, W, t) {
  const d = Math.min(1, Math.abs(x) / W), ph = (TAU * t) / D;
  const lens = Math.sqrt(1 - d * d) * 6.6 + (d > 0.8 ? 1.6 * smooth(0.8, 0.9, d) : 0), swell = Math.max(0, Math.sin(x * 0.09 - ph)) ** 6 * 1.2 + Math.max(0, Math.sin(x * 0.06 + ph * 2 + 1)) ** 8 * 0.9;
  return -Math.round(lens + swell * (1 - d));
}

// the pool: an oily skin with a violet and teal sheen sliding over it, black depths threaded with veins of light,
// a chartreuse rim glowing where the tar meets the floor
function pool(p, C, Sh, W, t, seed) {
  const ph = t / D;
  for (let x = Math.floor(-W - 1); x <= Math.ceil(W + 1); x++) {
    const d = Math.abs(x + 0.5) / W;
    if (d > 1.03) continue;
    const top = surf(x + 0.5, W, t), oil = 0.6 * tileNoise(x * 0.08, ph * 4, 0, 4, seed) + 0.6 * tileNoise(x * 0.11 - ph * 4, 1, 4, 0, seed + 1), hue = tileNoise(x * 0.05, ph * 2 + 7, 0, 2, seed + 3);
    for (let y = top; y <= 2; y++) {
      if ((y === 2 && d > 0.75) || (y === 1 && d > 0.9)) continue;
      let c;
      if (d > 0.93 && y <= 0) c = y === top ? C[7] : C[6];
      else if (y === top) {
        // the skin catches light along its top: a lit edge, the sheen sliding over it, specular glints running along
        const glint = Math.abs(((x * 0.07 - ph * 3) % 1 + 1) % 1 - 0.5) < 0.012 || rand(x, Math.floor(t * 10)) < 0.015;
        c = glint ? WHITE : oil > 0.55 ? (hue > 0 ? Sh[3] : Sh[2]) : oil > 0.15 ? (hue > 0 ? Sh[1] : C[5]) : C[5];
        if (glint) p.light(x, y, C[7], 0.5);
      } else if (y === top + 1) c = oil > 0.4 ? Sh[0] : C[3];
      else if (y >= 1) c = C[0];
      else {
        // cracks of light under the crust, writhing slowly and swelling brighter and dimmer in a slow pulse
        const pulse = 0.5 + 0.5 * Math.sin((TAU * t) / D + x * 0.03), v = Math.abs(tileNoise(x * 0.09, y * 0.75 + ph * 4, 0, 4, seed + 7) + 0.2 * Math.sin((TAU * t * 2) / D + x * 0.15)), w = 0.6 + 0.6 * pulse;
        c = v < 0.035 * w ? C[7] : v < 0.08 * w ? C[6] : v < 0.14 * w ? C[4] : C[1];
        if (v < 0.08 * w) p.light(x, y, C[6], 0.25 + 0.3 * pulse);
      }
      p.px(x, y, c);
    }
    if (d > 0.9 && d <= 1.03) p.px(x, top - 1, C[1]);
  }
  // the glow bleeding out onto the floor at both lips
  for (const s of [-1, 1])
    for (let k = 1; k <= 6; k++) p.dot(s * (W + k), 0, k < 3 ? C[6] : C[5], 1 - k / 7);
}

// fat bubbles: dome up dark and glossy, stretch thin as light shows through their tops, pop in a ripple ring
// and a spatter of tar, and loose a ribbon of vapour
function bubbles(p, C, Sh, W, t, seed) {
  cycle(t, D, 8, seed, (g) => g.range(2.4, 3.2), (age, L, R) => {
    const swell = R.range(1, 1.6), x = R.range(-0.7, 0.7) * W, rmax = R.range(4.5, 8), sy = surf(x, W, t) + 0.5;
    if (age < swell) {
      const k = age / swell, st = smooth(0.65, 1, k), gr = ease.outCubic(Math.min(1, k * 1.3)), rx = rmax * gr * (1 - 0.18 * st), ry = rmax * gr * (1 + 0.5 * st);
      const X = Math.round(x), Y = Math.round(sy), inner = 0.35 + 0.65 * k;
      for (let j = -Math.ceil(ry) - 1; j <= 0; j++)
        for (let i = -Math.ceil(rx) - 1; i <= Math.ceil(rx) + 1; i++) {
          const dd = Math.hypot(i / Math.max(0.6, rx), j / Math.max(0.6, ry));
          if (dd > 1.1) continue;
          // a dark glossy skin with chartreuse light glowing up through it, strongest low in the middle
          let c;
          if (dd > 0.9) c = C[0];
          else if (dd < 0.55 * inner && j > -ry * 0.75) c = dd < 0.3 * inner ? C[6] : C[5];
          else if (dd < 0.8 * inner) c = C[4];
          else c = j < -ry * 0.5 ? C[2] : C[3];
          p.px(X + i, Y + j, c);
        }
      // the gloss: a curved band of sheen on its upper left, a bright highlight
      if (rx > 1.8)
        for (let a = 3.5; a < 4.7; a += 0.16) p.px(X + Math.cos(a) * rx * 0.68, Y + Math.sin(a) * ry * 0.68, a < 3.9 ? Sh[3] : a < 4.3 ? C[7] : Sh[1]);
      if (rx > 1.2) p.px(X - Math.round(rx * 0.35), Y - Math.round(ry * 0.62), WHITE), p.px(X - Math.round(rx * 0.35) + 1, Y - Math.round(ry * 0.62), C[7]);
      p.glow(x, sy - ry * 0.5, 7 + rx * 1.4, C[6], (0.2 + 0.35 * st) * gr);
      return;
    }
    const e = age - swell;
    // the pop: a ring rippling out flat across the tar, a flash of the light inside, spatter
    if (e < 0.3) {
      const k = e / 0.3, rr = 2 + 14 * ease.outCubic(k);
      for (let a = 0; a < TAU; a += 0.5 / rr) {
        const rx2 = x + Math.cos(a) * rr, ry2 = sy + Math.sin(a) * rr * 0.22;
        if (Math.abs(rx2) < W * 0.95) p.dot(rx2, ry2, k < 0.4 ? WHITE : k < 0.7 ? C[7] : C[6], (1 - k) * 1.4);
      }
      p.glowRing(x, sy, rr, 3, C[6], 0.35 * (1 - k));
      if (e < 0.1) p.glow(x, sy - 2, 18, C[6], 0.7 * (1 - e / 0.1));
    }
    for (let j = 0; j < 7; j++) {
      const vx = (rand(j, seed, Math.round(x * 10)) - 0.5) * 80, vy = -45 - rand(j, seed + 3, Math.round(x * 10)) * 70, [dx, dy] = fly(x, sy - 2, vx, vy, e, 420);
      if (dy < sy && e < 0.6) {
        p.px(dx, dy, C[1]);
        p.px(dx, dy - 1, j & 1 ? Sh[3] : C[6]);
      }
    }
    ribbon(p, C, x, sy - 2, e, L - swell, R, 0.9);
  });
}

// vapour: a thin ribbon that curls up off the tar, then frays into wisps that wander apart and fade
function ribbon(p, C, x0, y0, age, life, R, k) {
  const u = age / life, len = R.range(16, 26), rise = R.range(9, 14), amp = R.range(2, 4.5), w = R.range(0.18, 0.3), ph = R.range(0, TAU);
  const head = rise * age, tail = Math.max(0, head - len), fray = smooth(0.35, 0.85, u), fade = smooth(0, 0.12, u) * (1 - smooth(0.5, 1, u)) * k;
  if (fade < 0.02) return;
  const GREY = hex("#b4b8ae"), n = fray > 0.05 ? 3 : 1;
  for (let h = tail; h <= head; h += 0.5) {
    const s = (h - tail) / Math.max(1, head - tail), cx = x0 + amp * Math.sin(h * w + ph + age * 1.6) * (0.3 + s), y = y0 - h, a = fade * Math.sin(Math.PI * s) * 0.45;
    // lit from below by the pool: green and bright low down, greying as it climbs and frays
    const lit = Math.max(0, 1 - h / 22) * (1 - 0.6 * fray), VAP = mix(GREY, C[6], 0.75 * lit);
    for (let q = 0; q < n; q++) {
      // each wisp wanders off on its own slow curl as the ribbon frays
      const off = n === 1 ? 0 : fray * s * (q - 1) * 3 + fray * 2.5 * Math.sin(h * (0.35 + q * 0.17) + ph * (q + 1) + age * 2);
      p.blend(cx + off, y, VAP, a * (n === 1 ? 1 : 0.65 - 0.25 * fray) * (0.8 + 0.4 * lit));
    }
  }
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), Sh = fit(o.sheen, 4), W = o.width, pulse = 0.85 + 0.15 * Math.sin((TAU * t * 2) / D);
  // the light comes from inside the pool and its rim
  p.glow(0, -3, W * 1.25, C[5], 0.22 * pulse);
  p.glow(0, -10, W * 1.1, C[6], 0.1 * pulse);
  for (const s of [-1, 1]) p.glow(s * W, -1, 12, C[6], 0.35 * pulse);
  pool(p, C, Sh, W, t, o.seed);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), Sh = fit(o.sheen, 4), W = o.width;
  bubbles(p, C, Sh, W, t, o.seed * 7 + 1);
  // a steady breath of vapour ribbons off the whole pool
  cycle(t, D, 9, o.seed * 13 + 4, (g) => g.range(2.4, 3.4), (age, L, R) => {
    const x = R.range(-0.85, 0.85) * W;
    ribbon(p, C, x, surf(x, W, t) - 1, age, L, R, 0.75);
  });
}

// ---- 3D: a round pool of tar, a heavy lens of it you can see from every side, veins of light under its skin and a glowing
// lip where it meets the floor; bubbles dome up on it, stretch and pop in a ring of ripples, vapour winds up in ribbons.
const RY = 6.8;

// a ribbon of vapour winding up through the air, fraying into wisps: as ribbon() but with a depth too
function ribbon3(q, C, x0, y0, z0, age, life, R, k) {
  const u = age / life, len = R.range(16, 26), rise = R.range(9, 14), amp = R.range(2, 4.5), w = R.range(0.18, 0.3), ph = R.range(0, TAU);
  const head = rise * age, tail = Math.max(0, head - len), fray = smooth(0.35, 0.85, u), fade = smooth(0, 0.12, u) * (1 - smooth(0.5, 1, u)) * k;
  if (fade < 0.02) return;
  const GREY = hex("#b4b8ae"), n = fray > 0.05 ? 3 : 1;
  for (let h = tail; h <= head; h += 0.6) {
    const s = (h - tail) / Math.max(1, head - tail), a0 = h * w + ph + age * 1.6, cx = x0 + amp * Math.sin(a0) * (0.3 + s), cz = z0 + amp * Math.cos(a0) * (0.3 + s), y = y0 - h, a = fade * Math.sin(Math.PI * s) * 0.45;
    // lit from below by the pool: green and bright low down, greying as it climbs and frays
    const lit = Math.max(0, 1 - h / 22) * (1 - 0.6 * fray), VAP = mix(GREY, C[6], 0.75 * lit);
    for (let j = 0; j < n; j++) {
      const off = n === 1 ? 0 : fray * s * (j - 1) * 3 + fray * 2.5 * Math.sin(h * (0.35 + j * 0.17) + ph * (j + 1) + age * 2);
      q.blend(cx + off, y, cz + off * 0.6, VAP, a * (n === 1 ? 1 : 0.65 - 0.25 * fray) * (0.8 + 0.4 * lit));
    }
  }
}

export const three = {
  meta: { size: [136, 120], origin: [68, 92], camera: { pitch: 0.34 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), Sh = fit(o.sheen, 4), W = o.width, ph = t / D, pulse = 0.85 + 0.15 * Math.sin((TAU * t * 2) / D), seed = o.seed;
    // the height of the skin above the floor at (x, z)
    const surfY = (x, z) => {
      const d = Math.hypot(x, z) / W;
      return d >= 1 ? 0 : -RY * Math.sqrt(1 - d * d);
    };
    // light from inside the pool and its rim, on the floor round it
    q.plane(0, 0, 0, null, W * 1.3, (u, v, out) => {
      const d = Math.hypot(u, v) / (W * 1.3);
      if (d > 1) return;
      const dd = d * 1.3;
      out.l = C[5];
      out.k = 0.26 * pulse * (1 - d) * (dd > 1 ? 1 : 0.6);
      if (dd > 1 && dd < 1.18) {
        // the glow bleeding out onto the floor at the lip
        out.c = dd < 1.07 ? C[6] : C[5];
        out.a = 1 - (dd - 1) / 0.18;
      }
    });
    q.glow(0, -3, 0, W * 1.25, C[5], 0.18 * pulse);
    q.glow(0, -10, 0, W * 1.1, C[6], 0.08 * pulse);
    // the pool: an oily skin with a violet and teal sheen sliding over it, black depths threaded with veins of light,
    // a chartreuse rim glowing where the tar meets the floor
    ellipsoid(q, 0, 0, 0, W, RY, W, (nx, ny, nz, X, Y, Z) => {
      const d = Math.hypot(X, Z) / W, L = facing3(nx, ny, nz);
      if (Y > -1.2 || d > 0.97) return d > 0.97 ? C[7] : C[6];
      const oil = 0.6 * tileNoise(X * 0.08, ph * 4 + Z * 0.03, 0, 4, seed) + 0.6 * tileNoise(Z * 0.11 - ph * 4, 1 + X * 0.02, 4, 0, seed + 1) + 0.3 * Math.sin(d * 14 - TAU * ph * 2), hue = tileNoise(X * 0.05, ph * 2 + 7 + Z * 0.04, 0, 2, seed + 3);
      // cracks of light under the crust, writhing slowly and swelling brighter and dimmer
      const pulse2 = 0.5 + 0.5 * Math.sin((TAU * t) / D + X * 0.03), v = Math.abs(tileNoise(X * 0.09, Z * 0.09 + ph * 4, 0, 4, seed + 7) + 0.2 * Math.sin((TAU * t * 2) / D + (X + Z) * 0.15)), w = 0.6 + 0.6 * pulse2;
      let c = v < 0.035 * w ? C[7] : v < 0.08 * w ? C[6] : v < 0.14 * w ? C[4] : L > 0.55 ? C[2] : C[1];
      // the skin catches light: a violet and teal sheen drifting over it where it faces the light, a glint at the brightest spot
      if (c === C[1] || c === C[2]) {
        if (oil > 0.9 && L > 0.1) c = hue > 0 ? Sh[3] : Sh[2];
        else if (oil > 0.55 && L > 0.1) c = hue > 0 ? Sh[1] : Sh[0];
        if (L > 0.9) c = WHITE;
      }
      return c;
    }, { clipY: 0.01 });
    // fat bubbles: dome up dark and glossy, stretch thin as light shows through their tops, pop in a ripple ring
    // and a spatter of tar, and loose a ribbon of vapour
    cycle(t, D, 8, seed * 7 + 1, (g) => g.range(2.4, 3.2), (age, Lf, R) => {
      const swell = R.range(1, 1.6), ang = R.range(0, TAU), rad = R.range(0.05, 0.7) * W, x = Math.cos(ang) * rad, z = Math.sin(ang) * rad, rmax = R.range(4.5, 8), sy = surfY(x, z);
      if (age < swell) {
        const k = age / swell, st = smooth(0.65, 1, k), gr = ease.outCubic(Math.min(1, k * 1.3)), rx = rmax * gr * (1 - 0.18 * st), ry = rmax * gr * (1 + 0.5 * st), inner = 0.35 + 0.65 * k;
        // a dark glossy skin with chartreuse light glowing up through it, strongest low in the middle
        ellipsoid(q, x, sy + 0.5, z, Math.max(0.6, rx), Math.max(0.6, ry), Math.max(0.6, rx), (nx, ny, nz) => {
          if (nz < 0.24) return C[0];
          const L = facing3(nx, ny, nz);
          if (L > 0.93) return WHITE;
          if (L > 0.8 && nz < 0.9) return Sh[3];
          if (nz > 0.93 - 0.15 * inner && ny > -0.2) return nz > 0.985 - 0.08 * inner ? C[6] : C[5];
          return nz > 0.7 ? C[3] : ny < -0.4 ? C[1] : C[2];
        }, { clipY: 0.2 });
        q.glow(x, sy - ry * 0.5, z, 7 + rx * 1.4, C[6], (0.2 + 0.35 * st) * gr);
        return;
      }
      const e = age - swell;
      // the pop: a ring rippling out across the tar, a flash of the light inside, spatter
      if (e < 0.3) {
        const k = e / 0.3, rr = 2 + 14 * ease.outCubic(k);
        for (let a = 0; a < TAU; a += 0.5 / rr) {
          const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
          if (Math.hypot(px, pz) < W * 0.95) q.dot(px, surfY(px, pz) - 0.4, pz, k < 0.4 ? WHITE : k < 0.7 ? C[7] : C[6], (1 - k) * 1.4);
        }
        if (e < 0.1) q.glow(x, sy - 2, z, 18, C[6], 0.7 * (1 - e / 0.1));
      }
      for (let j = 0; j < 7; j++) {
        const aa = rand(j, seed, Math.round(x * 10)) * TAU, sp = rand(j, seed + 5, Math.round(x * 10)) * 40, vx = Math.cos(aa) * sp, vz = Math.sin(aa) * sp, vy = -45 - rand(j, seed + 3, Math.round(x * 10)) * 70;
        const [dx, dy] = fly(x, sy - 2, vx, vy, e, 420), dz = z + vz * e;
        if (dy < sy && e < 0.6) {
          q.px(dx, dy, dz, C[1]);
          q.px(dx, dy - 1, dz, j & 1 ? Sh[3] : C[6]);
        }
      }
      ribbon3(q, C, x, sy - 2, z, e, Lf - swell, R, 0.9);
    });
    // a steady breath of vapour ribbons off the whole pool
    cycle(t, D, 10, seed * 13 + 4, (g) => g.range(2.4, 3.4), (age, Lf, R) => {
      const ang = R.range(0, TAU), rad = R.range(0.1, 0.85) * W, x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      ribbon3(q, C, x, surfY(x, z) - 1, z, age, Lf, R, 0.75);
    });
  },
};
