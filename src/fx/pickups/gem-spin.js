// The hover, floor shadow and twinkle glints follow Sprite Fusion's open-source pickup and sparkle
// (https://www.spritefusion.com/pixel-art-vfx/pickup), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, smooth, ease, cycle, rand, space, TAU, WHITE, hex, mix, scale } from "../../core/index.js";
import { Layer, brilliant, drawGem, glint, blobShadow, trace, convexHit, gemTone, gemEdges, rotY, glint3, floorShadow } from "./_lib.js";

export const meta = {
  name: "Gem spin",
  desc: "A brilliant-cut ruby turning on its axis: real facets catch the light in turn, flashes roll over the crown, refracted light slides across the floor, sparkles wink round it.",
  tags: ["pickup", "gem", "jewel", "treasure", "ruby", "loop"],
  size: [64, 64],
  origin: [32, 56],
  duration: 2.4,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#16040e", "#3e0a1e", "#760e2e", "#b8163c", "#ec3250", "#ff7482", "#ffc4c8", "#ffffff"], seed: 6 },
};

const GEM = brilliant({ r: 7.5, crown: 3.2, table: 0.5, pavilion: 9.5, girdle: 0.9 });
const L = new Layer(32, 32), HOVER = 19;

// where the gem is: hovering, one slow bob a loop, turning four facets a loop
const pose = (t, T) => ({ y: -HOVER - 1.8 * Math.sin((t / T) * TAU), spin: (t / T) * Math.PI });

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), T = meta.duration, { y, spin } = pose(t, T), lift = (-y - HOVER + 2) / 4;
  blobShadow(p, 0, 8 - lift * 1.5, 0.75 - lift * 0.2);
  // light refracted through the stone, sliding over the floor as it turns
  for (let k = 0; k < 3; k++) {
    const a = spin * 4 + (k * TAU) / 3, x = Math.sin(a) * 9, k2 = 0.5 + 0.5 * Math.cos(a);
    if (k2 < 0.15) continue;
    p.dot(x, 0, k2 > 0.7 ? C[6] : C[5], k2 * 1.2);
    p.dot(x + 1, 0, C[4], k2 * 0.8);
    p.dot(x - 1, 0, C[4], k2 * 0.6);
    p.glow(x + 0.5, 0, 6, C[5], 0.3 * k2);
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), T = meta.duration, ph = t / T, { y, spin } = pose(t, T);
  // its light: a wide soft halo and a hot heart
  p.glowRing(0, y - 1, 5, 15, C[4], 0.34);
  p.glow(0, y, 26, C[3], 0.14);
  const hi = drawGem(L, p, GEM, 0, y, spin, C, { tilt: 0.22 });
  // a star flares where a facet swings square to the light, twice a loop
  const f = ((spin * 4) / TAU) % 1, fk = Math.max(0, 1 - Math.abs(f - 0.5) / 0.08);
  if (fk > 0) glint(p, -3, y - 3, 3.4 * ease.outQuad(fk), C[6], 0.45 * fk);
  // sparkles wink on and off round it, one after another
  for (let i = 0; i < 8; i++) {
    const life = 0.4, age = (((t - (i / 8) * T - rand(i, o.seed, 3) * 0.1) % T) + T) % T;
    if (age > life) continue;
    const a = rand(i, o.seed, 1) * TAU + i * 2.4, d = 10 + rand(i, o.seed, 2) * 7, k = Math.sin((age / life) * Math.PI);
    glint(p, Math.cos(a) * d, y + Math.sin(a) * d * 0.8 - age * 6, Math.round(2.4 * k * (0.6 + 0.4 * rand(i, 9))), i % 3 ? C[6] : WHITE, 0.4 * k);
  }
}

// The same ruby, a real solid: its planes are traced from the camera, so every facet turns through the light, the
// pavilion shows its point from the side, and light slides round the floor in a ring.
export const three = {
  meta: { size: [72, 72], origin: [36, 58], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), T = meta.duration, ph = t / T, { y, spin } = pose(t, T), lift = (-y - HOVER + 2) / 4;
    floorShadow(q, 0, 0, 8 - lift * 1.5, 0.75 - lift * 0.2);
    // light refracted through the stone, sliding round the floor as it turns
    for (let k = 0; k < 3; k++) {
      const a = spin * 4 + (k * TAU) / 3, x = Math.cos(a) * 10, z = Math.sin(a) * 10, k2 = 0.5 + 0.5 * Math.cos(a * 2 + k);
      if (k2 < 0.15) continue;
      q.dot(x, 0, z, k2 > 0.7 ? C[6] : C[5], k2 * 1.2);
      q.dot(x + 1, 0, z, C[4], k2 * 0.8);
      q.dot(x - 1, 0, z, C[4], k2 * 0.6);
      q.glow(x, 0, z, 6, C[5], 0.3 * k2);
    }
    // its light: a wide soft halo and a hot heart
    q.glow(0, y - 1, 0, 15, C[4], 0.34);
    q.glow(0, y, 0, 26, C[3], 0.14);
    let best = -1, bx = 0, by = 0, bz = 0;
    trace(q, 0, y, 0, 13, convexHit(GEM, rotY(spin)), (h) => {
      const c = gemTone(h, C);
      if (h.s > best) (best = h.s), (bx = h.x), (by = h.y), (bz = h.z);
      return c;
    }, { ink: C[0], edge: gemEdges(C) });
    // a star flares where a facet swings square to the light, twice a loop
    const f = ((spin * 4) / TAU) % 1, fk = Math.max(0, 1 - Math.abs(f - 0.5) / 0.08);
    if (fk > 0) glint3(q, bx + q.sy * 2, y + by, bz + q.cy * 2, 3.4 * ease.outQuad(fk), C[6], 0.45 * fk);
    // sparkles wink on and off round it, out in a full sphere, one after another
    for (let i = 0; i < 8; i++) {
      const life = 0.4, age = (((t - (i / 8) * T - rand(i, o.seed, 3) * 0.1) % T) + T) % T;
      if (age > life) continue;
      const a = rand(i, o.seed, 1) * TAU + i * 2.4, el = (rand(i, o.seed, 6) - 0.5) * 1.6, d = 10 + rand(i, o.seed, 2) * 7, k = Math.sin((age / life) * Math.PI);
      glint3(q, Math.cos(a) * Math.cos(el) * d, y + Math.sin(el) * d * 0.8 - age * 6, Math.sin(a) * Math.cos(el) * d, Math.round(2.4 * k * (0.6 + 0.4 * rand(i, 9))), i % 3 ? C[6] : WHITE, 0.4 * k);
    }
  },
};
