// The hover, floor shadow and glints follow Sprite Fusion's open-source pickup
// (https://www.spritefusion.com/pixel-art-vfx/pickup), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, rand, space, TAU, WHITE, hex, scale } from "../../core/index.js";
import { Layer, coin3d, glint, blobShadow, trace, sdfHit, rotY, toObject, glint3, floorShadow } from "./_lib.js";

export const meta = {
  name: "Coin spin",
  desc: "A thick gold coin turning on its edge: an embossed star face, a reeded rim showing as it goes edge-on, a flash sweeping the face, bobbing over its shadow.",
  tags: ["pickup", "coin", "gold", "money", "loop"],
  size: [56, 56],
  origin: [28, 48],
  duration: 1.6,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"], seed: 3 },
};

const L = new Layer(32, 32), R = 7, TH = 3, HOVER = 17, INK = hex("#0b0814");

export function drawBack(p, t, o) {
  const T = meta.duration, ph = t / T, th = ph * TAU, y = -HOVER - 2 * Math.sin(ph * TAU);
  // the shadow narrows as the coin turns edge-on and thins as it rises
  blobShadow(p, 0, 2.5 + 4.5 * Math.abs(Math.cos(th)) + 1.5 * Math.abs(Math.sin(th)), 0.85 - (-y - HOVER + 2) * 0.06);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), T = meta.duration, ph = t / T, th = ph * TAU, y = -HOVER - 2 * Math.sin(ph * TAU);
  // warm light round it, swelling when the face catches the light
  const facing = Math.abs(Math.cos(th));
  p.glow(0, y, 20, C[4], 0.3 + 0.12 * facing);
  const flash = coin3d(L, p, 0, y, R, TH, th, C);
  p.glow(-1, y - 1, 12, C[6], 0.35 * flash);
  // a star glint where the flash leaves the rim
  if (flash > 0.3) glint(p, -4, y - 4, 1 + 3.2 * flash, C[6], 0.5 * flash);
  // little twinkles round it, one after another
  for (let i = 0; i < 5; i++) {
    const life = 0.35, age = (((t - (i / 5) * T - rand(i, o.seed, 3) * 0.08) % T) + T) % T;
    if (age > life) continue;
    const a = rand(i, o.seed, 1) * TAU + i * 2.1, d = 10 + rand(i, o.seed, 2) * 5, k = Math.sin((age / life) * Math.PI);
    glint(p, Math.cos(a) * d, y + Math.sin(a) * d * 0.85 - age * 8, Math.round(2 * k), i % 2 ? C[6] : WHITE, 0.35 * k);
  }
}

// The same coin, really turning about its upright axis: a cylinder with a rounded rim, ray-traced, so from any side
// you see its face come round, its reeded edge, its back. The shadow on the floor is the coin's own outline.
const FACE = 0.76;
export const three = {
  meta: { size: [64, 64], origin: [32, 52], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), T = meta.duration, ph = t / T, th = ph * TAU, y = -HOVER - 2 * Math.sin(ph * TAU);
    const M = rotY(th), cs = Math.cos(th), sn = Math.sin(th), HT = TH / 2;
    // the shadow: the coin's edge-on outline along its own direction, thinning as it rises
    const lift = (-y - HOVER + 2) * 0.06, along = [cs, -sn];
    q.plane(0, 0, 0, null, R + 4, (u, v, out) => {
      const a = (u * along[0] + v * along[1]) / (R * 0.95 + 1.5), b = (u * along[1] * -1 + v * along[0]) / (1.6 + HT);
      const d = a * a + b * b;
      if (d > 1) return;
      out.c = INK;
      out.a = Math.max(0, 0.95 - lift) * (1 - d * 0.55) * 1.25;
    });
    // the coin: a disc along its local x and y, thick along z, edges rounded
    const rr = 0.55, f = (x, yy, z) => {
      const [ox, oy, oz] = [M[0] * x + M[3] * yy + M[6] * z, M[1] * x + M[4] * yy + M[7] * z, M[2] * x + M[5] * yy + M[8] * z];
      const a = Math.hypot(ox, oy) - R + rr, b = Math.abs(oz) - HT + rr;
      return Math.min(Math.max(a, b), 0) + Math.hypot(Math.max(a, 0), Math.max(b, 0)) - rr;
    };
    let flash = 0;
    trace(q, 0, y, 0, R + 3, sdfHit(f), (h) => {
      const [fx, fy, fz] = toObject(M, h), n = [h.nx, h.ny, h.nz], Lo = [M[0] * h.L[0] + M[3] * h.L[1] + M[6] * h.L[2], M[1] * h.L[0] + M[4] * h.L[1] + M[7] * h.L[2]];
      const lam = n[0] * h.L[0] + n[1] * h.L[1] + n[2] * h.L[2];
      if (Math.abs(fz) > HT - 0.3 && Math.hypot(fx, fy) < R - 0.4) {
        // the face, in its own frame: a raised rim, a recessed field with a raised diamond, lit from the light's side
        const d = Math.hypot(fx, fy) / R, ll = Math.hypot(Lo[0], Lo[1]) || 1;
        const base = Math.max(2, Math.min(5, Math.round(2 + lam * 3.2)));
        const lit = ((fx * Lo[0] + fy * Lo[1]) / ll) / Math.max(0.5, Math.hypot(fx, fy));
        // a faint curve across the face makes the flash sweep over it as it turns
        const e = [M[0], M[3], M[6]], c = 0.3 * (fx / R), m = [n[0] + e[0] * c, n[1] + e[1] * c, n[2] + e[2] * c], ml = Math.hypot(...m);
        const sp = Math.pow(Math.max(0, (m[0] * h.H[0] + m[1] * h.H[1] + m[2] * h.H[2]) / ml), 130);
        flash = Math.max(flash, sp);
        let k;
        if (d > FACE) k = base + (lit > 0.75 ? 2 : lit > 0.3 ? 1 : lit < -0.35 ? -1 : 0);
        else {
          const w = (Math.abs(fx) + Math.abs(fy)) / (R * 0.52), cx = fx * Lo[0] + fy * Lo[1] > 0;
          k = w >= 1 ? base - 1 : w < 0.45 ? base + 1 : cx ? base + 1 : base - 2 + (fx * Lo[1] - fy * Lo[0] > 0 ? 2 : 0);
        }
        if (sp > 0.5) return sp > 0.8 ? WHITE : C[Math.min(7, k + 2)];
        return C[Math.max(2, Math.min(6, k))];
      }
      // the reeded edge: grooves across the band, lit by the edge's own normal
      const groove = Math.floor((Math.atan2(fy, fx) + Math.PI) * 9) % 2, edge = Math.abs(fz) > HT - 0.8;
      return C[Math.max(1, Math.min(6, Math.round(2.6 + lam * 2.6) - groove + (edge ? 1 : 0)))];
    }, { ink: C[1] });
    // light round it, swelling when the face catches the light
    q.glow(0, y, 0, 20, C[4], 0.3 + 0.12 * Math.abs(Math.cos(th)));
    q.glow(-1, y - 1, 0, 12, C[6], 0.35 * flash);
    if (flash > 0.3) {
      const [vx, vy, vz] = [-4, -4, 5];
      glint3(q, vx * q.cy + vz * q.sy, y + vy * q.cp - vz * q.sp, -vx * q.sy + vz * q.cy, 1 + 3.2 * flash, C[6], 0.5 * flash);
    }
    // twinkles round it, out in a full sphere, one after another
    for (let i = 0; i < 5; i++) {
      const life = 0.35, age = (((t - (i / 5) * T - rand(i, o.seed, 3) * 0.08) % T) + T) % T;
      if (age > life) continue;
      const a = rand(i, o.seed, 1) * TAU + i * 2.1, el = (rand(i, o.seed, 5) - 0.5) * 1.5, d = 10 + rand(i, o.seed, 2) * 5, k = Math.sin((age / life) * Math.PI);
      glint3(q, Math.cos(a) * Math.cos(el) * d, y + Math.sin(el) * d * 0.85 - age * 8, Math.sin(a) * Math.cos(el) * d, Math.round(2 * k), i % 2 ? C[6] : WHITE, 0.35 * k);
    }
  },
};
