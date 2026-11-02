// The hover, floor shadow and star glints follow Sprite Fusion's open-source pickup and sparkle
// (https://www.spritefusion.com/pixel-art-vfx/pickup), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, ease, rand, fly, flyV, space, TAU, WHITE } from "../../core/index.js";
import { Layer, glint, blobShadow, trace, sdfHit, rotY, rotZ, matMul, toObject, sdBox, sdSeg, sdTorus, glint3, floorShadowOval } from "./_lib.js";

export const meta = {
  name: "Key glint",
  desc: "An ornate silver key hovering and rocking; a glint runs from its bow down the shaft to the teeth and bursts off the tip as falling sparks.",
  tags: ["pickup", "key", "unlock", "item", "loop"],
  size: [72, 60],
  origin: [36, 54],
  duration: 2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#0e1018", "#222838", "#3c4660", "#5e6d8e", "#8c9cbc", "#bccae2", "#e6eeff", "#ffffff"], seed: 7 },
};

const L = new Layer(48, 40), HOVER = 19, MID = 8, TIP = 17.5;
const G0 = 0.18, G1 = 0.5; // the glint's run, as loop phase

// where the key hangs: bobbing and rocking, bow up to the left, teeth down to the right
const pose = (ph) => ({ y: -HOVER - 1.6 * Math.sin(ph * TAU), a: 0.42 + 0.11 * Math.sin(ph * TAU + 0.9) });
const toWorld = (u, v, cx, cy, a) => [cx + (u - MID) * Math.cos(a) - v * Math.sin(a), cy + (u - MID) * Math.sin(a) + v * Math.cos(a)];

// the key in its own frame: u along the shaft (bow at 0, tip at 17.5), v across it
function part(u, v) {
  const rb = Math.hypot(u, v);
  if (rb <= 4.6 && rb >= 2.1) return 1; // the bow's ring
  if (u >= 4.3 && u <= 6 && Math.abs(v) <= 1.9) return 2; // the collar
  if (u >= 6 && u <= TIP && Math.abs(v) <= 1) return 3; // the shaft
  if (u >= 12.6 && u <= TIP - 0.3 && v > 1 && v <= 4.6 && !(u > 14.3 && u < 15.4 && v > 2.7)) return 4; // the bit
  return 0;
}

function key(p, C, cx, cy, a, gu) {
  const ca = Math.cos(a), sa = Math.sin(a);
  L.begin(Math.floor(cx) - 24, Math.floor(cy) - 20);
  L.fill(Math.floor(cx) - 24, Math.floor(cy) - 20, Math.floor(cx) + 23, Math.floor(cy) + 19, (px, py) => {
    const dx = px - cx, dy = py - cy, u = dx * ca + dy * sa + MID, v = -dx * sa + dy * ca, k = part(u, v);
    if (!k) return 0;
    // light from the top left of the screen: work out which way this bit of metal faces
    let ny;
    if (k === 1) {
      const rb = Math.hypot(u, v), out = rb > 3.4 ? 1 : -1, wx = (u / rb) * out, wy = (v / rb) * out;
      ny = -(((wx * ca - wy * sa) * -0.6) + (wx * sa + wy * ca) * -0.8);
    } else ny = v < -0.35 ? 0.8 : v > 0.35 && k !== 4 ? -0.6 : k === 4 ? (v > 3.6 ? -0.5 : 0.1) : 0.2;
    let c = ny > 0.55 ? 6 : ny > 0.15 ? 4 : ny > -0.3 ? 3 : 2;
    if (k === 2) c = Math.min(7, c + 1);
    // the glint: a slanted band of white running down the key
    const g = Math.abs(u + v * 0.45 - gu);
    if (g < 0.8) return WHITE;
    if (g < 2) c = Math.min(7, c + 2);
    return C[c];
  });
  L.outline(C[0]).draw(p);
}

export function drawBack(p, t, o) {
  const { y } = pose(t / meta.duration);
  blobShadow(p, 0, 10, 0.8 - (-y - HOVER + 1.6) * 0.06);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), T = meta.duration, ph = t / T, { y, a } = pose(ph);
  const q = (ph - G0) / (G1 - G0), gu = q > 0 && q < 1 ? -5 + (TIP + 7) * ease.inOutSine(q) : -100;
  // cool light round it and all along it
  const [bx, by] = toWorld(0, 0, 0, y, a), [ex, ey] = toWorld(TIP, 0, 0, y, a);
  p.glow(0, y, 24, C[4], 0.3);
  p.glowLine(bx, by, ex, ey, 7, C[5], 0.16);
  key(p, C, 0, y, a, gu);
  // a few idle twinkles round it, one after another
  for (let i = 0; i < 4; i++) {
    const life = 0.4, age = (((t - ((i + 0.6) / 4) * T) % T) + T) % T;
    if (age > life) continue;
    const an = rand(i, o.seed, 8) * TAU, d = 9 + rand(i, o.seed, 9) * 6, k = Math.sin((age / life) * Math.PI);
    glint(p, Math.cos(an) * d, y + Math.sin(an) * d * 0.8 - age * 6, Math.round(1.8 * k), i % 2 ? C[6] : WHITE, 0.35 * k);
  }
  // light rides with the glint
  if (gu > -6) {
    const [gx, gy] = toWorld(clamp(gu, 0, TIP), 0, 0, y, a);
    p.glow(gx, gy, 10, C[6], 0.45 * Math.sin(q * Math.PI));
  }
  // as it leaves the tip: a star, and sparks that arc away and fall
  const [tx, ty] = toWorld(TIP, 0, 0, y, a), at = (ph - G1 + 0.02) * T;
  if (at > 0 && at < 0.3) glint(p, tx, ty, 4.5 * (1 - at / 0.3), C[6], 0.6 * (1 - at / 0.3));
  for (let i = 0; i < 9; i++) {
    const life = 0.32 + rand(i, o.seed, 4) * 0.3, age = at - rand(i, o.seed, 5) * 0.05;
    if (age < 0 || age > life) continue;
    const sp = 25 + rand(i, o.seed, 1) * 45, an = a + (rand(i, o.seed, 2) - 0.5) * 2.2;
    const [x, yy] = fly(tx, ty, Math.cos(an) * sp, Math.sin(an) * sp - 25, age, 380, 2.5), [vx, vy] = flyV(Math.cos(an) * sp, Math.sin(an) * sp - 25, age, 380, 2.5);
    if (yy > -0.5) continue; // it has reached the floor
    const s = Math.hypot(vx, vy) || 1, L2 = Math.min(4, 1 + s * 0.03), k = 1 - age / life;
    p.line(x - (vx / s) * L2, yy - (vy / s) * L2, x, yy, (u) => (u > 0.6 ? WHITE : C[5]), k * 1.6);
    p.glow(x, yy, 3, C[5], 0.4 * k);
  }
}

// The same key, a real object turning on its vertical axis once a loop: the bow is a torus, the shaft round, the bit a
// notched plate, so you see it end on, from behind, from above. The glint still runs bow to tip along the metal.
const KEY = (x, y, z) => {
  const u = x + MID;
  let d = sdTorus(u, y, z, 3.35, 1.2);
  d = Math.min(d, sdBox(u - 5.15, y, z, 0.85, 1.5, 1.3, 0.45));
  d = Math.min(d, sdSeg(u, y, z, 6, 0, 0, TIP - 0.5, 0, 0, 1.05));
  // the bit: a plate on the shaft's lower side with a notch cut in its end
  const bit = Math.max(sdBox(u - 14.9, y - 2.8, z, 2.3, 1.8, 0.9, 0.3), -sdBox(u - 14.85, y - 4.4, z, 0.6, 1.5, 3));
  return Math.min(d, bit);
};
export const three = {
  meta: { size: [80, 68], origin: [40, 56], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), T = meta.duration, ph = t / T, { y, a } = pose(ph), M = matMul(rotY(ph * TAU + 0.6), rotZ(a));
    const q0 = (ph - G0) / (G1 - G0), gu = q0 > 0 && q0 < 1 ? -5 + (TIP + 7) * ease.inOutSine(q0) : -100;
    const world = (u) => [M[0] * (u - MID) + 0, M[3] * (u - MID) + y, M[6] * (u - MID)];
    const [bx, by, bz] = world(0), [ex, ey, ez] = world(TIP), S = [M[0], M[3], M[6]];
    floorShadowOval(q, 0, 0, S[0], S[2], 3 + 10 * Math.hypot(S[0], S[2]), 3.5, 0.8 - (-y - HOVER + 1.6) * 0.06);
    const f = (x, yy, z) => {
      const kx = M[0] * x + M[3] * (yy - y) + M[6] * z, ky = M[1] * x + M[4] * (yy - y) + M[7] * z, kz = M[2] * x + M[5] * (yy - y) + M[8] * z;
      return KEY(kx, ky, kz);
    };
    // cool light round it and all along it
    q.glow(0, y, 0, 24, C[4], 0.3);
    q.glowLine(bx, by, bz, ex, ey, ez, 7, C[5], 0.16);
    trace(q, 0, y, 0, 13, sdfHit((x, yy, z) => f(x, yy + y, z), { grad: 0.3 }), (h) => {
      const [kx, ky, kz] = toObject(M, h), u = kx + MID, v = ky, l = h.nx * h.L[0] + h.ny * h.L[1] + h.nz * h.L[2];
      let c = l > 0.78 ? 6 : l > 0.42 ? 5 : l > 0.08 ? 4 : l > -0.3 ? 3 : 2;
      if (u > 4.3 && u < 6) c = Math.min(7, c + 1);
      // the glint: a slanted band of white running down the key
      const g = Math.abs(u + v * 0.45 - gu);
      if (g < 0.8) return WHITE;
      if (g < 2) c = Math.min(7, c + 2);
      return C[c];
    }, { ink: C[0], crease: 1.6 });
    // a few idle twinkles round it, out in a full sphere, one after another
    for (let i = 0; i < 4; i++) {
      const life = 0.4, age = (((t - ((i + 0.6) / 4) * T) % T) + T) % T;
      if (age > life) continue;
      const an = rand(i, o.seed, 8) * TAU, el = (rand(i, o.seed, 6) - 0.5) * 1.5, d = 9 + rand(i, o.seed, 9) * 6, k = Math.sin((age / life) * Math.PI);
      glint3(q, Math.cos(an) * Math.cos(el) * d, y + Math.sin(el) * d * 0.8 - age * 6, Math.sin(an) * Math.cos(el) * d, Math.round(1.8 * k), i % 2 ? C[6] : WHITE, 0.35 * k);
    }
    // light rides with the glint
    if (gu > -6) {
      const [gx, gy, gz] = world(clamp(gu, 0, TIP));
      q.glow(gx, gy, gz, 10, C[6], 0.45 * Math.sin(q0 * Math.PI));
    }
    // as it leaves the tip: a star, and sparks that arc away and fall, in every direction round the shaft
    const at = (ph - G1 + 0.02) * T;
    if (at > 0 && at < 0.3) glint3(q, ex, ey, ez, 4.5 * (1 - at / 0.3), C[6], 0.6 * (1 - at / 0.3));
    for (let i = 0; i < 9; i++) {
      const life = 0.32 + rand(i, o.seed, 4) * 0.3, age = at - rand(i, o.seed, 5) * 0.05;
      if (age < 0 || age > life) continue;
      const sp = 25 + rand(i, o.seed, 1) * 45, az = rand(i, o.seed, 2) * TAU, el = (rand(i, o.seed, 7) - 0.3) * 1.2;
      let dx = S[0] + Math.cos(az) * 0.9, dy = S[1] + Math.sin(el) * 0.9 - 0.2, dz = S[2] + Math.sin(az) * 0.9;
      const dl = Math.hypot(dx, dy, dz) || 1;
      dx = (dx / dl) * sp; dy = (dy / dl) * sp - 25; dz = (dz / dl) * sp;
      const [x, yy] = fly(ex, ey, dx, dy, age, 380, 2.5), [vx, vy] = flyV(dx, dy, age, 380, 2.5), zz = fly(ez, 0, dz, 0, age, 0, 2.5)[0], vz = dz * Math.exp(-2.5 * age);
      if (yy > -0.5) continue; // it has reached the floor
      const s = Math.hypot(vx, vy, vz) || 1, L2 = Math.min(4, 1 + s * 0.03), k = 1 - age / life;
      q.line(x - (vx / s) * L2, yy - (vy / s) * L2, zz - (vz / s) * L2, x, yy, zz, (u) => (u > 0.6 ? WHITE : C[5]), k * 1.6);
      q.glow(x, yy, zz, 3, C[5], 0.4 * k);
    }
  },
};
