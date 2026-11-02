// The crystal shading (a lit ridge, bright faces turned to the light, a dark rim) and the orbiting motes
// follow Sprite Fusion's open-source ice crystals and pickup (https://www.spritefusion.com/pixel-art-vfx/ice),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, rand, space, TAU, WHITE } from "../../core/index.js";
import { Layer, drawGem, glint, blobShadow, pool, prism, trace, convexHit, gemTone, gemEdges, rotY, rotX, rotZ, matMul, glint3, floorShadow, floorPool } from "./_lib.js";

export const meta = {
  name: "Crystal shard",
  desc: "A broken amber shard hovers and sways: chipped uneven faces, its top sheared off, light pulsing up through glowing cracks and flaring out of the break; splinters orbit it.",
  tags: ["pickup", "crystal", "shard", "relic", "broken", "loop"],
  size: [64, 76],
  origin: [32, 68],
  duration: 3.2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#1a0a04", "#3e1606", "#702a08", "#a8480c", "#e07818", "#ffa838", "#ffd890", "#ffffff"], seed: 8 },
};

const HALF = 6, TILT = 0.18, LEAN = 0.2;
const roll = ([x, y, z]) => [x * Math.cos(LEAN) - y * Math.sin(LEAN), x * Math.sin(LEAN) + y * Math.cos(LEAN), z];
const unit = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
// the broken shard as a convex solid: an uneven six-sided body, a point on top sheared off on one side by a
// fracture, a lopsided point below, two corners chipped away
const SOLID = (() => {
  const planes = [], deg = Math.PI / 180, jit = [0, 8, -6, 4, -9, 5], rr = [1, 0.86, 1.08, 0.94, 0.82, 1.04], low = [6.5, 5.5, 7, 6, 5, 6.8];
  for (let k = 0; k < 6; k++) {
    const a = (k * 60 + jit[k]) * deg, r = 4.8 * rr[k], ct = Math.atan2(13, r), cb = Math.atan2(low[k], r);
    planes.push({ n: [Math.cos(a), 0, Math.sin(a)], d: r, kind: 6 });
    planes.push({ n: [Math.sin(ct) * Math.cos(a), Math.cos(ct), Math.sin(ct) * Math.sin(a)], d: Math.sin(ct) * r + Math.cos(ct) * HALF, kind: 7 });
    planes.push({ n: [Math.sin(cb) * Math.cos(a), -Math.cos(cb), Math.sin(cb) * Math.sin(a)], d: Math.sin(cb) * r + Math.cos(cb) * HALF, kind: 8 });
  }
  const shear = unit(0.7, 0.62, 0.34);
  planes.push({ n: shear, d: shear[1] * 7.2 + shear[0] * -0.6, kind: 9 });
  for (const [n, d] of [[unit(-0.7, -0.25, 0.65), 4.0], [unit(0.75, 0.15, 0.6), 3.9], [unit(-0.55, 0.5, 0.3), 6.8]]) planes.push({ n, d, kind: 10 });
  // the whole shard leans off upright
  for (const q of planes) q.n = roll(q.n);
  return { planes, r: 8, top: HALF + 13, bottom: HALF + 8 };
})();
// cracks running through it, in its own frame (y up): they turn with it
const CRACKS = [
  [[0.5, -9, 0.3], [-0.8, -5, 0.5], [0.6, -1, 0.2], [-0.4, 3, 0.6], [1.4, 6.5, 0.4], [2.2, 8.5, 0.6]],
  [[0.6, -1, 0.2], [2.4, 1.5, 1], [3.4, 4.2, 1.2]],
  [[-0.4, 3, 0.6], [-2, 6.5, 0.4], [-2.6, 10.5, 0.2], [-2.4, 14.5, 0.1]],
  [[-0.8, -5, 0.5], [-2.8, -3, 0.8]],
];
const L = new Layer(32, 52), SL = new Layer(16, 16), HOVER = 27, RX = 15, RY = 3.8;

const pose = (ph) => ({ y: -HOVER - 1.8 * Math.sin(ph * TAU), spin: 0.3 + 0.62 * Math.sin(ph * TAU) });
// a pulse of light climbing the cracks, twice a loop: where it is, from below the shard (-0.3) to past its top
const climb = (ph) => ((ph * 2) % 1) * 1.7 - 0.3;

// where a point of the shard lands on screen, turned by spin and seen from a little above
const project = (pt, spin, cy) => {
  const [x, y, z] = roll(pt), xr = x * Math.cos(spin) - z * Math.sin(spin), zr = x * Math.sin(spin) + z * Math.cos(spin);
  return [xr, cy - (y * Math.cos(TILT) - zr * Math.sin(TILT))];
};

function cracks(p, C, spin, cy, ph) {
  const s0 = climb(ph), rim = C[0] >>> 0;
  for (const crack of CRACKS)
    for (let i = 1; i < crack.length; i++) {
      const [x0, y0] = project(crack[i - 1], spin, cy), [x1, y1] = project(crack[i], spin, cy), n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      for (let j = 0; j <= n; j++) {
        const u = j / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u, h = crack[i - 1][1] + (crack[i][1] - crack[i - 1][1]) * u;
        const c = L.get(x, y) >>> 0;
        if (!c || c === rim) continue;
        // light runs up the crack: brightest where the pulse is
        const b = 0.3 + Math.exp(-((((h + 9) / 22 - s0) / 0.14) ** 2));
        p.px(x, y, b > 0.9 ? WHITE : b > 0.55 ? C[6] : C[5]);
        if (j % 4 === 0 && b > 0.5) p.glow(x + 0.5, y + 0.5, 2 + 3 * b, C[5], 0.16 * b);
      }
    }
}

// a splinter: a little two-tone sliver with a dark rim, turned to angle a
function splinter(p, C, x, y, len, a, far) {
  const ca = Math.cos(a), sa = Math.sin(a), X = Math.round(x), Y = Math.round(y);
  SL.begin(X - 7, Y - 7);
  SL.fill(X - 7, Y - 7, X + 6, Y + 6, (px, py) => {
    const dx = px - X, dy = py - Y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    if (Math.abs(u) / len + Math.abs(v) / (u > 0 ? 1.7 : 1.1) > 1) return 0;
    const lit = -(ca * 0.6 + sa * 0.8) * Math.sign(v || 1);
    return far ? (v < 0 ? C[4] : C[3]) : Math.abs(v) < 0.5 && u < 0 ? WHITE : v < 0 === lit > 0 ? C[6] : C[4];
  });
  SL.outline(C[far ? 1 : 0]).draw(p);
}

// the splinters on their tilted ring; back draws the far half, front the near half
function splinters(p, C, ph, cy, back) {
  for (let i = 0; i < 3; i++) {
    const a = ph * TAU + (i * TAU) / 3, s = Math.sin(a);
    if (s < 0 !== back) continue;
    const x = Math.cos(a) * RX, y = cy + 1 + s * RY - Math.cos(a) * 1.5, near = (s + 1) / 2;
    splinter(p, C, x, y, 3 + 1.6 * near, a * 2 + i * 1.7, back);
    p.glow(x, y, 6 + 3 * near, C[5], (back ? 0.18 : 0.32) * (0.6 + 0.4 * near));
    if (!back && s > 0.92) glint(p, x - 1, y - 1, (2.5 * (s - 0.92)) / 0.08, WHITE, 0.4);
  }
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), ph = t / meta.duration, { y } = pose(ph);
  blobShadow(p, 0, 6, 0.75);
  pool(p, 0, 0.5, 20, 3.5, C[4], 0.3);
  p.glowRing(0, y, 7, 20, C[4], 0.22);
  splinters(p, C, ph, y, true);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), ph = t / meta.duration, { y, spin } = pose(ph), s0 = climb(ph);
  drawGem(L, p, SOLID, 0, y, spin, C, { tilt: TILT, gain: 0.6 });
  cracks(p, C, spin, y, ph);
  // lit from within, brighter while the pulse is inside it
  const inside = Math.exp(-(((s0 - 0.45) / 0.45) ** 2));
  p.glow(0, y, 10, C[5], 0.2 * inside);
  splinters(p, C, ph, y, false);
  // when the pulse reaches the break it flares out of the sheared face and throws up embers
  const [fx, fy] = project([1.8, 8.4, 0.9], spin, y), out = clamp(1 - Math.abs(s0 - 1.05) / 0.18);
  if (out > 0) glint(p, fx, fy, 3.5 * out, WHITE, 0.55 * out), p.glow(fx, fy, 12, C[5], 0.4 * out);
  const P2 = meta.duration / 2, burst = ((1.05 + 0.3) / 1.7) * P2;
  for (let i = 0; i < 7; i++) {
    const born = burst + rand(i, o.seed, 1) * 0.12, at = (((t - born) % P2) + P2) % P2, life = 0.6 + rand(i, o.seed, 2) * 0.45;
    if (at > life) continue;
    const k = 1 - at / life, x = fx + (rand(i, o.seed, 3) - 0.5) * 4 + Math.sin(at * 5 + i) * 2 * (at / life), yy = fy - at * (14 + rand(i, o.seed, 4) * 14);
    p.px(x, yy, k > 0.6 ? WHITE : k > 0.3 ? C[6] : C[5]);
    p.glow(x + 0.5, yy + 0.5, 3, C[5], 0.35 * k);
  }
}

// The same broken shard as a solid, turning slowly on its vertical axis: the fracture, the chips and the lopsided point
// all come round, light climbs cracks that run over its whole surface, and the splinters are small tumbling crystals
// on a true circle round it.
const wrap = (a) => a - TAU * Math.round(a / TAU);
// the point on the body's surface at azimuth az and height h (y up, the shard's own frame): where a ray out of the axis leaves it
const surface = (az, h) => {
  let lo = 0, hi = 14;
  const c = Math.cos(az), s = Math.sin(az);
  for (let i = 0; i < 16; i++) {
    const r = (lo + hi) / 2;
    if (SOLID.planes.every((q) => q.n[0] * c * r + q.n[1] * h + q.n[2] * s * r <= q.d + 1e-6)) lo = r;
    else hi = r;
  }
  return lo;
};
// the cracks as paths over the surface, in (azimuth, height), on the side the 2D shard shows and again round its back
const PATHS = (() => {
  const one = CRACKS.map((cr) => cr.map((pt) => { const [x, y, z] = roll(pt); return [Math.atan2(z, x), y]; }));
  return [...one, ...one.map((cr) => cr.map(([a, h]) => [a + 2.9, h * 0.9 - 0.6]))];
})();
const crackAt = (az, h) => {
  let best = 9;
  for (const cr of PATHS)
    for (let i = 1; i < cr.length; i++) {
      const [a0, h0] = cr[i - 1], [a1, h1] = cr[i], bx = wrap(a1 - a0) * 4.8, by = h1 - h0, px = wrap(az - a0) * 4.8, py = h - h0;
      const u = clamp((px * bx + py * by) / (bx * bx + by * by || 1)), d = Math.hypot(px - bx * u, py - by * u);
      if (d < best) best = d;
    }
  return best;
};
const SPLINTER = prism({ r: 1.1, half: 1.3, top: 2.8, bottom: 2.2, n: 4 });
export const three = {
  meta: { size: [72, 92], origin: [36, 74], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), ph = t / meta.duration, { y } = pose(ph), s0 = climb(ph), spin = 0.3 + ph * TAU, M = rotY(spin);
    floorShadow(q, 0, 0, 6, 0.75);
    floorPool(q, 0, 0, 20, C[4], 0.3);
    q.glow(0, y, 0, 22, C[4], 0.22);
    // the splinters circle on a ring tilted a little off flat
    const TL = 0.28, ring = (i) => ph * TAU + (i * TAU) / 3, spl = (i) => { const a = ring(i); return [Math.cos(a) * RX, y + 1 + Math.sin(a) * RX * Math.sin(TL), Math.sin(a) * RX * Math.cos(TL)]; };
    let hot = null, hotV = -9;
    trace(q, 0, y, 0, 21, convexHit(SOLID, M), (h) => {
      const yup = -h.oy, a = Math.atan2(h.oz, h.ox);
      // a crack: light runs up it, brightest where the pulse is
      if (crackAt(a, yup) < 0.62) {
        const b = 0.3 + Math.exp(-((((yup + 9) / 22 - s0) / 0.14) ** 2));
        return b > 0.9 ? WHITE : b > 0.55 ? C[6] : C[5];
      }
      // the sheared face, for the flare
      if (h.kind === 9) {
        const v = h.nx * h.L[0] + h.ny * h.L[1] + h.nz * h.L[2];
        if (v > hotV) (hotV = v), (hot = [h.x, h.y, h.z]);
      }
      return gemTone(h, C, 0.6);
    }, { ink: C[0], edge: gemEdges(C) });
    // lit from within, brighter while the pulse is inside it
    const inside = Math.exp(-(((s0 - 0.45) / 0.45) ** 2));
    q.glow(0, y, 0, 10, C[5], 0.2 * inside);
    for (let i = 0; i < 3; i++) {
      const [x, yy, z] = spl(i), a = ring(i), near = (Math.sin(a) * Math.cos(TL) + 1) / 2;
      const Ms = matMul(rotY(a * 2 + i * 1.7), rotZ(1.1 + i * 0.5));
      trace(q, x, yy, z, 6, convexHit(SPLINTER, Ms, 1 + 0.5 * near), (h) => {
        const l = h.nx * h.L[0] + h.ny * h.L[1] + h.nz * h.L[2];
        return l > 0.9 ? WHITE : l > 0.45 ? C[6] : l > 0 ? C[5] : l > -0.4 ? C[4] : C[3];
      }, { ink: C[0] });
      q.glow(x, yy, z, 6 + 3 * near, C[5], 0.2 + 0.14 * near);
      if (near > 0.96) glint3(q, x - 1, yy - 1, z + 2, (2.5 * (near - 0.96)) / 0.04, WHITE, 0.4);
    }
    // when the pulse reaches the break it flares out of the sheared face and throws up embers
    const out = clamp(1 - Math.abs(s0 - 1.05) / 0.18);
    const fp = hot ?? [0, 0, 0];
    if (out > 0 && hot) glint3(q, fp[0], y + fp[1], fp[2], 3.5 * out, WHITE, 0.55 * out), q.glow(fp[0], y + fp[1], fp[2], 12, C[5], 0.4 * out);
    // the flare point in the world: the sheared face's own spot, turned with the shard
    const sp = [1.8, 8.4, 0.9], [rx, ry, rz] = roll(sp), fx = M[0] * rx + M[2] * rz, fy = -ry, fz = M[6] * rx + M[8] * rz;
    const P2 = meta.duration / 2, burst = ((1.05 + 0.3) / 1.7) * P2;
    for (let i = 0; i < 7; i++) {
      const born = burst + rand(i, o.seed, 1) * 0.12, at = (((t - born) % P2) + P2) % P2, life = 0.6 + rand(i, o.seed, 2) * 0.45;
      if (at > life) continue;
      const k = 1 - at / life, an = rand(i, o.seed, 6) * TAU, wob = Math.sin(at * 5 + i) * 2 * (at / life);
      const x = fx + (rand(i, o.seed, 3) - 0.5) * 4 + Math.cos(an) * wob, yy = y + fy - at * (14 + rand(i, o.seed, 4) * 14), z = fz + Math.sin(an) * wob;
      q.px(x, yy, z, k > 0.6 ? WHITE : k > 0.3 ? C[6] : C[5]);
      q.glow(x, yy, z, 3, C[5], 0.35 * k);
    }
  },
};
