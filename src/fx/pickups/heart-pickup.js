// The hover, floor shadow and glints follow Sprite Fusion's open-source pickup
// (https://www.spritefusion.com/pixel-art-vfx/pickup), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, rand, cycle, space, TAU, WHITE, hex } from "../../core/index.js";
import { Layer, pillow, heartSdf, glint, blobShadow, trace, implicitHit, rotY, toObject, glint3, floorShadow, floorPool, lightRing } from "./_lib.js";

export const meta = {
  name: "Heart pickup",
  desc: "A plump glossy heart hovering over its shadow beats lub-dub: a big squash and stretch, a smaller echo, light and a thin ring pulsing out, tiny hearts drifting off.",
  tags: ["pickup", "heart", "health", "life", "loop"],
  size: [56, 60],
  origin: [28, 52],
  duration: 1.2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#1a0408", "#4a0a14", "#8a1222", "#d02436", "#ff4a56", "#ff8a8e", "#ffd0cc", "#ffffff"], seed: 4 },
};

const L = new Layer(40, 40), HOVER = 18, W = 7.2, INK = hex("#12060c");
const MINI = [".a.a.", "abbba", ".aba.", "..a.."];
const LUB = 0.04, DUB = 0.24; // the two beats, as loop phase

// a beat: a sharp squash that springs back through a stretch
const beat = (ph, at, s) => {
  const u = ph - at;
  if (u < 0 || u > 0.3) return 0;
  return s * Math.exp(-u * 16) * Math.cos(u * 34);
};
const pulse = (ph) => beat(ph, LUB, 1) + beat(ph, DUB, 0.55) + beat(ph + 1, LUB, 1);

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), ph = t / meta.duration, y = -HOVER - 1.2 * Math.sin(ph * TAU);
  blobShadow(p, 0, 8 + 1.5 * pulse(ph), 0.8);
  // tiny hearts float off from behind it, wobbling, and fade
  cycle(t, meta.duration, 4, o.seed, 0.95, (age, life, r, i) => {
    const side = i % 2 ? 1 : -1, k = age / life;
    const x = side * (r.range(2, 5) + age * r.range(9, 15)) + Math.sin(age * 7 + r.range(0, TAU)) * 1.5, yy = y - 5 - age * r.range(14, 19);
    const a = Math.min(1, age / 0.12) * (1 - k * k);
    p.sprite(MINI, { a: k < 0.5 ? C[5] : C[4], b: k < 0.3 ? WHITE : C[6] }, Math.round(x - 2.5), Math.round(yy - 2), { a: a * 1.3 });
    p.glow(x, yy, 5, C[4], 0.3 * a);
  });
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), ph = t / meta.duration, y = -HOVER - 1.2 * Math.sin(ph * TAU), b = pulse(ph);
  // squash wide on the beat, then spring back through a stretch
  const sx = 1 + 0.16 * b, sy = 1 - 0.13 * b, cy = Math.round(y);
  // light swells on each beat
  p.glow(0, cy, 22 + 6 * Math.max(0, b), C[4], 0.26 + 0.3 * Math.max(0, b));
  L.begin(-20, cy - 20);
  pillow(L, -12, cy - 11, 12, cy + 11, (x, yy) => heartSdf(x, yy, 0, cy, W * sx, W * sy), (lt, e) => {
    if (lt > 0.92 && e > 1.2) return WHITE;
    return lt > 0.8 ? C[6] : lt > 0.6 ? C[5] : lt > 0.38 ? C[4] : lt > 0.12 ? C[3] : C[2];
  }, { bevel: 3.6 });
  L.outline(INK).draw(p);
  // a thin ring of light snaps out on the big beat
  const u = (((ph - LUB) % 1) + 1) % 1;
  if (u < 0.28) {
    const k = u / 0.28, r = 9 + 8 * (1 - (1 - k) ** 3);
    p.ring(0, cy, r, 1, k < 0.2 ? C[6] : C[5], 0.85 * (1 - k));
    p.glowRing(0, cy, r, 4, C[4], 0.25 * (1 - k));
  }
  // a glint on its shoulder after each beat
  const g = (((ph - LUB - 0.08) % 0.5) + 0.5) % 0.5;
  if (g < 0.12) glint(p, -3.5, cy - 4, 2.6 * Math.sin((g / 0.12) * Math.PI), WHITE, 0.45);
}

// The same heart, plump in all three directions: an implicit heart surface traced from the camera, swaying on its axis
// so it shows its lobes, its cleft and its round back; the ring of light that snaps out is a true circle round it.
const HT = 3.6, HB = 4, HLIGHT = [-0.5, -0.6, 0.62];
// the 2D heart's outline, inflated: it is as thick as its distance from the edge allows, rounding over the last HB px
const inflate = (d, z) => (d > 0 ? d + Math.abs(z) : Math.abs(z) - HT * Math.sqrt(Math.max(0, 1 - (1 - Math.min(-d / HB, 1)) ** 2)));
export const three = {
  meta: { size: [64, 72], origin: [32, 56], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), ph = t / meta.duration, y = -HOVER - 1.2 * Math.sin(ph * TAU), b = pulse(ph);
    // squash wide on the beat, then spring back through a stretch
    const sx = 1 + 0.16 * b, sy = 1 - 0.13 * b, M = rotY(0.6 * Math.sin(ph * TAU + 0.5));
    floorShadow(q, 0, 0, 8 + 1.5 * pulse(ph), 0.8);
    floorPool(q, 0, 0, 18, C[4], 0.1 + 0.1 * Math.max(0, b));
    q.glow(0, y, 0, 22 + 6 * Math.max(0, b), C[4], 0.26 + 0.3 * Math.max(0, b));
    const f = (x, yy, z) => {
      const ox = M[0] * x + M[3] * yy + M[6] * z, oy = M[1] * x + M[4] * yy + M[7] * z, oz = M[2] * x + M[5] * yy + M[8] * z;
      return inflate(heartSdf(ox / sx, oy / sy, 0, 0, W), oz / sx);
    };
    trace(q, 0, y, 0, 11, implicitHit(f, { step: 0.5 }), (h) => {
      // the surface's own normal, as the 2D pillow works it out: flat in the middle, rounding over at the edge
      const [ox, oy, oz] = toObject(M, h), x = ox / sx, yy = oy / sy, d = heartSdf(x, yy, 0, 0, W), e = Math.max(0, -d);
      let gx = heartSdf(x + 0.5, yy, 0, 0, W) - heartSdf(x - 0.5, yy, 0, 0, W), gy = heartSdf(x, yy + 0.5, 0, 0, W) - heartSdf(x, yy - 0.5, 0, 0, W);
      const gl = Math.hypot(gx, gy) || 1, k = Math.max(0, 1 - e / HB) * 1.25, sn = Math.sin(k), cs = Math.cos(k) * (oz < 0 ? -1 : 1);
      gx = (gx / gl) * sn; gy = (gy / gl) * sn;
      const nx = M[0] * gx + M[1] * gy + M[2] * cs, ny = M[3] * gx + M[4] * gy + M[5] * cs, nz = M[6] * gx + M[7] * gy + M[8] * cs;
      const lt = nx * h.L[0] + ny * h.L[1] + nz * h.L[2];
      if (lt > 0.92 && e > 1.2) return WHITE;
      return lt > 0.8 ? C[6] : lt > 0.6 ? C[5] : lt > 0.38 ? C[4] : lt > 0.12 ? C[3] : C[2];
    }, { ink: INK, light: HLIGHT });
    // a thin ring of light snaps out round it on the big beat, flat in the air
    const u = (((ph - LUB) % 1) + 1) % 1;
    if (u < 0.28) {
      const k = u / 0.28, r = 9 + 8 * (1 - (1 - k) ** 3);
      lightRing(q, 0, y, 0, r, 1, k < 0.2 ? C[6] : C[5], 0.85 * (1 - k), C[4], 0.25 * (1 - k), 4);
    }
    // a glint on its shoulder after each beat
    const g = (((ph - LUB - 0.08) % 0.5) + 0.5) % 0.5;
    if (g < 0.12) glint3(q, -3.5 * q.cy + 6 * q.sy, y - 4 * q.cp - 6 * q.sp, 3.5 * q.sy + 6 * q.cy, 2.6 * Math.sin((g / 0.12) * Math.PI), WHITE, 0.45);
    // tiny hearts float off from behind it, out in every direction, wobbling, and fade
    const hearts = [];
    cycle(t, meta.duration, 5, o.seed, 0.95, (age, life, r, i) => {
      const k = age / life, a = (i * TAU) / 5 + r.range(-0.4, 0.4), d = r.range(2, 5) + age * r.range(9, 15);
      hearts.push([Math.cos(a) * d + Math.sin(age * 7 + r.range(0, TAU)) * 1.2 * -Math.sin(a), y - 5 - age * r.range(14, 19), Math.sin(a) * d + Math.sin(age * 7 + 1) * 1.2 * Math.cos(a), k, Math.min(1, age / 0.12) * (1 - k * k)]);
    });
    for (const [x, yy, z, k, a] of q.sort(hearts, (e) => e)) {
      q.at(x, yy, z, (pp) => pp.sprite(MINI, { a: k < 0.5 ? C[5] : C[4], b: k < 0.3 ? WHITE : C[6] }, -2, -2, { a: a * 1.3 }));
      q.glow(x, yy, z, 5, C[4], 0.3 * a);
    }
  },
};
