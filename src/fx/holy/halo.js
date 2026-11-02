import { fit, sparkle, cycle, space, TAU, WHITE, mix, luma } from "../../core/index.js";
import { GOLD, nearer } from "./_lib.js";

export const meta = {
  name: "Halo",
  desc: "A ring of gold light floats over the head with a glint running round it; fine dust sifts down from it and the head catches its light.",
  tags: ["holy", "halo", "saint", "buff", "glow", "character", "loop"],
  size: [56, 80],
  origin: [28, 70],
  duration: 2,
  loop: true,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: GOLD, seed: 5 },
};

const PRAY = { turn: 1.1, fx: -1, fy: -26, bx: 2, by: -26, armsFront: true, hy: 1, ffx: -3, fbx: 4 };
export const act = {
  onBody: true,
  poses: [[0, PRAY], [0.5, { ...PRAY, crouch: 1 }], [1, { ...PRAY, crouch: 1, hy: 2 }], [1.5, { ...PRAY, crouch: 1 }], [2, PRAY]],
};

const HY = -46, RX = 9.5, RY = 2.6;
// how far apart two angles are (0..π)
const apart = (a, b) => Math.abs(((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI);

// the hair under it catches the light: a warm rim on the top edge of each column of the head, and light falling off below it
function hair(p, A, C) {
  const m = A.mask;
  for (let i = 0; i < m.w; i++)
    for (let j = 0; j < Math.min(m.h, 9); j++) {
      const c = A.pixels[j * m.w + i];
      // skip empty space and the dark outline, light the first pixel of hair under it
      if (!c || luma(c) < 0.15) continue;
      const x = A.x + i, y = A.y + j;
      p.px(x, y, mix(c, C[6], 0.45));
      const c2 = A.pixels[(j + 1) * m.w + i];
      if (c2 && luma(c2) >= 0.15) p.px(x, y + 1, mix(c2, C[5], 0.18));
      for (let d = 0; d <= 4; d++) p.light(x, y + d, C[4], 0.3 * (1 - d / 5));
      break;
    }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), T = meta.duration, ph = (t / T) * TAU, A = o.actor;
  const y0 = HY + (Math.sin(ph) > 0.55 ? -1 : 0), gl = Math.PI / 2 + ph;
  if (A) hair(p, A, C);
  // the ring: a thick bright near side, a thin far side, a slow shimmer running round, the glint
  for (let j = 0, n = 92; j < n; j++) {
    const g = (j / n) * TAU, x = Math.cos(g) * RX, y = y0 + Math.sin(g) * RY, near = Math.sin(g) >= 0;
    const shimmer = Math.sin(g * 3 - ph * 2) > 0.7, hot = apart(g, gl) < 0.3;
    if (near) {
      p.px(x, y, hot ? WHITE : shimmer ? WHITE : C[6]);
      p.px(x, y + 1, hot ? C[6] : C[4]);
    } else p.dot(x, y, hot ? WHITE : shimmer ? C[6] : C[5], 0.9);
  }
  p.glow(0, y0, 20, C[4], 0.4);
  p.glow(0, y0 + 1, 9, WHITE, 0.16);
  const gx = Math.cos(gl) * RX, gy = y0 + Math.sin(gl) * RY;
  if (Math.sin(gl) > -0.2) sparkle(p, gx, gy + 0.5, 1.5 + 2.5 * Math.max(0, Math.sin(gl)), WHITE, C[6], 0.45);
  else p.glow(gx, gy, 5, C[6], 0.3);
  // light falls from it onto the head
  p.glowLine(0, y0 + 2, 0, y0 + 9, 9, C[4], 0.16);
  // little stars wink on and off about the ring
  cycle(t, T, 6, o.seed + 3, (g) => g.range(0.3, 0.5), (age, life, R) => {
    const g = R.range(0, TAU), d = R.range(1.1, 1.5), k = Math.sin((age / life) * Math.PI);
    sparkle(p, Math.cos(g) * RX * d, y0 + Math.sin(g) * RY * d - R.range(1, 4), 1 + 2 * k, WHITE, C[6], 0.4 * k);
  });
  // dust sifting down off the ring
  cycle(t, T, 16, o.seed, (g) => g.range(0.8, 1.5), (age, life, R) => {
    const g = R.range(0, TAU), u = age / life, x = Math.cos(g) * RX * R.range(0.8, 1) + Math.sin(u * 5 + g) * 1.2, y = y0 + Math.sin(g) * RY + 1 + u * R.range(7, 14);
    const tw = 0.6 + 0.4 * Math.sin(age * 18 + g * 7), k = Math.sin(u * Math.PI) * tw;
    p.dot(x, y, tw > 0.85 ? WHITE : C[6], Math.min(1, k * 1.5));
    p.light(x, y, C[5], 0.5 * k);
  });
}

// 3D: the ring is a true circle in the air, the far half behind the head and the near half in front of it from
// whichever side you look; the dust sifts down all round it
export const three = {
  meta: { size: [64, 84], origin: [32, 70], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const C = fit(o.palette, 8), T = meta.duration, ph = (t / T) * TAU, A = o.actor, q = space(p, o);
    const y0 = HY + (Math.sin(ph) > 0.55 ? -1 : 0), gl = Math.PI / 2 + ph;
    if (A) hair(p, A, C);
    // the ring: a thick bright near side, a thin far side, a slow shimmer running round, the glint
    for (let j = 0, n = 120; j < n; j++) {
      const g = (j / n) * TAU, x = Math.cos(g) * RX, z = Math.sin(g) * RX, near = nearer(q, x, y0, z, 0, y0, 0) >= 0;
      const shimmer = Math.sin(g * 3 - ph * 2) > 0.7, hot = apart(g, gl) < 0.3;
      if (near) {
        q.px(x, y0, z, hot || shimmer ? WHITE : C[6]);
        q.px(x, y0 + 1, z, hot ? C[6] : C[4]);
      } else q.dot(x, y0, z, hot ? WHITE : shimmer ? C[6] : C[5], 0.9);
    }
    // the hair and the head catch the light from it
    q.glowLine(0, y0 + 2, 0, 0, y0 + 9, 0, 9, C[4], 0.16);
    const gx = Math.cos(gl) * RX, gz = Math.sin(gl) * RX, gn = nearer(q, gx, y0, gz, 0, y0, 0) / RX;
    if (gn > -0.2) q.at(gx, y0 + 0.5, gz, (pp) => sparkle(pp, 0, 0, 1.5 + 2.5 * Math.max(0, gn), WHITE, C[6], 0.45));
    else q.glow(gx, y0, gz, 5, C[6], 0.3);
    // little stars wink on and off about the ring
    cycle(t, T, 6, o.seed + 3, (g) => g.range(0.3, 0.5), (age, life, R) => {
      const g = R.range(0, TAU), d = R.range(1.1, 1.5), k = Math.sin((age / life) * Math.PI);
      q.at(Math.cos(g) * RX * d, y0 - R.range(1, 4), Math.sin(g) * RX * d, (pp) => sparkle(pp, 0, 0, 1 + 2 * k, WHITE, C[6], 0.4 * k));
    });
    // dust sifting down off the ring
    cycle(t, T, 16, o.seed, (g) => g.range(0.8, 1.5), (age, life, R) => {
      const g = R.range(0, TAU), u = age / life, s = R.range(0.8, 1), w = Math.sin(u * 5 + g) * 1.2, y = y0 + 1 + u * R.range(7, 14);
      const x = Math.cos(g) * RX * s + w, z = Math.sin(g) * RX * s + Math.cos(u * 5 + g) * 1.2;
      const tw = 0.6 + 0.4 * Math.sin(age * 18 + g * 7), k = Math.sin(u * Math.PI) * tw;
      q.dot(x, y, z, tw > 0.85 ? WHITE : C[6], Math.min(1, k * 1.5));
      q.light(x, y, z, C[5], 0.5 * k);
    });
    q.glow(0, y0, 0, 20, C[4], 0.4);
    q.glow(0, y0 + 1, 0, 9, WHITE, 0.16);
  },
};
